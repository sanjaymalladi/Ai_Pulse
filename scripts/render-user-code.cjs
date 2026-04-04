/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition } = require("@remotion/renderer");

async function main() {
  const inputPath = process.argv[2];
  const outputLocation = process.argv[3];

  if (!inputPath || !outputLocation) {
    throw new Error("Expected input payload path and output path.");
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const renderTimeout = Number.isFinite(payload.timeoutInMilliseconds)
    ? payload.timeoutInMilliseconds
    : 180_000;
  const workspaceRoot = path.join(process.cwd(), ".tmp", "user-video-code");
  fs.mkdirSync(workspaceRoot, { recursive: true });

  const jobDir = path.join(workspaceRoot, crypto.randomUUID());
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    const entryPoint = path.join(jobDir, "UserVideoRoot.tsx");
    fs.writeFileSync(entryPoint, payload.code, "utf8");

    const serveUrl = await bundle({
      entryPoint,
      onProgress: () => undefined,
      webpackOverride: (config) => config,
      enableCaching: false,
      publicPath: null,
      rootDir: process.cwd(),
      publicDir: path.join(process.cwd(), "public"),
      onPublicDirCopyProgress: () => undefined,
      onSymlinkDetected: () => undefined,
      keyboardShortcutsEnabled: false,
      askAIEnabled: false,
      rspack: false,
      ignoreRegisterRootWarning: true,
    });

    const composition = await selectComposition({
      serveUrl,
      id: payload.compositionId,
      inputProps: payload.inputProps || {},
      timeoutInMilliseconds: renderTimeout,
    });

    await renderMedia({
      serveUrl,
      codec: "h264",
      audioCodec: "aac",
      composition,
      inputProps: payload.inputProps || {},
      outputLocation,
      overwrite: true,
      chromiumOptions: {
        disableWebSecurity: true,
      },
      timeoutInMilliseconds: Math.max(renderTimeout, 900_000),
      logLevel: "error",
    });
  } finally {
    fs.rmSync(jobDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
