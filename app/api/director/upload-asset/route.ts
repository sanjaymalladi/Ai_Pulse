import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const uploadDir = path.join(process.cwd(), "public", "cache", "user-assets");

export const runtime = "nodejs";
export const maxDuration = 60;

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

function extForType(type: string, originalName?: string) {
  if (type.includes("png")) return ".png";
  if (type.includes("jpeg")) return ".jpg";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  if (type.includes("mp4")) return ".mp4";
  if (originalName?.includes(".")) return path.extname(originalName);
  return ".bin";
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
      url: `/cache/user-assets/${filename}`,
      mimeType: file.type,
      size: file.size,
      filename,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to upload asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
