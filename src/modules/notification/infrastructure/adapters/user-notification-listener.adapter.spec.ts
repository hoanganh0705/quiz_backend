import type { PinoLogger } from 'nestjs-pino';
import { UserNotificationListener } from './user-notification-listener.adapter';
import { UserNotificationService } from '../../domain/services/user-notification.service';

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

function makeService() {
  const handlers: Array<(event: unknown) => void> = [];
  const unsubscribe = jest.fn();
  const userEventBus = {
    subscribe: jest.fn((handler: (event: unknown) => void) => {
      handlers.push(handler);
      return unsubscribe;
    }),
  };
  const notifyProfileUpdated = jest.fn().mockResolvedValue(undefined);
  const notifySettingsUpdated = jest.fn().mockResolvedValue(undefined);
  const userNotificationService = {
    notifyProfileUpdated,
    notifySettingsUpdated,
  } as unknown as UserNotificationService;

  const listener = new UserNotificationListener(
    userEventBus,
    userNotificationService,
    makeLogger(),
  );
  listener.onModuleInit();
  return { listener, handlers, notifyProfileUpdated, notifySettingsUpdated, unsubscribe };
}

describe('UserNotificationListener', () => {
  async function dispatch(handler: (e: unknown) => unknown, event: unknown): Promise<void> {
    handler(event);
    await new Promise((resolve) => setImmediate(resolve));
  }

  it('dispatches profile-updated notifications', async () => {
    const { handlers, notifyProfileUpdated } = makeService();
    await dispatch(handlers[0], {
      eventType: 'user.profile.updated',
      userId: 'user-1',
      changedFields: ['displayName'],
    });
    expect(notifyProfileUpdated).toHaveBeenCalledWith({
      userId: 'user-1',
      changedFields: ['displayName'],
    });
  });

  it('dispatches settings-updated notifications', async () => {
    const { handlers, notifySettingsUpdated } = makeService();
    await dispatch(handlers[0], {
      eventType: 'user.settings.updated',
      userId: 'user-2',
    });
    expect(notifySettingsUpdated).toHaveBeenCalledWith({ userId: 'user-2' });
  });

  it('unsubscribes on module destroy', () => {
    const { listener, unsubscribe } = makeService();
    listener.onModuleDestroy();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
