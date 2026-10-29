import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { SocialAuthProvider } from '../../domain/entities/auth-identity.entity';

export class SocialLoginDto {
  @ApiProperty({ enum: SocialAuthProvider, enumName: 'SocialAuthProvider' })
  @IsEnum(SocialAuthProvider)
  provider!: SocialAuthProvider;

  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}

export class RefreshSessionDto {
  @ApiProperty({ type: String })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class AuthUserDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ type: String })
  displayName!: string;
}

export class AuthSessionDto {
  @ApiProperty({ type: String })
  accessToken!: string;

  @ApiProperty({ type: String })
  refreshToken!: string;

  @ApiProperty({ type: Number, example: 900 })
  expiresInSeconds!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
