import { Injectable } from '@nestjs/common';
import type { UserDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { toUserDto } from '../common/mappers';

@Injectable()
export class WatchersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  /** Idempotently add the current user as a watcher. Returns watcher list. */
  async watch(issueKey: string, userId: string): Promise<UserDto[]> {
    const issue = await this.membership.getIssueForMember(issueKey, userId);
    await this.prisma.watcher.upsert({
      where: { issueId_userId: { issueId: issue.id, userId } },
      update: {},
      create: { issueId: issue.id, userId },
    });
    return this.list(issue.id);
  }

  /** Idempotently remove the current user as a watcher. */
  async unwatch(issueKey: string, userId: string): Promise<UserDto[]> {
    const issue = await this.membership.getIssueForMember(issueKey, userId);
    await this.prisma.watcher.deleteMany({
      where: { issueId: issue.id, userId },
    });
    return this.list(issue.id);
  }

  private async list(issueId: string): Promise<UserDto[]> {
    const watchers = await this.prisma.watcher.findMany({
      where: { issueId },
      include: { user: true },
    });
    return watchers.map((w) => toUserDto(w.user));
  }
}
