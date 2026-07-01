import { Injectable } from '@nestjs/common';
import type { WsEvent } from '@tasku/types';
import { EventsGateway } from './events.gateway';

/**
 * Thin façade over the gateway so domain services depend on an injectable
 * service rather than the gateway/socket internals.
 */
@Injectable()
export class EventsService {
  constructor(private readonly gateway: EventsGateway) {}

  /** Broadcast a typed event to everyone in the project's room. */
  emit(projectKey: string, event: WsEvent): void {
    const server = this.gateway.server;
    if (!server) return; // gateway not yet initialized (e.g. during tests)
    // Single 'event' channel; the client switches on `event.type`.
    server.to(this.gateway.room(projectKey)).emit('event', event);
  }

  /** Push a typed event to one user's personal room. */
  emitToUser(userId: string, event: WsEvent): void {
    const server = this.gateway.server;
    if (!server) return;
    server.to(this.gateway.userRoom(userId)).emit('event', event);
  }

  /** Ping each (deduped) recipient that they have a new notification. */
  notifyUsers(userIds: Iterable<string | null | undefined>): void {
    const seen = new Set<string>();
    for (const id of userIds) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      this.emitToUser(id, { type: 'notification.created' });
    }
  }
}
