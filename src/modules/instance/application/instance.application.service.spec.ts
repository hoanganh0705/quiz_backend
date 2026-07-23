/**
 * Phase 3 (Production Deployment Readiness) — unit tests for the
 * cross-instance disconnect hot path through
 * `InstanceApplicationService.handlePlayerJoinedSocket` /
 * `handlePlayerLeftSocket`.
 *
 * Pre-Phase-3 these methods operated on a process-local
 * `socketIdToMeta` Map. Phase 3 routes both calls through the new
 * `SocketConnectionRegistryPort`, which the application service
 * receives via DI. These tests pin the new call surface so future
 * refactors keep the cross-instance guarantee intact:
 *
 *   - `handlePlayerJoinedSocket` writes the meta to the registry,
 *     and refuses to record when the JWT has no `sub`.
 *   - `handlePlayerLeftSocket` ATOMICALLY consumes the entry via
 *     `SocketConnectionRegistry.consume(...)` — a second consume
 *     for the same socket id returns `null` and the event is NOT
 *     emitted again. This is what stops Socket.IO's occasionally
 *     double-fired `disconnect` from emitting
 *     `PlayerDisconnectedEvent` twice.
 *   - When a consume returns a meta, the application service emits
 *     `PlayerDisconnectedEvent` with the meta's userId /
 *     instanceId, and the host notification is fired (best-effort).
 *
 * The test does not spin up Redis or the socket adapter; the new
 * `SocketConnectionRegistryPort` is mocked. That is intentional —
 * the cross-instance GUARANTEE is enforced by the registry's
 * atomic GETDEL, which has its own tests in
 * `redis-socket-connection.registry.spec.ts`.
 */
import { InstanceApplicationService } from './instance.application.service';
import { InstanceService } from '../domain/instance.service';
import type { SocketConnectionRegistryPort } from '../domain/ports';
import type { InstanceDomainEventBusPort } from '../domain/events';
import { PlayerDisconnectedEvent } from '../domain/events';
import { InstanceResponseMapper } from '../mappers/instance-response.mapper';

interface FakeBus {
  subscribe: jest.Mock<() => void, [(event: unknown) => void]>;
  emitPlayerDisconnected: jest.Mock<void, [PlayerDisconnectedEvent]>;
  [k: string]: jest.Mock | undefined;
}

interface FakeRegistry {
  record: jest.Mock<Promise<boolean>, [string, { instanceId: string; userId: string }]>;
  consume: jest.Mock<Promise<{ instanceId: string; userId: string } | null>, [string]>;
  getMeta: jest.Mock;
  setTtlMs: jest.Mock;
  getTtlMs: jest.Mock;
}

const buildRegistry = (): FakeRegistry => ({
  record: jest.fn().mockResolvedValue(true),
  consume: jest.fn(),
  getMeta: jest.fn(),
  setTtlMs: jest.fn(),
  getTtlMs: jest.fn().mockReturnValue(60_000),
});

const buildBus = (): FakeBus => ({
  subscribe: jest.fn().mockReturnValue(() => undefined),
  emitPlayerDisconnected: jest.fn(),
});

const buildLogger = () =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }) as unknown as ConstructorParameters<typeof InstanceApplicationService>[4];

const newSvc = (
  registry: FakeRegistry,
  bus: FakeBus,
  instanceService: Partial<jest.Mocked<InstanceService>> = {},
) => {
  // The `InstanceService` only matters for `notifyHostPlayerDisconnected`,
  // which is called off the hot path. We give every method a default
  // rejection-safe stub so individual tests can override what they need.
  const partialInstance: jest.Mocked<InstanceService> = {
    getInstanceById: jest
      .fn()
      .mockResolvedValue({ hostUserId: 'host-1' } as unknown as Awaited<
        ReturnType<InstanceService['getInstanceById']>
      >),
    getInstancePlayers: jest.fn().mockResolvedValue([]),
    notifyHostPlayerDisconnected: jest.fn().mockResolvedValue(undefined),
    ...instanceService,
  } as jest.Mocked<InstanceService>;

  // `InstanceResponseMapper` is only used by HTTP-shaped methods and the
  // disconnect hot path doesn't go anywhere near it. The reference is
  // required by the constructor only.
  const fakeMapper = {} as InstanceResponseMapper;

  // The mapper is untyped, but the constructor takes it via a symbol-tagged
  // class — simplest stub is any-cast.

  const mapper = fakeMapper as any;

  const busAny = bus as unknown as InstanceDomainEventBusPort;

  const anyLogger = buildLogger() as any;

  return new InstanceApplicationService(
    partialInstance,
    mapper,
    busAny,
    registry as unknown as SocketConnectionRegistryPort,
    anyLogger,
  );
};

