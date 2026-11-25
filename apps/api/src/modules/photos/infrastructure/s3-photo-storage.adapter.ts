import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PhotoStoragePort, PhotoUploadTarget } from '../domain/photo-storage.port';

@Injectable()
export class S3PhotoStorageAdapter implements PhotoStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('PHOTO_S3_BUCKET');
    const endpoint = config.get<string>('PHOTO_S3_ENDPOINT');
    this.client = new S3Client({
      region: config.getOrThrow<string>('AWS_REGION'),
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      maxAttempts: 3,
      requestHandler: { connectionTimeout: 5_000, requestTimeout: 15_000 },
    });
  }

  async createUploadTarget(input: { key: string; mimeType: string }): Promise<PhotoUploadTarget> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: input.key, ContentType: input.mimeType });
    const url = await getSignedUrl(this.client, command, { expiresIn: 600, signableHeaders: new Set(['content-type']) });
    return { url, method: 'PUT', headers: { 'content-type': input.mimeType } };
  }

  createDownloadUrl(input: { key: string }): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: input.key }), { expiresIn: 3_600 });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async read(key: string): Promise<Uint8Array> {
    const output = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!output.Body) throw new Error('Photo object body is missing');
    return output.Body.transformToByteArray();
  }

  async write(key: string, body: Uint8Array, mimeType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: mimeType }));
  }
}
