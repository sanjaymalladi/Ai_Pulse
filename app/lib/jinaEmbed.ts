import { l2Normalize } from "./viralCluster";

const JINA_EMBED_URL = "https://api.jina.ai/v1/embeddings";

const DEFAULT_MODEL = "jina-embeddings-v5-text-small";
const DEFAULT_TASK = "retrieval.query";

export type JinaEmbedOptions = {
  apiKey: string;
  /** e.g. jina-embeddings-v5-text-small */
  model?: string;
  /** e.g. retrieval.query — use the same task for all inputs (symmetric clustering). */
  task?: string;
  /** Texts per request (stay within Jina limits). */
  chunkSize?: number;
};

function parseEmbeddingsResponse(data: unknown): number[][] {
  if (!data || typeof data !== "object") return [];
  const root = data as {
    data?: Array<{
      index?: number;
      embedding?: number[];
      embedding_vector?: number[];
    }>;
  };
  if (!Array.isArray(root.data)) return [];
  const rows = [...root.data].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );
  return rows.map((row) => {
    const v = row.embedding ?? row.embedding_vector;
    return Array.isArray(v) ? v : [];
  });
}

/**
 * Embed many strings via Jina Embeddings API (batched); L2-normalizes each vector for cosine = dot product.
 */
export async function embedTextsJina(
  texts: string[],
  options: JinaEmbedOptions
): Promise<number[][]> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new Error("JINA_API_KEY is missing or empty");
  }

  const model = options.model?.trim() || DEFAULT_MODEL;
  const task = options.task?.trim() || DEFAULT_TASK;
  const chunkSize = Math.max(1, Math.min(128, options.chunkSize ?? 64));
  const out: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += chunkSize) {
    const input = texts.slice(offset, offset + chunkSize);

    const res = await fetch(JINA_EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        task,
        normalized: true,
        embedding_type: "float",
        input,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`JINA_EMBED ${res.status}: ${errText || res.statusText}`);
    }

    const raw = parseEmbeddingsResponse(await res.json());
    if (raw.length !== input.length) {
      throw new Error(
        `JINA_EMBED length mismatch: expected ${input.length}, got ${raw.length}`
      );
    }
    for (const v of raw) {
      if (v.length === 0) {
        throw new Error("JINA_EMBED empty embedding vector");
      }
      out.push(l2Normalize(v));
    }
  }

  return out;
}

export function buildEmbedText(
  title: string,
  description: string | undefined,
  useDescription: boolean
): string {
  const t = title.trim() || "untitled";
  if (!useDescription || !description?.trim()) return t;
  const snippet = description.replace(/<[^>]+>/g, " ").slice(0, 200).trim();
  return snippet ? `${t}\n${snippet}` : t;
}
