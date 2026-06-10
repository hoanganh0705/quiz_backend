export class MyTournamentCursorMapper {
  static serialize(cursor: { registeredAt: string; participantId: string }): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  static parse(cursor: string): { registeredAt: string; participantId: string } {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  }
}
