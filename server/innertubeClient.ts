import { Innertube, UniversalCache } from 'youtubei.js';
import path from 'path';
import os from 'os';

let client: Innertube | null = null;

export async function getInnertube() {
  if (!client) {
    try {
      const cacheDir = path.join(os.tmpdir(), 'youtubei-cache');
      client = await Innertube.create({
        cache: new UniversalCache(true, cacheDir),
        retrieve_player: true
      });
      console.log('[Innertube] Client created successfully');
    } catch (err) {
      console.error('[Innertube] Failed to create client:', err);
      client = await Innertube.create();
    }
  }
  return client;
}
