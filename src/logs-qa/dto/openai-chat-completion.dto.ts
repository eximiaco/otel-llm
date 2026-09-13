import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class OpenAiChatMessageDto {
  @ApiProperty({ enum: ['system', 'user', 'assistant'] })
  @IsIn(['system', 'user', 'assistant'])
  role: 'system' | 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  content: string;
}

export class OpenAiChatCompletionDto {
  @ApiProperty({ example: 'logs-qa' })
  @IsString()
  model: string;

  @ApiProperty({ type: OpenAiChatMessageDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpenAiChatMessageDto)
  messages: OpenAiChatMessageDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;
}
