import { NotificationDomainEventBus } from './notification-domain.event-bus';
import type { PinoLogger } from 'nestjs-pino';
import type { NotificationSentEvent, NotificationReadEvent } from './notification.events';

function makeLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as PinoLogger;
}

describe('NotificationDomainEventBus', () => {
  it('delivers events to type-specific subscribers', () => {
    const bus = new NotificationDomainEventBus(makeLogger());
    const sentHandler = jest.fn();
    const readHandler = jest.fn();

    bus.subscribe<NotificationSentEvent>('notification.sent', sentHandler);
    bus.subscribe<NotificationReadEvent>('notification.read', readHandler);

    const event: NotificationSentEvent = {
      eventType: 'notification.sent',
      notificationId: 'n-1',
      userId: 'user-1',
      type: 'achievement_earned',
      channel: 'in_app',
      timestamp: new Date(),
    };
    bus.emit(event);

    expect(sentHandler).toHaveBeenCalledWith(event);
    expect(readHandler).not.toHaveBeenCalled();
  });

  it('delivers events to subscribers via subscribeAll', () => {
    const bus = new NotificationDomainEventBus(makeLogger());
    const handler = jest.fn();
    bus.subscribeAll(handler);
    const event: NotificationSentEvent = {
      eventType: 'notification.sent',
      notificationId: 'n-1',
      userId: 'user-1',
      type: 'achievement_earned',
      channel: 'in_app',
      timestamp: new Date(),
    };
    bus.emit(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('returns an unsubscribe handle from subscribe that detaches the handler', () => {
    const bus = new NotificationDomainEventBus(makeLogger());
    const handler = jest.fn();
    const sub = bus.subscribe<NotificationSentEvent>('notification.sent', handler);
    sub.unsubscribe();
    bus.emit({
      eventType: 'notification.sent',
      notificationId: 'n-1',
      userId: 'user-1',
      type: 'achievement_earned',
      channel: 'in_app',
      timestamp: new Date(),
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe handle from subscribeAll', () => {
    const bus = new NotificationDomainEventBus(makeLogger());
    const handler = jest.fn();
    const sub = bus.subscribeAll(handler);
    sub.unsubscribe();
    bus.emit({
      eventType: 'notification.sent',
      notificationId: 'n-1',
      userId: 'user-1',
      type: 'achievement_earned',
      channel: 'in_app',
      timestamp: new Date(),
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('clear() removes all subscriptions', () => {
    const bus = new NotificationDomainEventBus(makeLogger());
    const h1 = jest.fn();
    const h2 = jest.fn();
    bus.subscribe<NotificationSentEvent>('notification.sent', h1);
    bus.subscribeAll(h2);
    bus.clear();
    bus.emit({
      eventType: 'notification.sent',
      notificationId: 'n-1',
      userId: 'user-1',
      type: 'achievement_earned',
      channel: 'in_app',
      timestamp: new Date(),
    });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('does not propagate errors thrown by handlers', () => {
    const bus = new NotificationDomainEventBus(makeLogger());
    const errorHandler = jest.fn(() => {
      throw new Error('boom');
    });
    const okHandler = jest.fn();
    bus.subscribe<NotificationSentEvent>('notification.sent', errorHandler);
    bus.subscribe<NotificationSentEvent>('notification.sent', okHandler);

    bus.emit({
      eventType: 'notification.sent',
      notificationId: 'n-1',
      userId: 'user-1',
      type: 'achievement_earned',
      channel: 'in_app',
      timestamp: new Date(),
    });
    expect(okHandler).toHaveBeenCalled();
  });
});
