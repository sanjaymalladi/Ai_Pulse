'use server';

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';


export interface Article {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
}

const RSS_URL = "https://rss-feed-aggrigator.onrender.com/rss";

// Helper strictly for server side
function extractSource(link: string): string {
  try {
    if (link && link !== "#") {
      const url = new URL(link);
      return url.hostname.replace('www.', '').toUpperCase();
    }
  } catch (e) {
    // ignore
  }
  return "UNKNOWN_NODE";
}

export async function fetchFeedsAction(): Promise<Article[]> {
  try {
    const res = await fetch(RSS_URL, { next: { revalidate: 300 } }); // Cache for 5 mins
    if (!res.ok) throw new Error("Fetch failed");
    
    const xmlText = await res.text();
    // Since DOMParser is not available in Node, we will use a raw regex/string split approach
    // or we'd need a package like rss-parser. 
    // For a lightweight approach without installing packages, regex works for this exact feed structure.
    
    const items = xmlText.split('<item>').slice(1);
    const articles: Article[] = items.map((item, index) => {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
      const title = titleMatch ? titleMatch[1] : "UNTITLED_RECORD";
      
      const linkMatch = item.match(/<link>(.*?)<\/link>/);
      const link = linkMatch ? linkMatch[1] : "#";
      
      const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || item.match(/<description>([\s\S]*?)<\/description>/);
      const description = descMatch ? descMatch[1] : "ERR_NO_DATA";
      
      const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
      const pubDate = pubDateMatch ? pubDateMatch[1] : new Date().toISOString();
      
      const guidMatch = item.match(/<guid(?:[^>]*)>(.*?)<\/guid>/);
      const guid = guidMatch ? guidMatch[1] : String(index);

      return {
        id: guid,
        title,
        link,
        description,
        pubDate: new Date(pubDate).toISOString(),
        source: extractSource(link)
      };
    });

    // Sort descending
    articles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    
    return articles;
  } catch (e) {
    console.error("RSS fetch error", e);
    return [];
  }
}

export async function pickViralArticleAction(articles: Article[]): Promise<Article | null> {
  // ORIGINAL LLM LOGIC
  if (!articles || articles.length === 0) return null;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OpenRouter API Key is missing in env");
    }

    const articlesToAnalyze = articles.map(a => `ID: ${a.id}\nTitle: ${a.title}`).join('\n');

    const promptText = `I have a list of recent news articles. Please pick the SINGLE most "viral-worthy" article from this list.
CRITICAL: You must specifically prioritize articles in the AI (Artificial Intelligence) category, such as major model releases, breakthroughs, or trending AI topics.
Return strictly the exact ID string of the chosen article. No explanation, no markdown, no quotes, just the pure ID string.

Articles:
${articlesToAnalyze}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "stepfun/step-3.5-flash:free",
        messages: [{ role: "user", content: promptText }],
        temperature: 0.5
      })
    });

    if (!response.ok) throw new Error("API call failed: " + response.statusText);
    
    const data = await response.json();
    let content = data.choices[0]?.message?.content || "";
    let resultId = content.trim().replace(/^['"]|['"]$/g, '');
    
    let selectedArticle = articles.find(a => a.id === resultId);
    if (!selectedArticle) {
      selectedArticle = articles.find(a => resultId.includes(a.id));
    }

    return selectedArticle || null;
  } catch (err) {
    console.error("Viral detect error:", err);
    throw err;
  }
}

export async function fetchFullArticleAction(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1 Googlebot/2.1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const doc = new JSDOM(html, { url });
    
    let reader = new Readability(doc.window.document);
    let article = reader.parse();

    return article ? article : null;
  } catch (e: any) {
    console.error("Failed to fetch full article", e);
    return null;
  }
}

export async function generateScriptAction(articleText: string): Promise<string | null> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OpenRouter API Key is missing in env");
    }

    const systemPrompt = `You are a script writer for a short-form AI and tech news channel. Scripts are published as 60-second vertical videos for Instagram Reels and YouTube Shorts.

## Voice & Persona
Write as a sharp, opinionated tech insider — not a journalist neutrally reporting facts, but a practitioner with a real point of view. The audience is curious, ambitious, and plugged into the AI/startup world. Speak to them as peers, not students. Confident. Occasionally personal. Never preachy.

## Script Structure
1. **Hook** (1–2 sentences): Open with a named person, company, model, or product that just did something notable. Create immediate "wait, what?" energy. Never open with context-setting or "in this video."
2. **The What** (3–5 sentences): Explain what actually happened. Ground it in specifics — model names, dollar figures, parameter counts, product features, company names. Make the unfamiliar feel real.
3. **The Pivot** (1–2 sentences): Reframe with a "but here's the thing" turn. Signal that the obvious read isn't the whole story. Use transitions like: "But that's not even the impressive part", "Here's the twist", "And here's where it gets interesting", "Which does make you wonder."
4. **The Real Takeaway** (2–4 sentences): Deliver the actual insight — what this signals, what it means for the audience, what to do or think about it. This is where your opinion lives. Be direct. No hedging.
5. **Close** (1 sentence, optional): A call to action, a provocative lingering thought, or a personal stake. Never summarize what you just said.

## Style Rules
- **Rhythm**: Alternate short punchy sentences with longer explanatory ones. Never stack more than 2 long sentences in a row.
- **Concrete always**: Replace every vague claim with a number, name, or specific detail. "A lot of data" → "thousands of data points, every single minute."
- **The ellipsis pause**: Use "..." once per script for a single dramatic beat on the most surprising claim.
- **Contrast pairs**: Frame insights as contrasts — who wins vs. who loses, what's obvious vs. what's real, hype vs. reality.
- **Personal inserts**: At least one first-person opinion or presence. ("Here's what I actually think", "I'll see you there", "Which does make you wonder.")
- **Parenthetical nuance**: Use (parentheses) to add a quick aside without breaking pace.
- **No filler**: Cut "basically", "essentially", "it's worth noting", and all throat-clearing openers.
- **Exclamation marks**: Maximum one per script. Only when the energy genuinely demands it.
- **Word count**: 150–200 words. Every sentence earns its place.

## Tone Calibration by Story Type
- **Model/product launch**: Lead with capability, ground in specs, end with what it means for regular people or builders.
- **Industry news** (funding, acquisitions, policy): Lead with the surprising fact, explain the "why now", end with the signal it sends.
- **Jobs/society/AI impact**: Lead with the provocative claim, add nuance, end with a practical or philosophical reframe — never doomer, never naive.
- **Startup/founder stories**: Lead with the product or traction number, tell the "weird idea that works" arc, end with the larger pattern it represents.

## Hard Rules
- No generic AI hype words: "revolutionary", "game-changing", "groundbreaking", "the future is here"
- No passive voice
- No ending on a throwaway rhetorical question
- No summarizing the script in the final line
- Do not start consecutive sentences with the same word
- Plain prose only — no headers, bullets, or stage directions
- Write exactly as it will be spoken aloud
- OUTPUT ONLY THE SCRIPT TEXT. Do not include any introductory text, concluding text, markdown formatting, or explanations. Just the raw script.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "stepfun/step-3.5-flash:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write a 60-second video script based on the following article: \n\n${articleText}` }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) throw new Error("API call failed: " + response.statusText);
    
    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (err) {
    console.error("Script generation error:", err);
    throw err;
  }
}

