import { IsEmail, IsString, MinLength } from 'class-validator';
import type { RegisterDto as IRegisterDto } from '@tasku/types';

export class RegisterDto implements IRegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(1)
  displayName: string;
}
