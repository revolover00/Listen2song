# listen2song

`listen2song` is a high-fidelity, production-grade full-stack music player designed for modern web browsers. It offers a fully immersive, animated listening experience featuring automated Genius Lyrics crawling, active local caching, and real-time timed subtitle (LRC) synchronization.

## Key Features

- **Automated Lyrics Search**: Crawls Genius Lyrics automatically using a secure Express.js proxy with a rate-limiting and sanitization pipeline to safeguard searches.
- **Micro-Sync Timed Karaoke (Live Sync)**: Parses LRC metadata automatically (`[mm:ss.xx]`) to highlight the active lyric in vibrant purple and fade out past lines, smoothly auto-scrolling to keep the current sentence in focus.
- **Smart ZIP & LRC Extraction**: Allows drag-and-drop or file upload of standard ZIP directories. Scans the archive internally to match MP3 tracks with local `.lrc` files first, giving user-uploaded timed subtitles priority over the internet crawler.
- **7-Day Local Storage Caching**: Keeps fetched lyrics actively cached in browser Storage for 7 days to eliminate redundant network traffic.
- **Interactive Control Box**: Full controls for play, pause, seek, volume, shuffle, loop-modes, copy lyrics to clipboard, and toggle settings.
- **Parental Advisory Badges**: Displays metadata badges for explicit content automatically.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion
- **Backend**: Express.js, `@fantox01/lyrics-scraper` (Genius Integration)
- **Bundler and Dev Pipeline**: Vite, `esbuild`, `tsx`

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the project and navigate to the root directory:
   ```bash
   npm install
   ```

2. Setup your local environment variables by copying `.env.example` as `.env` and configure accordingly.

### Running the Application

To launch both the Express backend and the Vite frontend proxy simultaneously in development mode:

```bash
npm run dev
```

The application will bind to `0.0.0.0` on port `3000` and can be opened locally in your browser.

### Building for Production

To create an optimized production bundle:

```bash
npm run build
```

This command builds the frontend static assets inside `dist/` and compiles the backend into a clean, standalone, unified server bundle inside `dist/server.cjs` using `esbuild`.

To start the production server:

```bash
npm start
```

---

## Troubleshooting

### Lyrics are not Loading
- Ensure you have an active internet connection. If offline, the player will inform you with a clear connection reminder.
- Check if your track has a valid `Artist` name. If no artist name is available, the engine will prompt you that it is searching using the song's name only for best accuracy.
- Verify that you have not exceeded the request rate limits (5 requests per minute per IP).

### Karaoke mode is not scrolling
- Automatic highlighting and central scrolling only activate if the lyrics contain timestamp markers (LRC formatting). For standard plain-text lyrics, the scrolling area remains static for easy reading.
