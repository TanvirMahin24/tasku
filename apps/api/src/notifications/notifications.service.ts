import { Injectable } from '@nestjs/common';
import type { NotificationDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { toNotificationDto } from '../common/mappers';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current user's notifications, newest first. */
  async list(userId: string): Promise<NotificationDto[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return notifications.map(toNotificationDto);
  }

  /** Mark a single notification read (scoped to the owner). */
  async markRead(id: string, userId: string): Promise<{ success: boolean }> {
    await this.prisma.notification.updateMany({
      where: { id, recipientId: userId },
      data: { read: true },
    });
    return { success: true };
  }

  /** Mark every notification for the user as read. */
  async markAllRead(userId: string): Promise<{ success: boolean }> {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, read: false },
      data: { read: true },
    });
    return { success: true };
  }
}
