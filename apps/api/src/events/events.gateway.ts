import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

/**
 * Realtime gateway. Clients connect, then send a `join` message with a
 * projectKey to subscribe to that project's room. The EventsService broadcasts
 * domain events (issue.created, issue.moved, ...) into the matching room.
 */
@WebSocketGateway({
  cors: { origin: WEB_ORIGIN, credentials: true },
})
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /** Join the room for a project. Payload: a projectKey string or { projectKey }. */
  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: string | { projectKey: string },
  ): { joined: string } {
    const projectKey =
      typeof payload === 'string' ? payload : payload?.projectKey;
    if (projectKey) {
      client.join(this.room(projectKey));
    }
    return { joined: projectKey };
  }

  /** Leave a project room. */
  @SubscribeMessage('leave')
  handleLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: string | { projectKey: string },
  ): { left: string } {
    const projectKey =
      typeof payload === 'string' ? payload : payload?.projectKey;
    if (projectKey) {
      client.leave(this.room(projectKey));
    }
    return { left: projectKey };
  }

  room(projectKey: string): string {
    return `project:${projectKey}`;
  }
}
