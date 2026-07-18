import express from 'express';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import { getInnertube } from './innertubeClient';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const agent = ytdl.createAgent();

export async function handleStream(req: express.Request, res: express.Response) {
  try {
    let videoUrl = req.query.url as string;
    if (!videoUrl) {
      const videoId = req.params.id;
      if (videoId) videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }

    if (!videoUrl) {
      return res.status(400).json({ success: false, error: 'Invalid URL' });
    }

    let videoId = '';
    try {
      videoId = ytdl.getURLVideoID(videoUrl);
    } catch (e) {
      const match = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      videoId = match ? match[1] : '';
    }

    if (!videoId) {
      return res.status(400).json({ success: false, error: 'Could not extract video ID' });
    }

    console.log(`[youtubeStream] Streaming audio for: ${videoId}`);

    // Set headers for inline audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');

    // 1. TRY COBALT FIRST (Highly reliable, races multiple endpoints)
    const COBALT_ENDPOINTS = [
      'https://api.cobalt.tools/',
      'https://api.cobalt.tools/api/json',
      'https://cobalt.xyz/',
      'https://cobalt.xyz/api/json',
      'https://co.wuk.sh/',
      'https://co.wuk.sh/api/json',
      'https://cobalt.projectsegfaut.im/',
      'https://cobalt.projectsegfaut.im/api/json',
      'https://cobalt.popre.me/',
      'https://cobalt.press/',
      'https://cobalt.pro/',
      'https://cobalt.wtf/',
      'https://api.cobalt.sh/',
      'https://cobalt.instinct.moe/',
      'https://cobalt.zyr.me/',
      'https://cobalt.silly.computer/',
      'https://cobalt.bruh.social/',
      'https://cobalt.goat.moe/',
      'https://cobalt.rest/',
      'https://cobalt.miz.li/',
      'https://cobalt.neon.moe/',
      'https://cobalt.qwed.me/',
      'https://cobalt.perv.cat/',
      'https://cobalt.buss.cat/',
      'https://cobalt.lule.io/',
      'https://cobalt.shite.xyz/',
      'https://cobalt.astolfo.gay/',
      'https://cobalt.fastness.casa/',
      'https://co.disroot.org/',
      'https://cobalt.canine.icu/',
      'https://cobalt.the-best.computer/',
      'https://cobalt.sweet.me/'
    ];

    const cobaltUrl = await new Promise<string | null>((resolve) => {
      let resolved = false;
      let finishedCount = 0;
      const controllers: AbortController[] = [];
      const safetyTimeout = setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 20000);

      COBALT_ENDPOINTS.forEach((endpoint) => {
        const controller = new AbortController();
        controllers.push(controller);
        
        const isV10 = !endpoint.includes('/api/json');
        const body = isV10 ? {
          url: videoUrl,
          downloadMode: 'audio',
          audioFormat: 'mp3',
          audioBitrate: '128'
        } : {
          url: videoUrl,
          isAudioOnly: true,
          audioFormat: 'mp3',
          audioBitrate: '128'
        };

        fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: { 
            'Accept': 'application/json', 
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          },
          body: JSON.stringify(body)
        })
        .then(async (r) => {
          if (r.ok) {
            const data: any = await r.json();
            let url = data.url;
            if (data.status === 'picker' && Array.isArray(data.picker) && data.picker.length > 0) {
              url = data.picker[0].url;
            }
            if (url && !resolved) {
              resolved = true;
              clearTimeout(safetyTimeout);
              controllers.forEach(c => { try { c.abort(); } catch(e){} });
              resolve(url);
            }
          }
        })
        .catch(() => {})
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

    if (cobaltUrl) {
      console.log(`[youtubeStream] Cobalt won! Streaming from: ${cobaltUrl}`);
      try {
        const streamRes = await fetch(cobaltUrl);
        if (streamRes.ok && streamRes.body) {
          const { Readable } = await import('stream');
          Readable.fromWeb(streamRes.body as any).pipe(res);
          return;
        }
      } catch (err) {
        console.warn(`[youtubeStream] Cobalt stream failed:`, err);
      }
    }

    // 2. TRY INNERTUBE (Highly robust, tries multiple client types)
    try {
      console.log(`[youtubeStream] Trying Innertube for: ${videoId}`);
      const client = await getInnertube();
      
      const clientsToTry: ('ANDROID' | 'TV_EMBEDDED' | 'WEB_EMBEDDED' | 'YTMUSIC' | 'WEB' | 'MWEB' | 'TV' | 'IOS')[] = 
        ['TV', 'MWEB', 'IOS', 'TV_EMBEDDED', 'YTMUSIC', 'ANDROID', 'WEB_EMBEDDED', 'WEB'];
      
      let stream;
      let lastErr: any = null;

      for (const clientType of clientsToTry) {
        try {
          console.log(`[youtubeStream] Innertube trying client: ${clientType}`);
          stream = await client.download(videoId, {
            type: 'audio',
            quality: 'best',
            format: 'mp4',
            client: clientType as any
          });
          if (stream) {
            console.log(`[youtubeStream] Innertube ${clientType} SUCCESS!`);
            break;
          }
        } catch (e: any) {
          lastErr = e;
          const errMsg = (e.message || e.toString());
          console.warn(`[youtubeStream] Innertube ${clientType} failed for ${videoId}:`, errMsg);
          
          if (errMsg.includes('login required') || 
              errMsg.includes('age restricted') || 
              errMsg.includes('unavailable') ||
              errMsg.includes('PlayerErrorCommand')) {
            continue;
          }
        }
      }

      if (!stream) {
        throw lastErr || new Error('All Innertube clients failed');
      }
      
      const { Readable } = await import('stream');
      const nodeStream = Readable.fromWeb(stream as any);

      return ffmpeg(nodeStream)
        .audioBitrate(128)
        .toFormat('mp3')
        .on('error', (err) => console.error('[youtubeStream] Innertube ffmpeg error:', err))
        .pipe(res, { end: true });
    } catch (err: any) {
      console.warn(`[youtubeStream] Innertube totally failed for ${videoId}:`, err.message || err);
    }

    // 3. FALLBACK TO PIPED/INVIDIOUS
    const fallbackAudioUrl = await getFallbackAudioUrl(videoId);
    if (fallbackAudioUrl) {
      console.log(`[youtubeStream] Piped/Invidious fallback won!`);
      return ffmpeg(fallbackAudioUrl)
        .audioBitrate(128)
        .toFormat('mp3')
        .on('error', (err) => console.error('[youtubeStream] ffmpeg error:', err))
        .pipe(res, { end: true });
    }

    return res.status(500).json({ success: false, error: 'All streaming attempts failed' });
  } catch (error: any) {
    console.error('[youtubeStream] Unexpected error:', error);
    if (!res.headersSent) res.status(500).end();
  }
}

export async function handleDownload(req: express.Request, res: express.Response) {
  try {
    let { videoUrl, songTitle } = req.body;

    if (!videoUrl || typeof videoUrl !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Video URL is required and must be a string / رابط الفيديو مطلوب ويجب أن يكون نصاً'
      });
    }

    if (songTitle && typeof songTitle !== 'string') {
      songTitle = '';
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
      'https://cobalt.projectsegfaut.im/',
      'https://cobalt.projectsegfaut.im/api/json',
      'https://cobalt.perennialte.ch/',
      'https://cobalt.perennialte.ch/api/json',
      'https://co.disroot.org/',
      'https://co.disroot.org/api/json',
      'https://cobalt.lule.io/',
      'https://cobalt.lule.io/api/json',
      'https://cobalt.fastness.casa/',
      'https://cobalt.fastness.casa/api/json',
      'https://cobalt.shite.xyz/',
      'https://cobalt.shite.xyz/api/json',
      'https://cobalt.astolfo.gay/',
      'https://cobalt.astolfo.gay/api/json',
      'https://cobalt.moe/',
      'https://cobalt.moe/api/json',
      'https://cobalt.razorofox.top/',
      'https://cobalt.razorofox.top/api/json',
      'https://cobalt.swm.me/',
      'https://cobalt.swm.me/api/json',
      'https://cobalt.nyx.re/',
      'https://cobalt.nyx.re/api/json',
      'https://cobalt.redway.tech/',
      'https://cobalt.redway.tech/api/json',
      'https://api.disroot.org/cobalt/',
      'https://api.disroot.org/cobalt/api/json'
    ];

    console.log(`[youtubeDownload] Triggering parallel race across ${COBALT_ENDPOINTS.length} Cobalt endpoints for: ${videoUrl}`);

    // Helper to race multiple Cobalt fetch requests
    const downloadUrl = await new Promise<string | null>((resolve) => {
      let resolved = false;
      let finishedCount = 0;
      const controllers: AbortController[] = [];

      // Timeout at 12 seconds to ensure slow conversions can finish and prevent server hangs
      const safetyTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          controllers.forEach(c => {
            try { c.abort(); } catch (e) {}
          });
          resolve(null);
        }
      }, 12000);

      COBALT_ENDPOINTS.forEach((endpoint) => {
        const controller = new AbortController();
        controllers.push(controller);

        const isV10 = !endpoint.includes('/api/json');
        const bodyPayload = isV10 ? {
          url: videoUrl,
          downloadMode: 'audio',
          audioFormat: 'mp3',
          audioBitrate: '192',
          filenamePattern: 'classic'
        } : {
          url: videoUrl,
          isAudioOnly: true,
          audioFormat: 'mp3',
          audioBitrate: '192',
          filenameStyle: 'classic'
        };

        fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          body: JSON.stringify(bodyPayload)
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
      console.log(`[youtubeDownload] Successfully obtained conversion link: ${downloadUrl}`);
      try {
        console.log(`[youtubeDownload] Streaming file from Cobalt directly to client to bypass cross-origin browser constraints...`);
        const streamResponse = await fetch(downloadUrl);
        if (streamResponse.ok && streamResponse.body) {
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.mp3`
          );
          if (streamResponse.headers.has('content-length')) {
            res.setHeader('Content-Length', streamResponse.headers.get('content-length')!);
          }
          const { Readable } = await import('stream');
          Readable.fromWeb(streamResponse.body as any).pipe(res);
          return;
        } else {
          console.warn(`[youtubeDownload] Cobalt download link returned status ${streamResponse.status}. Trying fallbacks...`);
        }
      } catch (streamErr: any) {
        console.error('[youtubeDownload] Error streaming from Cobalt URL:', streamErr);
      }
    }

    console.warn('[youtubeDownload] All parallel Cobalt endpoints failed or timed out.');

    // 2. EXTRA ROBUST FALLBACK TO PIPED AND INVIDIOUS STREAM RESOLVING
    let videoId = '';
    try {
      videoId = ytdl.getURLVideoID(videoUrl);
    } catch (e) {
      const match = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      videoId = match ? match[1] : '';
    }

    if (videoId) {
      console.log(`[youtubeDownload] Cobalt failed. Resolving direct stream URL via Piped/Invidious race for videoId: ${videoId}`);
      const fallbackAudioUrl = await getFallbackAudioUrl(videoId);
      
      if (fallbackAudioUrl) {
        console.log(`[youtubeDownload] Resolved direct stream URL: ${fallbackAudioUrl}. Transcoding with ffmpeg on-the-fly...`);
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.mp3`
        );

        return ffmpeg(fallbackAudioUrl)
          .audioBitrate(192)
          .toFormat('mp3')
          .on('start', (commandLine) => {
            console.log('[youtubeDownload] Spawned ffmpeg with command: ' + commandLine);
          })
          .on('error', (err) => {
            console.error('[youtubeDownload] Ffmpeg conversion error:', err);
            if (!res.headersSent) {
              res.status(500).json({
                success: false,
                error: `Conversion of proxy stream failed: ${err.message}`
              });
            }
          })
          .on('end', () => {
            console.log('[youtubeDownload] Successfully completed audio conversion and sending from fallback URL.');
          })
          .pipe(res, { end: true });
      }
    }

    return res.status(500).json({
      success: false,
      error: 'All parallel Cobalt and proxy endpoints failed. Please try again later. / جميع محاولات التحميل فشلت، يرجى المحاولة لاحقاً.'
    });
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

/**
 * Robust parallel racing across public Piped and Invidious instances to find a direct playable/convertible stream URL
 */
async function getFallbackAudioUrl(videoId: string): Promise<string | null> {
  const invidiousInstances = [
    "yewtu.be",
    "invidious.flokinet.to",
    "iv.melmac.space",
    "invidious.projectsegfaut.im",
    "invidious.perennialte.ch",
    "invidious.nerdvpn.de",
    "invidio.xamh.de",
    "iv.ggtyler.dev",
    "invidious.lunar.icu"
  ];

  const pipedInstances = [
    "pipedapi.kavin.rocks",
    "pipedapi.tokhmi.xyz",
    "api.piped.yt",
    "piped-api.lule.io",
    "pipedapi.adminforge.de",
    "pipedapi.astphy.com",
    "pipedapi.swg.rocks",
    "pipedapi.colby.school",
    "pipedapi.us.to"
  ];

  return new Promise<string | null>((resolve) => {
    let resolved = false;
    let finishedCount = 0;
    const controllers: AbortController[] = [];
    const totalCount = invidiousInstances.length + pipedInstances.length;

    const safetyTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        controllers.forEach(c => {
          try { c.abort(); } catch (e) {}
        });
        resolve(null);
      }
    }, 8000);

    const handleSuccess = (url: string) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(safetyTimeout);
        controllers.forEach(c => {
          try { c.abort(); } catch (e) {}
        });
        resolve(url);
      }
    };

    const handleFinally = () => {
      finishedCount++;
      if (finishedCount === totalCount && !resolved) {
        resolved = true;
        clearTimeout(safetyTimeout);
        resolve(null);
      }
    };

    // Race Invidious instances
    invidiousInstances.forEach((instance) => {
      const controller = new AbortController();
      controllers.push(controller);

      fetch(`https://${instance}/api/v1/videos/${encodeURIComponent(videoId)}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.adaptiveFormats && Array.isArray(data.adaptiveFormats)) {
            const audioFormat = data.adaptiveFormats.find((f: any) => f.type && f.type.startsWith('audio/'));
            if (audioFormat && audioFormat.url) {
              console.log(`[youtubeDownload] Audio stream found on Invidious instance: ${instance}`);
              handleSuccess(audioFormat.url);
            }
          }
        }
      })
      .catch(() => {})
      .finally(handleFinally);
    });

    // Race Piped instances
    pipedInstances.forEach((instance) => {
      const controller = new AbortController();
      controllers.push(controller);

      fetch(`https://${instance}/streams/${encodeURIComponent(videoId)}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.audioStreams && Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
            const m4aStream = data.audioStreams.find((s: any) => s.format === 'M4A') || data.audioStreams[0];
            if (m4aStream && m4aStream.url) {
              console.log(`[youtubeDownload] Audio stream found on Piped instance: ${instance}`);
              handleSuccess(m4aStream.url);
            }
          }
        }
      })
      .catch(() => {})
      .finally(handleFinally);
    });
  });
}
