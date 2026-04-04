import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";

const outputDir = path.join(process.cwd(), "public", "cache", "renders");
const tempDir = path.join(process.cwd(), ".tmp", "renders");
const renderScript = path.join(process.cwd(), "scripts", "render-user-code.cjs");

export const runtime = "nodejs";
export const maxDuration = 300;

function toPublicFilePath(publicUrl: string) {
  const cleaned = publicUrl.replace(/^\/+/, "");
  return path.join(process.cwd(), "public", cleaned);
}

function runRenderProcess(inputPath: string, outputLocation: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [renderScript, inputPath, outputLocation], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
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

function runMuxProcess({
  videoPath,
  voicePath,
  musicPath,
  outputPath,
}: {
  videoPath: string;
  voicePath?: string | null;
  musicPath?: string | null;
  outputPath: string;
}) {
  return new Promise<void>((resolve, reject) => {
    const args = ["-y", "-i", videoPath];

    if (voicePath) {
      args.push("-i", voicePath);
    }

    if (musicPath) {
      args.push("-stream_loop", "-1", "-i", musicPath);
    }

    if (voicePath && musicPath) {
      args.push(
        "-filter_complex",
        "[2:a]volume=0.18[bg];[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]",
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        outputPath,
      );
    } else if (voicePath) {
      args.push(
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-af",
        "apad",
        "-shortest",
        outputPath,
      );
    } else if (musicPath) {
      args.push(
        "-filter_complex",
        "[1:a]volume=0.18[aout]",
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        outputPath,
      );
    } else {
      args.push("-c", "copy", outputPath);
    }

    const child = spawn("ffmpeg", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg failed with code ${code}`));
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      code?: string;
      compositionId?: string;
      inputProps?: unknown;
      audioTrackUrl?: string | null;
      musicTrackUrl?: string | null;
      timeoutInMilliseconds?: number;
    };

    if (!body.code || !body.compositionId) {
      return NextResponse.json({ error: "Missing Remotion code or composition ID" }, { status: 400 });
    }

    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });

    const renderId = crypto.randomUUID();
    const rawVideoPath = path.join(outputDir, `${renderId}.raw.mp4`);
    const muxedVideoPath = path.join(outputDir, `${renderId}.mp4`);
    const inputPath = path.join(tempDir, `${renderId}.json`);

    fs.writeFileSync(
      inputPath,
      JSON.stringify(
        {
          code: body.code,
          compositionId: body.compositionId,
          inputProps: body.inputProps || {},
          timeoutInMilliseconds: Math.max(30_000, body.timeoutInMilliseconds || 180_000),
        },
        null,
        2,
      ),
      "utf8",
    );

    await runRenderProcess(inputPath, rawVideoPath);

    const voicePath = body.audioTrackUrl ? toPublicFilePath(body.audioTrackUrl) : null;
    const musicPath = body.musicTrackUrl ? toPublicFilePath(body.musicTrackUrl) : null;

    if (voicePath && !fs.existsSync(voicePath)) {
      return NextResponse.json({ error: "Voice audio track file not found" }, { status: 400 });
    }

    if (musicPath && !fs.existsSync(musicPath)) {
      return NextResponse.json({ error: "Music track file not found" }, { status: 400 });
    }

    await runMuxProcess({
      videoPath: rawVideoPath,
      voicePath,
      musicPath,
      outputPath: muxedVideoPath,
    });

    fs.rmSync(inputPath, { force: true });
    fs.rmSync(rawVideoPath, { force: true });

    return NextResponse.json({
      success: true,
      downloadUrl: `/cache/renders/${renderId}.mp4`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to render code and mux audio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
