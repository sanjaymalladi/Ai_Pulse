import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { isVideoPlan } from "@/app/lib/videoPlan/schema";

const outputDir = path.join(process.cwd(), "public", "cache", "renders");
const tempDir = path.join(process.cwd(), ".tmp", "renders");
const renderScript = path.join(process.cwd(), "scripts", "render-storyboard.cjs");

export const maxDuration = 900;
export const runtime = "nodejs";

function runRenderProcess(inputPath: string, outputLocation: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [renderScript, inputPath, outputLocation], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    child.stdout.on("data", () => undefined);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `Render process failed with code ${code}`));
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      videoPlan?: unknown;
      audioTrackUrl?: string | null;
    };

    if (!isVideoPlan(body.videoPlan)) {
      return NextResponse.json({ error: "Invalid video plan" }, { status: 400 });
    }

    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });
    const renderId = crypto.randomUUID();
    const outputLocation = path.join(outputDir, `${renderId}.mp4`);
    const inputPath = path.join(tempDir, `${renderId}.json`);

    fs.writeFileSync(
      inputPath,
      JSON.stringify(
        {
          videoPlan: body.videoPlan,
          audioTrackUrl: body.audioTrackUrl || null,
        },
        null,
        2,
      ),
      "utf8",
    );

    await runRenderProcess(inputPath, outputLocation);
    fs.rmSync(inputPath, { force: true });

    return NextResponse.json({
      success: true,
      renderId,
      downloadUrl: `/cache/renders/${renderId}.mp4`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export video";
    console.error("Video export failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
