import { describe, expect, it, vi } from 'vitest';

import { PhotosService } from './photos.service';

describe('PhotosService', () => {
  it('rejects a virtual itinerary boundary before querying the UUID column', async () => {
    const photos = { create: vi.fn(), delete: vi.fn(), save: vi.fn() };
    const trips = { findOneBy: vi.fn().mockResolvedValue({ id: '10000000-0000-4000-8000-000000000001' }) };
    const itineraryItems = { findOneBy: vi.fn() };
    const storage = { createUploadTarget: vi.fn() };
    const processor = { supports: vi.fn().mockReturnValue(true), createDerivatives: vi.fn() };
    const identity = { getCurrentUserId: vi.fn().mockReturnValue('20000000-0000-4000-8000-000000000001') };
    const service = new PhotosService(
      photos as never,
      trips as never,
      itineraryItems as never,
      storage as never,
      processor,
      identity,
    );

    await expect(service.createUpload('10000000-0000-4000-8000-000000000001', {
      itineraryItemId: 'boundary:start_point:10000000-0000-4000-8000-000000000001',
      mimeType: 'image/jpeg',
      byteSize: 1,
      filename: 'photo.jpg',
    })).rejects.toMatchObject({
      response: { code: 'INVALID_ITINERARY_ITEM_ID' },
      status: 400,
    });
    expect(itineraryItems.findOneBy).not.toHaveBeenCalled();
    expect(photos.save).not.toHaveBeenCalled();
    expect(storage.createUploadTarget).not.toHaveBeenCalled();
  });

  it('rejects photo formats that the active processor cannot decode before creating an upload', async () => {
    const photos = { create: vi.fn(), delete: vi.fn(), save: vi.fn() };
    const trips = { findOneBy: vi.fn().mockResolvedValue({ id: '10000000-0000-4000-8000-000000000001' }) };
    const itineraryItems = { findOneBy: vi.fn() };
    const storage = { createUploadTarget: vi.fn() };
    const processor = { supports: vi.fn().mockReturnValue(false), createDerivatives: vi.fn() };
    const identity = { getCurrentUserId: vi.fn().mockReturnValue('20000000-0000-4000-8000-000000000001') };
    const service = new PhotosService(photos as never, trips as never, itineraryItems as never, storage as never, processor, identity);

    await expect(service.createUpload('10000000-0000-4000-8000-000000000001', {
      itineraryItemId: '30000000-0000-4000-8000-000000000001',
      mimeType: 'image/heic',
      byteSize: 1,
      filename: 'photo.heic',
    })).rejects.toMatchObject({ response: { code: 'PHOTO_FORMAT_UNSUPPORTED' }, status: 400 });
    expect(itineraryItems.findOneBy).not.toHaveBeenCalled();
    expect(photos.save).not.toHaveBeenCalled();
    expect(storage.createUploadTarget).not.toHaveBeenCalled();
  });

  it('allows only one active or ready photo for the same saved place', async () => {
    const query = {
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getExists: vi.fn().mockResolvedValue(true),
    };
    const photos = { create: vi.fn(), createQueryBuilder: vi.fn().mockReturnValue(query), delete: vi.fn(), save: vi.fn() };
    const trips = { findOneBy: vi.fn().mockResolvedValue({ id: '10000000-0000-4000-8000-000000000001' }) };
    const itineraryItems = { findOneBy: vi.fn().mockResolvedValue({ id: '30000000-0000-4000-8000-000000000001', savedPlaceId: '40000000-0000-4000-8000-000000000001' }) };
    const storage = { createUploadTarget: vi.fn() };
    const processor = { supports: vi.fn().mockReturnValue(true), createDerivatives: vi.fn() };
    const identity = { getCurrentUserId: vi.fn().mockReturnValue('20000000-0000-4000-8000-000000000001') };
    const service = new PhotosService(photos as never, trips as never, itineraryItems as never, storage as never, processor, identity);

    await expect(service.createUpload('10000000-0000-4000-8000-000000000001', {
      itineraryItemId: '30000000-0000-4000-8000-000000000001',
      mimeType: 'image/jpeg',
      byteSize: 1,
      filename: 'photo.jpg',
    })).rejects.toMatchObject({ response: { code: 'PLACE_PHOTO_LIMIT_REACHED' }, status: 409 });
    expect(photos.save).not.toHaveBeenCalled();
    expect(storage.createUploadTarget).not.toHaveBeenCalled();
  });
});
