import { IsEmail, IsString, Length, MinLength, Matches, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Username can only contain letters, numbers, periods, underscores, and hyphens.',
  })
  username!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Password must contain at least 1 uppercase letter, 1 number, and 1 special character',
  })
  password!: string;
}