const user = { sub: 'user-1', role: 'user' as const };

describe('InstanceApplicationService — Phase 3 cross-instance disconnect path', () => {
  describe('handlePlayerJoinedSocket', () => {
    it('records the {instanceId, userId} meta in the cross-instance registry', () => {
      const registry = buildRegistry();
      const bus = buildBus();
      const svc = newSvc(registry, bus);

      svc.handlePlayerJoinedSocket({
        socketId: 'sock-1',
        instanceId: 'inst-1',
        user,
      });

      expect(registry.record).toHaveBeenCalledWith('sock-1', {
        instanceId: 'inst-1',
        userId: 'user-1',
      });
    });

    it('refuses to record when the JWT payload has no `sub` (logs warning, no registry write)', () => {
      const registry = buildRegistry();
      const bus = buildBus();
      const logger = buildLogger();

      const svc = new InstanceApplicationService(
        {} as InstanceService,

        {} as any,
        bus as unknown as InstanceDomainEventBusPort,
        registry as unknown as SocketConnectionRegistryPort,
        logger as unknown as ConstructorParameters<typeof InstanceApplicationService>[4],
      );

      svc.handlePlayerJoinedSocket({
        socketId: 'sock-1',
        instanceId: 'inst-1',

        user: { sub: '', role: 'user' } as any,
      });

      expect(registry.record).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'socket_connection_registry_join_refused',
          reason: 'missing_jwt_sub',
        }),
      );
    });
  });

  describe('handlePlayerLeftSocket', () => {
    it('emits PlayerDisconnectedEvent with the consumed meta', async () => {
      const registry = buildRegistry();
      registry.consume.mockResolvedValueOnce({ instanceId: 'inst-1', userId: 'user-1' });
      const bus = buildBus();
      const svc = newSvc(registry, bus);

      await svc.handlePlayerLeftSocket({ socketId: 'sock-1', instanceId: 'inst-1' });

      expect(registry.consume).toHaveBeenCalledWith('sock-1');
      expect(bus.emitPlayerDisconnected).toHaveBeenCalledTimes(1);
      const event = bus.emitPlayerDisconnected.mock.calls[0][0];
      expect(event).toBeInstanceOf(PlayerDisconnectedEvent);
      expect(event.instanceId).toBe('inst-1');
      expect(event.userId).toBe('user-1');
      expect(event.socketId).toBe('sock-1');
    });

    it('is a no-op when the registry has no meta (disconnect after TTL)', async () => {
      const registry = buildRegistry();
      registry.consume.mockResolvedValueOnce(null);
      const bus = buildBus();
      const svc = newSvc(registry, bus);

      await svc.handlePlayerLeftSocket({ socketId: 'sock-1', instanceId: 'inst-1' });

      expect(bus.emitPlayerDisconnected).not.toHaveBeenCalled();
    });

    it('does NOT emit twice when consume is called twice with the same socket (double-disconnect safe)', async () => {
      // Socket.IO can fire `disconnect` twice for an aborted
      // transport. The registry's atomic GETDEL guarantees the
      // second consume returns `null`, so the second disconnect
      // becomes a no-op — no duplicate `PlayerDisconnectedEvent`.
      const registry = buildRegistry();
      registry.consume
        .mockResolvedValueOnce({ instanceId: 'inst-1', userId: 'user-1' })
        .mockResolvedValueOnce(null);
      const bus = buildBus();
      const svc = newSvc(registry, bus);

      await svc.handlePlayerLeftSocket({ socketId: 'sock-1', instanceId: 'inst-1' });
      await svc.handlePlayerLeftSocket({ socketId: 'sock-1', instanceId: 'inst-1' });

      expect(bus.emitPlayerDisconnected).toHaveBeenCalledTimes(1);
    });

    it('uses the instanceId stored in the meta, not the one passed by the gateway', async () => {
      // The gateway fires for every room the socket was in. The
      // canonical instance id is the one recorded at join time,
      // stored in Redis. If the gateway passes a stale or
      // different instance id (e.g. due to a socket having joined
      // and left a different instance), the meta wins — the event
      // cannot be misdirected to the wrong room.
      const registry = buildRegistry();
      registry.consume.mockResolvedValueOnce({ instanceId: 'inst-canonical', userId: 'user-1' });
      const bus = buildBus();
      const svc = newSvc(registry, bus);

      await svc.handlePlayerLeftSocket({ socketId: 'sock-1', instanceId: 'inst-stale' });

      const event = bus.emitPlayerDisconnected.mock.calls[0][0];
      expect(event.instanceId).toBe('inst-canonical');
    });
  });
});
