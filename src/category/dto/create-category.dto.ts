import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsInt,
  IsPositive,
} from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  parentId?: number;
}