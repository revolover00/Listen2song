export async function generateLrcFromAudio(
  audioBase64: string,
  mimeType: string,
  songTitle: string,
  artistName: string,
  plainLyrics?: string
): Promise<string> {
  throw new Error("Neural audio synchronization is currently disabled because Gemini has been removed. Please use the text-based synchronization instead! / المزامنة العصبية للصوت معطلة حالياً بسبب إزالة Gemini. يرجى استخدام المزامنة النصية.");
}

export async function fetchLyricsFromGemini(
  songTitle: string,
  artistName?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey) {
    try {
      const query = artistName ? `"${songTitle}" by ${artistName}` : `"${songTitle}"`;
      console.log(`[LrcEngine] Requesting plain lyrics with OpenRouter for fallback: ${query}`);

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
              content: "You are an expert music lyricist. Your task is to output the clean, complete plain text lyrics of the requested song. Do NOT output any conversational text, notes, links, brackets like [Verse] or [Chorus] if possible, or explanations. Keep the layout simple with one line per verse row."
            },
            {
              role: "user",
              content: `Output the original clean lyrics for: ${query}`
            }
          ],
          temperature: 0.3,
          max_tokens: 1548,
          seed: 42
        })
      });

      if (response.ok) {
        const responseData: any = await response.json();
        const parsedContent = responseData.choices?.[0]?.message?.content;
        if (parsedContent && parsedContent.trim().length > 10) {
          return parsedContent.trim();
        }
      }
    } catch (err: any) {
      console.warn(`[LrcEngine] OpenRouter fallback lyrics failed: ${err.message || err}`);
    }
  }

  throw new Error("Lyrics temporarily unavailable. Please paste your plain lyrics below manually to synchronize. / كلمات الأغنية غير متوفرة حالياً، يمكنك لصق الكلمات وتوليد الملف يدوياً.");
}

export async function generateLrcFromText(
  songTitle: string,
  artistName: string,
  plainLyrics?: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured in Secrets settings / مفتاح API لـ OpenRouter غير متوفر.");
  }

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
    } as any)
  });

  if (response.ok) {
    const responseData: any = await response.json();
    let lrcOutput = responseData.choices?.[0]?.message?.content;
    if (lrcOutput) {
      return lrcOutput.replace(/^```[a-zA-Z0-9]*\r?\n/gm, "").replace(/```$/gm, "").trim();
    }
  }

  throw new Error("Failed to synchronize lyrics using OpenRouter. Please try again later.");
}
