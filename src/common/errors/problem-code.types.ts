import { HttpStatus } from '@nestjs/common';

export interface ProblemCodeInfo {
  readonly status: HttpStatus;
  readonly title: string;
  readonly typeUri: string;
}
