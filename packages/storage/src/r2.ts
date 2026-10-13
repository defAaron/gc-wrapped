import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStore } from "./types";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function createR2Client(): S3Client {
  const accountId = required("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export function createR2ObjectStore(client = createR2Client(), bucket = required("R2_BUCKET")): ObjectStore {
  return {
    async put(key, body) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
    },
    async get(key) {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!out.Body) return null;
        return Buffer.from(await out.Body.transformToByteArray());
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        if (name === "NoSuchKey" || name === "NotFound") return null;
        throw error;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
    async deletePrefix(prefix) {
      const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
      let token: string | undefined;
      do {
        const listed = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: normalized,
            ...(token ? { ContinuationToken: token } : {}),
          }),
        );
        const keys = (listed.Contents ?? []).flatMap((item) => (item.Key ? [{ Key: item.Key }] : []));
        if (keys.length > 0) {
          await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
        }
        token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (token);
    },
    async signedGetUrl(key, ttlSeconds) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: ttlSeconds });
    },
  };
}
