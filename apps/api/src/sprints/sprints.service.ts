import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SprintState, StatusCategory } from '@prisma/client';
import type { SprintDto } from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { EventsService } from '../events/events.service';
import { toSprintDto } from '../common/mappers';
import { CreateSprintDto } from './dto/create-sprint.dto';

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly events: EventsService,
  ) {}

  async list(key: string, userId: string): Promise<SprintDto[]> {
    const project = await this.membership.getProjectForMember(key, userId);
    const sprints = await this.prisma.sprint.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
    });
    return sprints.map(toSprintDto);
  }

  async create(
    key: string,
    dto: CreateSprintDto,
    userId: string,
  ): Promise<SprintDto> {
    const project = await this.membership.getProjectForMember(key, userId);
    const sprint = await this.prisma.sprint.create({
      data: {
        projectId: project.id,
        name: dto.name,
        goal: dto.goal ?? null,
        state: SprintState.FUTURE,
      },
    });
    return toSprintDto(sprint);
  }

  async start(sprintId: string, userId: string): Promise<SprintDto> {
    const sprint = await this.getSprintForMember(sprintId, userId);
    if (sprint.state === SprintState.ACTIVE) {
      return toSprintDto(sprint);
    }
    if (sprint.state === SprintState.CLOSED) {
      throw new ConflictException('Cannot start a closed sprint');
    }
    // Only one active sprint per project.
    const active = await this.prisma.sprint.findFirst({
      where: { projectId: sprint.projectId, state: SprintState.ACTIVE },
    });
    if (active) {
      throw new ConflictException(
        'Another sprint is already active in this project',
      );
    }
    const updated = await this.prisma.sprint.update({
      where: { id: sprint.id },
      data: { state: SprintState.ACTIVE, startDate: new Date() },
    });

    const project = await this.prisma.project.findUnique({
      where: { id: sprint.projectId },
      select: { key: true },
    });
    this.events.emit(project!.key, {
      type: 'sprint.started',
      projectKey: project!.key,
      sprintId: updated.id,
    });
    return toSprintDto(updated);
  }

  async complete(sprintId: string, userId: string): Promise<SprintDto> {
    const sprint = await this.getSprintForMember(sprintId, userId);
    if (sprint.state === SprintState.CLOSED) {
      return toSprintDto(sprint);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Move incomplete issues (status category != DONE) back to the backlog.
      const doneStatuses = await tx.status.findMany({
        where: { projectId: sprint.projectId, category: StatusCategory.DONE },
        select: { id: true },
      });
      const doneIds = doneStatuses.map((s) => s.id);

      await tx.issue.updateMany({
        where: {
          sprintId: sprint.id,
          statusId: doneIds.length ? { notIn: doneIds } : undefined,
        },
        data: { sprintId: null },
      });

      return tx.sprint.update({
        where: { id: sprint.id },
        data: { state: SprintState.CLOSED, endDate: new Date() },
      });
    });

    return toSprintDto(updated);
  }

  // Sprints are addressed by id (not project key), so resolve + check membership.
  private async getSprintForMember(sprintId: string, userId: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
    });
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }
    await this.membership.requireMembership(sprint.projectId, userId);
    return sprint;
  }
}
