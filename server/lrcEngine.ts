import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured in Secrets settings / مفتاح API لـ Gemini غير متوفر.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  }
  return aiClient;
}

export async function generateLrcFromAudio(
  audioBase64: string,
  mimeType: string,
  songTitle: string,
  artistName: string,
  plainLyrics?: string
): Promise<string> {
  const systemInstruction = `You are an elite musical audio transcriber and subtitle synchronizer.
Your ONLY task is to listen to the provided audio file and generate a highly accurate, fully detailed LRC file format containing synchronized karaoke lyrics with millisecond/centisecond precision (format: [MM:SS.xx]).
Rules:
1. Transcribe the vocal lines EXACTLY as sung.
2. The timestamps [MM:SS.xx] must EXACTLY match the moment each row/line is sung in the audio.
3. Keep instrumental delay intervals.
4. Output ONLY valid LRC lines. No markdown code blocks, metadata, introductory or ending notes.
5. Captures every verse and chorus properly.
6. Use original language (e.g., Arabic text if Arabic vocal is sung).`;

  const contents: any[] = [{ inlineData: { data: audioBase64, mimeType: mimeType || "audio/mp3" } }];

  let promptText = `Analyze and transcribe this music audio into precise LRC live synchronizer lyrics for: "${songTitle}" by artist: "${artistName || 'Unknown'}".`;
  if (plainLyrics && plainLyrics.trim()) {
    promptText += `\n\nCRITICAL CONTEXT: Align and synchronize these exact sentences with the vocal track. Preserve this phrasing precisely:\n${plainLyrics}`;
  } else {
    promptText += `\n\nListen carefully to the vocal tracking and print each line with its perfect timeline timestamp. Do not guess or skip.`;
  }

  contents.push({ text: promptText });

  console.log(`[LrcEngine] Querying gemini-2.0-flash (${Math.round(audioBase64.length / 1024)} KB)`);
  const response = await getAiClient().models.generateContent({
    model: "gemini-2.0-flash",
    contents,
    config: { systemInstruction, temperature: 0.15 }
  });

  let output = response.text;
  if (!output) throw new Error("Empty response received from Gemini.");
  
  return output.replace(/^```[a-zA-Z0-9]*\n?/gm, "").replace(/```$/gm, "").trim();
}

export async function fetchLyricsFromGemini(
  songTitle: string,
  artistName?: string
): Promise<string> {
  const systemInstruction = `You are an expert music lyricist. Your task is to output the clean, complete plain text lyrics of the requested song. Do NOT output any conversational text, notes, links, brackets like [Verse] or [Chorus] if possible, or explanations. Keep the layout simple with one line per verse row. Translate or preserve non-English titles accordingly.`;
  const promptText = artistName
    ? `Output the original clean lyrics for the song: "${songTitle}" by "${artistName}"`
    : `Output the original clean lyrics for the song: "${songTitle}"`;

  console.log(`[LrcEngine] Fetching plain lyrics via Gemini fallback for: "${songTitle}"`);
  const response = await getAiClient().models.generateContent({
    model: "gemini-2.0-flash",
    contents: promptText,
    config: { systemInstruction, temperature: 0.3 }
  });

  const output = response.text;
  if (!output) throw new Error("Empty response received from Gemini.");
  return output.trim();
}

export async function generateLrcFromText(
  songTitle: string,
  artistName: string,
  plainLyrics?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  let successLrc: string | null = null;
  
  if (apiKey) {
    try {
      console.log(`[LrcEngine] Text-aligning via OpenRouter: "${songTitle}" - "${artistName}"`);
      let promptContent = "";
      if (plainLyrics && plainLyrics.trim()) {
        promptContent = `Generate an LRC file for the song: "${songTitle}" by: "${artistName || 'Unknown'}"
Here are the plain text lyrics to align and synchronize:
${plainLyrics}
Guidelines:
- Align these exact lyrics with highly accurate estimated timings.
- DO NOT change or replace the lyrics under any circumstances.`;
      } else {
        promptContent = `Search in your database for "${songTitle}" by "${artistName || 'Unknown'}".
Then, generate a highly synchronized LRC file with estimated timestamps [MM:SS.xx] for every single lyric line.
Ensure you map the correct song. DO NOT mix it up with other songs of similar names.`;
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://listen2song.ai",
          "X-Title": "listen2song Music Player"
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
          messages: [
            {
              role: "system",
              content: `You are an elite lyric synchronizer. Your output MUST be a valid LRC formatted text containing accurate chronological timestamps ([MM:SS.xx]) for each line.
Rules:
- If plain lyrics are provided, synchronize them EXACTLY as provided. Do NOT change words.
- Timings must grow chronologically.
- Output ONLY the raw LRC content. No markdown formatting, no explanations, and no ending credits.`
            },
            { role: "user", content: promptContent }
          ],
          temperature: 0.15,
          max_tokens: 4096,
          top_p: 0.9,
          seed: 42,
          reasoning: { enabled: true }
        })
      });

      if (response.ok) {
        const responseData: any = await response.json();
        let lrcOutput = responseData.choices?.[0]?.message?.content;
        if (lrcOutput) {
          successLrc = lrcOutput.replace(/^```[a-zA-Z0-9]*\r?\n/gm, "").replace(/```$/gm, "").trim();
        }
      } else {
        console.warn(`OpenRouter alignment failed with status URL: ${response.status}. Trying Gemini fallback...`);
      }
    } catch (err: any) {
      console.warn(`[LrcEngine] OpenRouter align failed: ${err.message || err}. Trying Gemini fallback...`);
    }
  }

  if (successLrc) {
    return successLrc;
  }

  // Fallback to Gemini 2.0
  console.log(`[LrcEngine] Text-aligning via Gemini 2.0: "${songTitle}" - "${artistName}"`);
  const systemInstruction = `You are an elite lyric synchronizer. Your output MUST be a valid LRC formatted text containing accurate chronological timestamps ([MM:SS.xx]) for each line.
Rules:
- If plain lyrics are provided, synchronize them EXACTLY as provided. Do NOT change words.
- Timings must grow chronologically starting at [00:00.00] through the end of the song.
- Output ONLY the raw LRC content. No markdown formatting, no explanations, no HTML tags, and no ending credits.`;

  let promptContent = "";
  if (plainLyrics && plainLyrics.trim()) {
    promptContent = `Generate an LRC file for the song: "${songTitle}" by: "${artistName || 'Unknown'}"
Here are the plain text lyrics to align and synchronize:
${plainLyrics}
Guidelines:
- Align these exact lyrics with highly accurate estimated timings. Every line must have a timestamp.
- DO NOT change or replace the lyrics.`;
  } else {
    promptContent = `Generate a highly synchronized LRC file with estimated timestamps [MM:SS.xx] for every single lyric line of: "${songTitle}" by "${artistName || 'Unknown'}".`;
  }

  const response = await getAiClient().models.generateContent({
    model: "gemini-2.0-flash",
    contents: promptContent,
    config: { systemInstruction, temperature: 0.15 }
  });

  const output = response.text;
  if (!output) throw new Error("Empty response received from Gemini fallback.");
  return output.replace(/^```[a-zA-Z0-9]*\r?\n/gm, "").replace(/```$/gm, "").trim();
}
