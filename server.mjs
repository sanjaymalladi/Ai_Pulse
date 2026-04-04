/**
 * Custom HTTP server so we can disable Node's default 5-minute request timeout.
 * Long-running routes (e.g. /api/tts SSE proxy ~5+ min) otherwise get the socket
 * destroyed at exactly 300s — the browser shows "fetch failed" while Next may
 * still log POST 200 when the handler finishes slightly later.
 */
import http from "http";
import { parse } from "url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = Number(process.env.PORT) || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl).catch((err) => {
      console.error("Request handler error", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Internal Server Error");
      }
    });
  });

  // Node 18+ default is 300000 ms — too short for multi-minute TTS + SSE.
  server.requestTimeout = 0;
  server.headersTimeout = 0;

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
