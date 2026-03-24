import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Config } from "./upload.config.js";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export class UploadService {
  async uploadImage(file: {
    buffer: Buffer;
    mimetype: string;
    size: number;
  }): Promise<string> {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      throw new Error("Invalid file type. Allowed: jpeg, png, webp");
    }
    if (file.size > MAX_SIZE) {
      throw new Error("File too large. Maximum: 5MB");
    }

    const ext = MIME_TO_EXT[file.mimetype] ?? "jpg";
    const key = `${randomUUID()}.${ext}`;

    const r2 = getR2Client();
    const { bucketName, publicUrl } = getR2Config();

    await r2.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return `${publicUrl}/${key}`;
  }
}
