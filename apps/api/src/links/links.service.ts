import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { IssueLinkDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { toIssueLinkDto } from '../common/mappers';
import { CreateLinkDto } from './dto/create-link.dto';

const SUMMARY_INCLUDE = {
  assignee: true,
  team: true,
  labels: { include: { label: true } },
};

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async create(
    issueKey: string,
    dto: CreateLinkDto,
    userId: string,
  ): Promise<IssueLinkDto> {
    const source = await this.membership.getIssueForMember(issueKey, userId);
    // Target must exist and the caller must be a member of its project too.
    const target = await this.membership.getIssueForMember(
      dto.targetKey,
      userId,
    );

    if (source.id === target.id) {
      throw new BadRequestException('Cannot link an issue to itself');
    }

    const existing = await this.prisma.issueLink.findUnique({
      where: {
        sourceId_targetId_type: {
          sourceId: source.id,
          targetId: target.id,
          type: dto.type,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('This link already exists');
    }

    const link = await this.prisma.$transaction(async (tx) => {
      const created = await tx.issueLink.create({
        data: {
          sourceId: source.id,
          targetId: target.id,
          type: dto.type,
        },
        include: { target: { include: SUMMARY_INCLUDE } },
      });
      await tx.activityLog.create({
        data: {
          issueId: source.id,
          actorId: userId,
          field: 'link',
          oldValue: null,
          newValue: `${dto.type} ${target.key}`,
        },
      });
      return created;
    });

    return toIssueLinkDto(link, 'outward', link.target);
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const link = await this.prisma.issueLink.findUnique({
      where: { id },
      include: { source: { select: { projectId: true } } },
    });
    if (!link) {
      throw new NotFoundException('Link not found');
    }
    await this.membership.requireMembership(link.source.projectId, userId);
    await this.prisma.issueLink.delete({ where: { id } });
    return { success: true };
  }
}
