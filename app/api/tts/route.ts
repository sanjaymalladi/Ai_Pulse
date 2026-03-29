import { NextRequest } from "next/server";

const TTS_UPSTREAM = "https://sanjay.tailc61860.ts.net/tts";
const TTS_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes hard cap

// Allow up to 600s on Vercel / edge runtimes
export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const text: string = body.text ?? "";

  if (!text.trim()) {
    return new Response(JSON.stringify({ error: "Text is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- Server-Sent Events stream ---
  // Keeps the browser connection alive with ping events while the
  // (potentially 5-6 min) upstream fetch runs, then emits the audio.
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${data}\n\n`)
        );
      };

      // Ping every 5 s so Tailscale / proxies don't drop the idle connection
      const ping = setInterval(() => {
        try {
          send("ping", String(Date.now()));
        } catch {
          clearInterval(ping);
        }
      }, 5_000);

      try {
        send("status", "SYNTHESIZING");

        const upstream = await fetch(TTS_UPSTREAM, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
        });

        if (!upstream.ok) {
          send(
            "error",
            JSON.stringify({
              message: `TTS_SERVER_ERROR // HTTP ${upstream.status} ${upstream.statusText}`,
            })
          );
          controller.close();
          return;
        }

        const audioBuffer = await upstream.arrayBuffer();
        const contentType =
          upstream.headers.get("Content-Type") || "audio/wav";

        // Send audio as base64 so it travels cleanly over SSE text protocol
        const base64 = Buffer.from(audioBuffer).toString("base64");
        send("audio", JSON.stringify({ contentType, base64 }));
        send("done", "OK");
      } catch (err: any) {
        const isTimeout =
          err?.name === "TimeoutError" || err?.name === "AbortError";
        send(
          "error",
          JSON.stringify({
            message: isTimeout
              ? "TTS_TIMEOUT: synthesis exceeded 12 minutes"
              : err.message || "Proxy request failed",
          })
        );
      } finally {
        clearInterval(ping);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
