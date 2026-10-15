import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

// Works with AWS S3, Cloudflare R2, Backblaze B2, Supabase Storage, etc.
// Only the endpoint, region and credentials change between providers.
const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
  forcePathStyle: Boolean(env.S3_ENDPOINT),
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

export const uploadFile = async (
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> => {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
};

export const deleteFile = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
};

// The bucket stays private; the browser gets a temporary signed link
export const getSignedFileUrl = async (
  key: string,
  expiresIn: number = env.SIGNED_URL_EXPIRES_IN,
): Promise<string> =>
  getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: "inline",
    }),
    { expiresIn },
  );
