import { ApiParam } from '@nestjs/swagger';
export const ApiTournamentIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'id',
    description: 'UUID of the tournament',
    format: 'uuid',
  });

export const ApiTournamentRoundIdParam = (): MethodDecorator =>
  ApiParam({
    name: 'roundId',
    description: 'UUID of the tournament round',
    format: 'uuid',
  });
