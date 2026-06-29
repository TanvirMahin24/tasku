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
    server.to(this.gateway.room(projectKey)).emit(event.type, event);
  }
}
