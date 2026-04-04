import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const uploadDir = path.join(process.cwd(), "public", "cache", "music");

export const runtime = "nodejs";
export const maxDuration = 120;

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

function extForType(type: string, originalName?: string) {
  if (type.includes("mpeg")) return ".mp3";
  if (type.includes("wav")) return ".wav";
  if (type.includes("aac")) return ".aac";
  if (type.includes("ogg")) return ".ogg";
  if (originalName?.includes(".")) return path.extname(originalName);
  return ".mp3";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    ensureUploadDir();
    const ext = extForType(file.type, file.name);
    const filename = `${crypto.randomUUID()}${ext}`;
    const absolutePath = path.join(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(absolutePath, buffer);

    return NextResponse.json({
      url: `/cache/music/${filename}`,
      mimeType: file.type,
      filename,
      size: file.size,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload music";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
