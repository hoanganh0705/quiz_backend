import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ContactFormDto {
  @ApiProperty({ description: 'Name of the sender', example: 'Alex Smith' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'Contact email address', example: 'alex@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Subject of the inquiry', example: 'Issue with tournament scoring' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({
    description: 'Category of inquiry',
    enum: ['general', 'account', 'billing', 'quiz-creation', 'tournaments', 'privacy', 'technical'],
    example: 'general',
  })
  @IsString()
  @IsIn([
    'general',
    'account',
    'billing',
    'quiz-creation',
    'tournaments',
    'privacy',
    'technical',
  ])
  category!: string;

  @ApiProperty({ description: 'Message body', example: 'I encountered an issue where my score did not register.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ description: 'Optional screenshot or attachment URL' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}

export class ContactFormResponseDto {
  @ApiProperty({ example: 'Your support ticket has been submitted. We will get back to you shortly.' })
  message!: string;

  @ApiProperty({ example: '01934f82-a7d2-7930-b328-98e948c2b531' })
  ticketId!: string;
}

export class FaqItemDto {
  @ApiProperty({ example: 'what-is-quizhub' })
  id!: string;

  @ApiProperty({ example: 'What is QuizHub?' })
  question!: string;

  @ApiProperty({ example: 'QuizHub is an interactive multiplayer quiz and tournament platform.' })
  answer!: string;
}

export class FaqCategoryDto {
  @ApiProperty({ example: 'general' })
  id!: string;

  @ApiProperty({ example: 'General' })
  title!: string;

  @ApiProperty({ type: [FaqItemDto] })
  faqs!: FaqItemDto[];
}

export class SupportArticleDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'General' })
  category!: string;

  @ApiProperty({ example: 'Getting Started with QuizHub' })
  title!: string;

  @ApiProperty({ example: 'Everything you need to know to begin your journey on our platform.' })
  excerpt?: string;

  @ApiProperty({ example: '5 min read' })
  readTime?: string;

  @ApiProperty({ example: 'book-open' })
  icon?: string;

  @ApiProperty({ example: 'getting-started-with-quizhub' })
  slug!: string;

  @ApiProperty({ example: 'Complete guide to getting started with QuizHub...' })
  content?: string;

  @ApiPropertyOptional({ type: [String], example: ['beginner', 'setup'] })
  tags?: string[];

  @ApiPropertyOptional({ example: '2026-08-01' })
  updatedAt?: string;

  @ApiPropertyOptional({ example: 'Beginner' })
  difficulty?: string;
}
