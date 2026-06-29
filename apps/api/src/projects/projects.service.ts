import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Role,
  StatusCategory,
  type Prisma,
} from '@prisma/client';
import type {
  ProjectDto,
  StatusDto,
  LabelDto,
  SprintDto,
} from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import {
  toProjectDto,
  toStatusDto,
  toLabelDto,
  toSprintDto,
  toUserDto,
} from '../common/mappers';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateLabelDto } from './dto/create-label.dto';

// The three columns every new project starts with.
const DEFAULT_STATUSES: Array<{
  name: string;
  category: StatusCategory;
  order: number;
}> = [
  { name: 'To Do', category: StatusCategory.TODO, order: 0 },
  { name: 'In Progress', category: StatusCategory.IN_PROGRESS, order: 1 },
  { name: 'Done', category: StatusCategory.DONE, order: 2 },
];

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async create(dto: CreateProjectDto, userId: string): Promise<ProjectDto> {
    const existing = await this.prisma.project.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(`Project key ${dto.key} is already in use`);
    }

    const project = await this.prisma.project.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        leadId: userId,
        statuses: { create: DEFAULT_STATUSES },
        members: { create: { userId, role: Role.ADMIN } },
      },
      include: { lead: true },
    });

    return toProjectDto(project, Role.ADMIN);
  }

  /** Projects where the current user is a member (with their role + lead). */
  async findAllForUser(userId: string): Promise<ProjectDto[]> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: { project: { include: { lead: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => toProjectDto(m.project, m.role));
  }

  async findOne(key: string, userId: string): Promise<ProjectDto> {
    const project = await this.prisma.project.findUnique({
      where: { key },
      include: { lead: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${key} not found`);
    }
    const membership = await this.membership.requireMembership(
      project.id,
      userId,
    );
    return toProjectDto(project, membership.role);
  }

  async update(
    key: string,
    dto: UpdateProjectDto,
    userId: string,
  ): Promise<ProjectDto> {
    const project = await this.prisma.project.findUnique({ where: { key } });
    if (!project) {
      throw new NotFoundException(`Project ${key} not found`);
    }
    await this.membership.requireAdmin(project.id, userId);

    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.leadId !== undefined) {
      data.lead = dto.leadId
        ? { connect: { id: dto.leadId } }
        : { disconnect: true };
    }

    const updated = await this.prisma.project.update({
      where: { id: project.id },
      data,
      include: { lead: true },
    });
    const membership = await this.membership.requireMembership(
      project.id,
      userId,
    );
    return toProjectDto(updated, membership.role);
  }

  async remove(key: string, userId: string): Promise<{ success: boolean }> {
    const project = await this.prisma.project.findUnique({ where: { key } });
    if (!project) {
      throw new NotFoundException(`Project ${key} not found`);
    }
    await this.membership.requireAdmin(project.id, userId);
    await this.prisma.project.delete({ where: { id: project.id } });
    return { success: true };
  }

  // --- Members ---------------------------------------------------------------

  async listMembers(key: string, userId: string) {
    const project = await this.membership.getProjectForMember(key, userId);
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: project.id },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      role: m.role,
      user: toUserDto(m.user),
    }));
  }

  async addMember(key: string, dto: AddMemberDto, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { key } });
    if (!project) {
      throw new NotFoundException(`Project ${key} not found`);
    }
    await this.membership.requireAdmin(project.id, userId);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new NotFoundException(`No user with email ${dto.email}`);
    }

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    });
    if (existing) {
      throw new ConflictException('User is already a member');
    }

    const member = await this.prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: dto.role ?? Role.MEMBER,
      },
      include: { user: true },
    });
    return { role: member.role, user: toUserDto(member.user) };
  }

  // --- Statuses --------------------------------------------------------------

  async listStatuses(key: string, userId: string): Promise<StatusDto[]> {
    const project = await this.membership.getProjectForMember(key, userId);
    const statuses = await this.prisma.status.findMany({
      where: { projectId: project.id },
      orderBy: { order: 'asc' },
    });
    return statuses.map(toStatusDto);
  }

  // --- Labels ----------------------------------------------------------------

  async listLabels(key: string, userId: string): Promise<LabelDto[]> {
    const project = await this.membership.getProjectForMember(key, userId);
    const labels = await this.prisma.label.findMany({
      where: { projectId: project.id },
      orderBy: { name: 'asc' },
    });
    return labels.map(toLabelDto);
  }

  async createLabel(
    key: string,
    dto: CreateLabelDto,
    userId: string,
  ): Promise<LabelDto> {
    const project = await this.membership.getProjectForMember(key, userId);
    const existing = await this.prisma.label.findUnique({
      where: { projectId_name: { projectId: project.id, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Label "${dto.name}" already exists`);
    }
    const label = await this.prisma.label.create({
      data: {
        projectId: project.id,
        name: dto.name,
        color: dto.color ?? '#6b7280',
      },
    });
    return toLabelDto(label);
  }

  // --- Sprints (listing only; lifecycle lives in SprintsService) -------------

  async listSprints(key: string, userId: string): Promise<SprintDto[]> {
    const project = await this.membership.getProjectForMember(key, userId);
    const sprints = await this.prisma.sprint.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
    });
    return sprints.map(toSprintDto);
  }
}
