import type { Readable } from 'node:stream';

import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put, Req, Res } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CreatePhotoUploadDto, PhotoResponseDto, PhotoUploadTargetDto } from '../application/dto/photo.dto';
import { PhotoVariant, PhotosService } from '../application/photos.service';

@ApiTags('photos')
@Controller('trips/:tripId/photos')
export class PhotosController {
  constructor(@Inject(PhotosService) private readonly photos: PhotosService) {}

  @Post()
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiBody({ type: CreatePhotoUploadDto })
  @ApiCreatedResponse({ type: PhotoUploadTargetDto })
  create(@Param('tripId', new ParseUUIDPipe()) tripId: string, @Body() input: CreatePhotoUploadDto): Promise<PhotoUploadTargetDto> {
    return this.photos.createUpload(tripId, input);
  }

  @Put(':photoId/content')
  @HttpCode(204)
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiParam({ name: 'photoId', type: String, format: 'uuid' })
  @ApiConsumes('image/jpeg', 'image/png', 'image/webp')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  @ApiNoContentResponse()
  async upload(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Param('photoId', new ParseUUIDPipe()) photoId: string,
    @Headers('content-type') contentType: string | undefined,
    @Req() request: Readable,
  ): Promise<void> {
    await this.photos.uploadContent(tripId, photoId, await readBody(request), contentType);
  }

  @Post(':photoId/confirm')
  @HttpCode(200)
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiParam({ name: 'photoId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: PhotoResponseDto })
  confirm(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Param('photoId', new ParseUUIDPipe()) photoId: string,
  ): Promise<PhotoResponseDto> {
    return this.photos.confirm(tripId, photoId);
  }

  @Get()
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiOkResponse({ type: PhotoResponseDto, isArray: true })
  list(@Param('tripId', new ParseUUIDPipe()) tripId: string): Promise<PhotoResponseDto[]> {
    return this.photos.list(tripId);
  }

  @Get(':photoId/files/:variant')
  @ApiParam({ name: 'tripId', type: String, format: 'uuid' })
  @ApiParam({ name: 'photoId', type: String, format: 'uuid' })
  @ApiParam({ name: 'variant', enum: ['original', 'optimized', 'thumbnail'] })
  async file(
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Param('photoId', new ParseUUIDPipe()) photoId: string,
    @Param('variant') variant: PhotoVariant,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.photos.readFile(tripId, photoId, variant);
    response.type(file.mimeType).send(Buffer.from(file.body));
  }
}

async function readBody(request: Readable): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > 100 * 1024 * 1024) throw new BadRequestException('Photo exceeds the 100 MB per-file limit');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
