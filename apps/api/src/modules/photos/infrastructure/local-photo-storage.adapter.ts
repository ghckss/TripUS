import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PhotoStoragePort, PhotoUploadTarget } from '../domain/photo-storage.port';

@Injectable()
export class LocalPhotoStorageAdapter implements PhotoStoragePort {
  private readonly root: string;
  private readonly publicUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.root = resolve(config.getOrThrow<string>('PHOTO_LOCAL_DIRECTORY'));
    this.publicUrl = config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/$/, '');
  }

  createUploadTarget(input: { key: string; mimeType: string; fallbackPath: string }): Promise<PhotoUploadTarget> {
    return Promise.resolve({ url: `${this.publicUrl}${input.fallbackPath}`, method: 'PUT', headers: { 'content-type': input.mimeType } });
  }

  createDownloadUrl(input: { key: string; fallbackPath: string }): Promise<string> {
    return Promise.resolve(`${this.publicUrl}${input.fallbackPath}`);
  }

  read(key: string): Promise<Uint8Array> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async write(key: string, body: Uint8Array): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    const relativePath = relative(this.root, path);
    if (relativePath.startsWith('..') || resolve(path) === resolve(this.root)) {
      throw new Error('Photo storage key is outside the configured directory');
    }
    return path;
  }
}
