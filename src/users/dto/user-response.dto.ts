import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty()
  email: string;
}
