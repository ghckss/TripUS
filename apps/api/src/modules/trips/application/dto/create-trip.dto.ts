import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTripDto {
  @ApiProperty({ type: String, example: '서울 가을 여행', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({ type: String, example: '서울', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  destination!: string;

  @ApiProperty({ type: String, example: 'Asia/Seoul', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  timezone!: string;

  @ApiProperty({ type: String, example: '2026-10-31', format: 'date' })
  @IsDateString({ strict: true })
  startDate!: string;

  @ApiProperty({ type: String, example: '2026-11-02', format: 'date' })
  @IsDateString({ strict: true })
  endDate!: string;
}
