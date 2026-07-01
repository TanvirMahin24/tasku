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
import { JwtService } from '@nestjs/jwt';
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

  constructor(private readonly jwt: JwtService) {}

  /**
   * On connect, verify the JWT passed in the socket handshake auth and join the
   * user's personal room (`user:<id>`) so we can push their notifications live.
   * An unauthenticated socket simply gets no user room.
   */
  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = this.jwt.verify<{ sub: string }>(token);
        if (payload?.sub) {
          client.data.userId = payload.sub;
          client.join(this.userRoom(payload.sub));
        }
      } catch {
        // invalid/expired token -> no user room, still allowed to connect
      }
    }
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

  userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
