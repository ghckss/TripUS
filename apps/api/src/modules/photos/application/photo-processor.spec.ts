import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { PhotoProcessor } from './photo-processor';

describe('PhotoProcessor', () => {
  const processor = new PhotoProcessor();

  it('creates bounded JPEG display derivatives while preserving the original elsewhere', async () => {
    const original = await sharp({
      create: { width: 2_400, height: 1_200, channels: 3, background: '#f36f56' },
    }).png().withMetadata({ orientation: 6 }).toBuffer();

    const result = await processor.createDerivatives(original);
    const optimized = await sharp(result.optimized).metadata();
    const thumbnail = await sharp(result.thumbnail).metadata();

    expect(optimized.format).toBe('jpeg');
    expect(optimized.width).toBeLessThanOrEqual(2_048);
    expect(optimized.orientation).toBeUndefined();
    expect(thumbnail.format).toBe('jpeg');
    expect(thumbnail.width).toBe(480);
    expect(thumbnail.height).toBe(480);
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])('supports %s', (mimeType) => {
    expect(processor.supports(mimeType)).toBe(true);
  });

  it.each(['image/heic', 'image/heif'])('rejects %s when HEVC decoding is unavailable', (mimeType) => {
    expect(processor.supports(mimeType)).toBe(false);
  });
});
