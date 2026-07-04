import express from 'express';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const agent = ytdl.createAgent();

export async function handleDownload(req: express.Request, res: express.Response) {
  try {
    const { videoUrl, songTitle } = req.body;

    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Video URL is required / رابط الفيديو مطلوب'
      });
    }

    // Validate YouTube URL
    if (!ytdl.validateURL(videoUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL / رابط يوتيوب غير صالح'
      });
    }

    console.log(`[youtubeDownload] Start downloading audio for: ${videoUrl}`);

    // Try to get dynamic info or fallback to songTitle or a generic name
    let filename = songTitle || 'audio';
    
    // Clean filename for safety in headers
    filename = filename
      .replace(/[\/\\:*?"<>|]/g, '') // remove illegal characters
      .trim() || 'audio';

    // List of highly reliable public Cobalt API endpoints supporting both v10 and older versions
    const COBALT_ENDPOINTS = [
      'https://api.cobalt.tools/',
      'https://api.cobalt.tools/api/json',
      'https://cobalt.xyz/',
      'https://cobalt.xyz/api/json',
      'https://co.wuk.sh/',
      'https://co.wuk.sh/api/json',
      'https://cobalt-api.lule.io/',
      'https://cobalt-api.lule.io/api/json',
      'https://api.disroot.org/cobalt/',
      'https://api.disroot.org/cobalt/api/json',
      'https://cobalt.perennialte.ch/',
      'https://cobalt.perennialte.ch/api/json',
      'https://cobalt.projectsegfaut.im/',
      'https://cobalt.projectsegfaut.im/api/json'
    ];

    console.log(`[youtubeDownload] Triggering parallel race across ${COBALT_ENDPOINTS.length} Cobalt endpoints for: ${videoUrl}`);

    // Helper to race multiple Cobalt fetch requests
    const downloadUrl = await new Promise<string | null>((resolve) => {
      let resolved = false;
      let finishedCount = 0;
      const controllers: AbortController[] = [];

      // Timeout at 6 seconds to ensure quick completion and prevent server hangs
      const safetyTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          controllers.forEach(c => {
            try { c.abort(); } catch (e) {}
          });
          resolve(null);
        }
      }, 6000);

      COBALT_ENDPOINTS.forEach((endpoint) => {
        const controller = new AbortController();
        controllers.push(controller);

        fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          body: JSON.stringify({
            url: videoUrl,
            downloadMode: 'audio', // Cobalt v10 format
            isAudioOnly: true,     // Classic format (v7-v9)
            audioFormat: 'mp3',
            audioBitrate: '192',
            filenameStyle: 'classic',
            videoQuality: '720'
          })
        })
        .then(async (res) => {
          if (res.ok) {
            const data: any = await res.json();
            let url = data.url;
            
            // Handle picker style response (some instances return a picker list of format streams)
            if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length > 0) {
              url = data.picker[0].url;
            }

            const isSuccessfulStatus = ['stream', 'redirect', 'tunnel', 'picker', 'success'].includes(data.status);
            
            if (isSuccessfulStatus && url && !resolved) {
              resolved = true;
              clearTimeout(safetyTimeout);
              
              // Abort all other pending requests to free resources
              controllers.forEach(c => {
                try { c.abort(); } catch (e) {}
              });
              
              console.log(`[youtubeDownload] Parallel Cobalt race WON by endpoint: ${endpoint}`);
              resolve(url);
            }
          }
        })
        .catch(() => {
          // Ignore failures of individual endpoints in the race
        })
        .finally(() => {
          finishedCount++;
          if (finishedCount === COBALT_ENDPOINTS.length && !resolved) {
            resolved = true;
            clearTimeout(safetyTimeout);
            resolve(null);
          }
        });
      });
    });

    if (downloadUrl) {
      console.log(`[youtubeDownload] Successfully obtained conversion redirect link: ${downloadUrl}`);
      return res.status(200).json({
        success: true,
        redirectUrl: downloadUrl
      });
    }

    console.warn('[youtubeDownload] All parallel Cobalt endpoints failed or timed out.');

    // 2. FALLBACK TO YTDL-CORE + FFMPEG (Only for local dev, will throw on Vercel but safe to keep)
    console.log('[youtubeDownload] All Cobalt mirrors failed or timed out. Proceeding with ytdl-core local fallback...');
    
    // Check if we are running in a Vercel environment to warn user early of serverless restrictions
    if (process.env.VERCEL === '1') {
      return res.status(503).json({
        success: false,
        error: 'YouTube blocked download requests on Vercel server. Please try again in 5 seconds or search/play directly in browser! / يوتيوب حظر الاتصال المباشر من سيرفر فيرسيل. نرجو استخدام مشغل المتصفح المباشر.'
      });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.mp3`
    );

    // Get the audio stream from YouTube
    const ytStream = ytdl(videoUrl, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25, // 32MB buffer to reduce throttling/stalls
      playerClients: ['IOS', 'ANDROID', 'TV'],
      agent,
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }
    });

    ytStream.on('error', (err) => {
      console.error('[youtubeDownload] ytdl-core stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: `Bot detection / YouTube proxy restriction error: ${err.message}`
        });
      }
    });

    // Use fluent-ffmpeg to transcode to MP3 and pipe directly to response
    ffmpeg(ytStream)
      .audioBitrate(192) // high quality MP3 (192kbps)
      .toFormat('mp3')
      .on('start', (commandLine) => {
        console.log('[youtubeDownload] Spawned ffmpeg with command: ' + commandLine);
      })
      .on('error', (err) => {
        console.error('[youtubeDownload] Ffmpeg conversion error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: `YouTube conversion blocked locally: ${err.message}`
          });
        }
      })
      .on('end', () => {
        console.log('[youtubeDownload] Successfully completed audio conversion and sending.');
      })
      .pipe(res, { end: true });

  } catch (error: any) {
    console.error('[youtubeDownload] Unexpected download error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'An unexpected error occurred during download'
      });
    }
  }
}
