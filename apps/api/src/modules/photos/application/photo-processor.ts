import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

@Injectable()
export class PhotoProcessor {
  async createDerivatives(original: Uint8Array): Promise<{ optimized: Uint8Array; thumbnail: Uint8Array }> {
    const optimized = await sharp(original).rotate().resize({ width: 2_048, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const thumbnail = await sharp(original).rotate().resize({ width: 480, height: 480, fit: 'cover' }).jpeg({ quality: 75 }).toBuffer();
    return { optimized, thumbnail };
  }
}
