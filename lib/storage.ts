import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

// S3-compatible object storage — works against real AWS S3, or any
// S3-compatible endpoint (Cloudflare R2, MinIO, Cloudinary's S3 gateway) via
// S3_ENDPOINT. Optional: every caller checks isStorageConfigured() first and
// degrades gracefully (upload UI hidden/disabled) when unset — same pattern
// as every other optional provider in this project. No real bucket is
// reachable from this sandbox, so this is written correctly against the AWS
// SDK's documented API but hasn't been exercised against a real endpoint.
export function isStorageConfigured(): boolean {
  return !!(
    env.S3_BUCKET &&
    env.S3_REGION &&
    env.S3_ACCESS_KEY_ID &&
    env.S3_SECRET_ACCESS_KEY &&
    env.S3_PUBLIC_URL
  );
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
      // Only set for non-AWS S3-compatible endpoints (R2/MinIO/etc).
      ...(env.S3_ENDPOINT
        ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true }
        : {}),
    });
  }
  return client;
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error("Object storage is not configured.");
  }

  await getClient().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${env.S3_PUBLIC_URL}/${key}`;
}
