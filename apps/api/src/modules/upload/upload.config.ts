import { S3Client } from "@aws-sdk/client-s3";
import { loadEnv } from "@tatame/config";

let client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (client) return client;

  const env = loadEnv();
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials not configured");
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

export function getR2Config() {
  const env = loadEnv();
  if (!env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) {
    throw new Error("R2_BUCKET_NAME and R2_PUBLIC_URL must be configured");
  }
  return {
    bucketName: env.R2_BUCKET_NAME,
    publicUrl: env.R2_PUBLIC_URL,
  };
}
