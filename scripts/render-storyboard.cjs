/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition } = require("@remotion/renderer");

const REMOTION_COMPOSITION_ID = "StoryboardExport";
const entryPoint = path.join(process.cwd(), "app", "remotion", "renderEntry.ts");

let bundlePromise = null;

async function getServeUrl() {
  if (!bundlePromise) {
    bundlePromise = bundle({
      entryPoint,
      onProgress: () => undefined,
      webpackOverride: (config) => config,
      enableCaching: true,
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
  }

  return bundlePromise;
}

async function main() {
  const inputPath = process.argv[2];
  const outputLocation = process.argv[3];

  if (!inputPath || !outputLocation) {
    throw new Error("Expected input payload path and output path.");
  }

  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const serveUrl = await getServeUrl();
  const inputProps = {
    videoPlan: payload.videoPlan,
    audioTrackUrl: payload.audioTrackUrl || null,
  };

  const composition = await selectComposition({
    serveUrl,
    id: REMOTION_COMPOSITION_ID,
    inputProps,
  });

  await renderMedia({
    serveUrl,
    codec: "h264",
    audioCodec: "aac",
    composition,
    inputProps,
    outputLocation,
    overwrite: true,
    chromiumOptions: {
      disableWebSecurity: true,
    },
    timeoutInMilliseconds: 900_000,
    logLevel: "error",
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
