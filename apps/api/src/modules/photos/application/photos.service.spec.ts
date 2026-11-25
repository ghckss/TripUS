import { describe, expect, it, vi } from 'vitest';

import { PhotoStatus } from '../domain/entities/photo.entity';
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

  it('deletes every stored variant before removing the owned photo record', async () => {
    const photo = {
      id: '50000000-0000-4000-8000-000000000001',
      tripId: '10000000-0000-4000-8000-000000000001',
      originalKey: 'original',
      optimizedKey: 'optimized',
      thumbnailKey: 'thumbnail',
    };
    const photos = { findOneBy: vi.fn().mockResolvedValue(photo), delete: vi.fn() };
    const trips = { findOneBy: vi.fn().mockResolvedValue({ id: photo.tripId }) };
    const storage = { delete: vi.fn().mockResolvedValue(undefined) };
    const identity = { getCurrentUserId: vi.fn().mockReturnValue('20000000-0000-4000-8000-000000000001') };
    const service = new PhotosService(photos as never, trips as never, {} as never, storage as never, {} as never, identity);

    await service.delete(photo.tripId, photo.id);

    expect(storage.delete).toHaveBeenCalledTimes(3);
    expect(storage.delete).toHaveBeenCalledWith('original');
    expect(storage.delete).toHaveBeenCalledWith('optimized');
    expect(storage.delete).toHaveBeenCalledWith('thumbnail');
    expect(photos.delete).toHaveBeenCalledWith({ id: photo.id, tripId: photo.tripId });
  });

  it('keeps the previous photo until the replacement is ready, then deletes it', async () => {
    const previous = {
      id: '50000000-0000-4000-8000-000000000001',
      tripId: '10000000-0000-4000-8000-000000000001',
      originalKey: 'old-original',
      optimizedKey: 'old-optimized',
      thumbnailKey: 'old-thumbnail',
    };
    const replacement = {
      id: '50000000-0000-4000-8000-000000000002',
      tripId: previous.tripId,
      replacesPhotoId: previous.id,
      originalKey: 'new-original',
      optimizedKey: null,
      thumbnailKey: null,
      mimeType: 'image/jpeg',
      status: PhotoStatus.Pending,
    };
    const photos = {
      findOneBy: vi.fn()
        .mockResolvedValueOnce(replacement)
        .mockResolvedValueOnce(previous),
      save: vi.fn().mockImplementation((value) => Promise.resolve(value)),
      delete: vi.fn(),
    };
    const trips = { findOneBy: vi.fn().mockResolvedValue({ id: previous.tripId }) };
    const storage = {
      read: vi.fn().mockResolvedValue(new Uint8Array([1])),
      write: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      createDownloadUrl: vi.fn().mockResolvedValue('https://example.com/photo'),
    };
    const processor = { createDerivatives: vi.fn().mockResolvedValue({ optimized: new Uint8Array([2]), thumbnail: new Uint8Array([3]) }) };
    const identity = { getCurrentUserId: vi.fn().mockReturnValue('20000000-0000-4000-8000-000000000001') };
    const service = new PhotosService(photos as never, trips as never, {} as never, storage as never, processor as never, identity);

    await service.confirm(previous.tripId, replacement.id);

    expect(storage.write).toHaveBeenCalledTimes(2);
    expect(storage.delete).toHaveBeenCalledTimes(3);
    expect(photos.delete).toHaveBeenCalledWith({ id: previous.id, tripId: previous.tripId });
    expect(replacement.status).toBe(PhotoStatus.Ready);
    expect(replacement.replacesPhotoId).toBeNull();
  });
});
