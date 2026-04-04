import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";

const outputDir = path.join(process.cwd(), "public", "cache", "renders");

export const runtime = "nodejs";
export const maxDuration = 300;

function toPublicFilePath(publicUrl: string) {
  const cleaned = publicUrl.replace(/^\/+/, "");
  return path.join(process.cwd(), "public", cleaned);
}

function runFfmpeg({
  videoPath,
  audioPath,
  musicPath,
  outputPath,
}: {
  videoPath: string;
  audioPath: string;
  musicPath?: string | null;
  outputPath: string;
}) {
  return new Promise<void>((resolve, reject) => {
    const args = ["-y", "-i", videoPath, "-i", audioPath];

    if (musicPath) {
      args.push("-stream_loop", "-1", "-i", musicPath);
      args.push(
        "-filter_complex",
        "[2:a]volume=0.16[bg];[1:a][bg]amix=inputs=2:duration=first:dropout_transition=2[aout]",
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-af",
        "apad",
        "-shortest",
        outputPath,
      );
    } else {
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
      uploadedVideoUrl?: string;
      audioTrackUrl?: string;
      musicTrackUrl?: string | null;
    };

    if (!body.uploadedVideoUrl || !body.audioTrackUrl) {
      return NextResponse.json({ error: "Missing uploaded video or audio track" }, { status: 400 });
    }

    const videoPath = toPublicFilePath(body.uploadedVideoUrl);
    const audioPath = toPublicFilePath(body.audioTrackUrl);
    const musicPath = body.musicTrackUrl ? toPublicFilePath(body.musicTrackUrl) : null;

    if (!fs.existsSync(videoPath)) {
      return NextResponse.json({ error: "Uploaded video file not found" }, { status: 400 });
    }

    if (!fs.existsSync(audioPath)) {
      return NextResponse.json({ error: "Audio track file not found" }, { status: 400 });
    }

    if (musicPath && !fs.existsSync(musicPath)) {
      return NextResponse.json({ error: "Music track file not found" }, { status: 400 });
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const renderId = crypto.randomUUID();
    const outputPath = path.join(outputDir, `${renderId}.mp4`);

    await runFfmpeg({
      videoPath,
      audioPath,
      musicPath,
      outputPath,
    });

    return NextResponse.json({
      success: true,
      downloadUrl: `/cache/renders/${renderId}.mp4`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mux uploaded video with audio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
