import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { CreateProjectDto as ICreateProjectDto } from '@tasku/types';

export class CreateProjectDto implements ICreateProjectDto {
  // Project key: uppercase letters/numbers, e.g. "TASK". Used as issue prefix.
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  @Matches(/^[A-Z][A-Z0-9]*$/, {
    message: 'key must be uppercase letters/numbers, starting with a letter',
  })
  key: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
