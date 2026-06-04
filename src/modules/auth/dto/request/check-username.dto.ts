import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CheckUsernameDto {
  @ApiProperty({
    description:
      'Username to check for availability (letters, numbers, periods, underscores, hyphens)',
    minLength: 3,
    maxLength: 50,
    pattern: '^[a-zA-Z0-9._-]+$',
    example: 'alice_wonder',
  })
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Username can only contain letters, numbers, periods, underscores, and hyphens',
  })
  username!: string;
}
