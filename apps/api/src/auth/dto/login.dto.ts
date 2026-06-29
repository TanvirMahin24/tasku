import { IsEmail, IsString, MinLength } from 'class-validator';
import type { LoginDto as ILoginDto } from '@tasku/types';

export class LoginDto implements ILoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
