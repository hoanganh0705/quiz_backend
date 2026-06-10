export class MyTournamentHistoryCursorMapper {
  static serialize(cursor: { completedAt: string; participantId: string }): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  static parse(cursor: string): { completedAt: string; participantId: string } {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  }
}
