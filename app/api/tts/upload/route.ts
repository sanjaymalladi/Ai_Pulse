import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const uploadDir = path.join(process.cwd(), "public", "cache", "tts");

export const runtime = "nodejs";
export const maxDuration = 60;

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    ensureUploadDir();
    const filename = `stitched_${crypto.randomUUID()}.wav`;
    const absolutePath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(absolutePath, buffer);

    return NextResponse.json({
      url: `/cache/tts/${filename}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload stitched TTS";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
