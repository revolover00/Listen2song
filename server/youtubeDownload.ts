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

    // 1. ATTEMPT COBALT DOWNLOAD API FIRST (Extremely reliable, bypasses YouTube's server IP blocks)
    try {
      console.log(`[youtubeDownload] Attempting Cobalt conversion for URL: ${videoUrl}`);
      const cobaltResponse = await fetch('https://api.cobalt.tools/api/json', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: videoUrl,
          audioFormat: 'mp3',
          isAudioOnly: true,
          audioBitrate: '192',
        }),
      });

      if (cobaltResponse.ok) {
        const data: any = await cobaltResponse.json();
        console.log(`[youtubeDownload] Cobalt API status:`, data.status);
        if ((data.status === 'stream' || data.status === 'redirect') && data.url) {
          console.log(`[youtubeDownload] Streaming file from Cobalt converter link: ${data.url}`);
          
          const audioStreamResponse = await fetch(data.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });

          if (audioStreamResponse.ok && audioStreamResponse.body) {
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader(
              'Content-Disposition',
              `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.mp3`
            );

            const reader = audioStreamResponse.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              res.write(value);
            }
            res.end();
            console.log('[youtubeDownload] Successfully downloaded and streamed via Cobalt API!');
            return;
          } else {
            console.warn('[youtubeDownload] Cobalt converted url fetch failed:', audioStreamResponse.status);
          }
        } else {
          console.warn('[youtubeDownload] Cobalt returned unexpected or error payload:', data);
        }
      } else {
        console.warn('[youtubeDownload] Cobalt endpoint returned connection code:', cobaltResponse.status);
      }
    } catch (cobaltErr: any) {
      console.error('[youtubeDownload] Cobalt helper conversion failed:', cobaltErr.message || cobaltErr);
    }

    // 2. FALLBACK TO YTDL-CORE + FFMPEG (Original backup stream method)
    console.log('[youtubeDownload] Proceeding with ytdl-core fallback...');
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
          error: `Error pulling stream from YouTube: ${err.message}`
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
            error: `Conversion failed: ${err.message}`
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
        error: error.message || 'An unexpected error occurred during downlaod'
      });
    }
  }
}
