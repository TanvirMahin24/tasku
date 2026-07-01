import {
  BadRequestException,
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
  ComponentDto,
} from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import {
  toProjectDto,
  toStatusDto,
  toLabelDto,
  toSprintDto,
  toUserDto,
  toComponentDto,
} from '../common/mappers';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ReorderStatusesDto } from './dto/reorder-statuses.dto';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

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

  /** Projects the user is not a member of — suggested spaces to join. */
  async recommended(userId: string): Promise<ProjectDto[]> {
    const projects = await this.prisma.project.findMany({
      where: { members: { none: { userId } } },
      include: { lead: true },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    return projects.map((p) => toProjectDto(p));
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
    if (dto.defaultTab !== undefined) data.defaultTab = dto.defaultTab;

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

  async updateMemberRole(
    key: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
    userId: string,
  ) {
    const project = await this.prisma.project.findUnique({ where: { key } });
    if (!project) {
      throw new NotFoundException(`Project ${key} not found`);
    }
    await this.membership.requireAdmin(project.id, userId);

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: project.id, userId: targetUserId },
      },
    });
    if (!member) {
      throw new NotFoundException('User is not a member of this project');
    }

    // Demoting the last ADMIN would leave the project without an admin.
    if (member.role === Role.ADMIN && dto.role !== Role.ADMIN) {
      const adminCount = await this.prisma.projectMember.count({
        where: { projectId: project.id, role: Role.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the last admin of the project',
        );
      }
    }

    const updated = await this.prisma.projectMember.update({
      where: {
        projectId_userId: { projectId: project.id, userId: targetUserId },
      },
      data: { role: dto.role },
      include: { user: true },
    });
    return { role: updated.role, user: toUserDto(updated.user) };
  }

  async removeMember(key: string, targetUserId: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { key } });
    if (!project) {
      throw new NotFoundException(`Project ${key} not found`);
    }
    await this.membership.requireAdmin(project.id, userId);

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: project.id, userId: targetUserId },
      },
    });
    if (!member) {
      throw new NotFoundException('User is not a member of this project');
    }

    if (project.leadId === targetUserId) {
      throw new BadRequestException('Cannot remove the project lead');
    }

    if (member.role === Role.ADMIN) {
      const adminCount = await this.prisma.projectMember.count({
        where: { projectId: project.id, role: Role.ADMIN },
      });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'Cannot remove the last admin of the project',
        );
      }
    }

    await this.prisma.projectMember.delete({
      where: {
        projectId_userId: { projectId: project.id, userId: targetUserId },
      },
    });
    return { success: true };
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

  async createStatus(
    key: string,
    dto: CreateStatusDto,
    userId: string,
  ): Promise<StatusDto> {
    const project = await this.prisma.project.findUnique({ where: { key } });
    if (!project) {
      throw new NotFoundException(`Project ${key} not found`);
    }
    await this.membership.requireAdmin(project.id, userId);

    const existing = await this.prisma.status.findUnique({
      where: { projectId_name: { projectId: project.id, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Status "${dto.name}" already exists`);
    }

    const last = await this.prisma.status.findFirst({
      where: { projectId: project.id },
      orderBy: { order: 'desc' },
    });
    const order = last ? last.order + 1 : 0;

    const status = await this.prisma.status.create({
      data: {
        projectId: project.id,
        name: dto.name,
        category: dto.category,
        order,
      },
    });
    return toStatusDto(status);
  }

  async updateStatus(
    id: string,
    dto: UpdateStatusDto,
    userId: string,
  ): Promise<StatusDto> {
    const status = await this.prisma.status.findUnique({ where: { id } });
    if (!status) {
      throw new NotFoundException(`Status ${id} not found`);
    }
    await this.membership.requireAdmin(status.projectId, userId);

    if (dto.name !== undefined && dto.name !== status.name) {
      const clash = await this.prisma.status.findUnique({
        where: {
          projectId_name: { projectId: status.projectId, name: dto.name },
        },
      });
      if (clash) {
        throw new ConflictException(`Status "${dto.name}" already exists`);
      }
    }

    const data: Prisma.StatusUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.wipLimit !== undefined) data.wipLimit = dto.wipLimit;

    const updated = await this.prisma.status.update({
      where: { id },
      data,
    });
    return toStatusDto(updated);
  }

  async deleteStatus(id: string, userId: string): Promise<{ success: boolean }> {
    const status = await this.prisma.status.findUnique({ where: { id } });
    if (!status) {
      throw new NotFoundException(`Status ${id} not found`);
    }
    await this.membership.requireAdmin(status.projectId, userId);

    const issueCount = await this.prisma.issue.count({
      where: { statusId: id },
    });
    if (issueCount > 0) {
      throw new BadRequestException(
        'Cannot delete a status that still has issues',
      );
    }

    const statusCount = await this.prisma.status.count({
      where: { projectId: status.projectId },
    });
    if (statusCount <= 1) {
      throw new BadRequestException('Cannot delete the last status');
    }

    await this.prisma.status.delete({ where: { id } });
    return { success: true };
  }

  async reorderStatuses(
    key: string,
    dto: ReorderStatusesDto,
    userId: string,
  ): Promise<StatusDto[]> {
    const project = await this.prisma.project.findUnique({ where: { key } });
    if (!project) {
      throw new NotFoundException(`Project ${key} not found`);
    }
    await this.membership.requireAdmin(project.id, userId);

    const statuses = await this.prisma.status.findMany({
      where: { projectId: project.id },
    });
    const ids = new Set(statuses.map((s) => s.id));

    // The payload must reference exactly the project's statuses, once each.
    if (
      dto.statusIds.length !== statuses.length ||
      new Set(dto.statusIds).size !== dto.statusIds.length ||
      !dto.statusIds.every((sid) => ids.has(sid))
    ) {
      throw new BadRequestException(
        'statusIds must list every status of the project exactly once',
      );
    }

    await this.prisma.$transaction(
      dto.statusIds.map((sid, order) =>
        this.prisma.status.update({ where: { id: sid }, data: { order } }),
      ),
    );

    const reordered = await this.prisma.status.findMany({
      where: { projectId: project.id },
      orderBy: { order: 'asc' },
    });
    return reordered.map(toStatusDto);
  }

  // --- Components ------------------------------------------------------------

  async listComponents(key: string, userId: string): Promise<ComponentDto[]> {
    const project = await this.membership.getProjectForMember(key, userId);
    const components = await this.prisma.component.findMany({
      where: { projectId: project.id },
      orderBy: { name: 'asc' },
    });
    return components.map(toComponentDto);
  }

  async createComponent(
    key: string,
    dto: CreateComponentDto,
    userId: string,
  ): Promise<ComponentDto> {
    const project = await this.prisma.project.findUnique({ where: { key } });
    if (!project) {
      throw new NotFoundException(`Project ${key} not found`);
    }
    await this.membership.requireAdmin(project.id, userId);

    const existing = await this.prisma.component.findUnique({
      where: { projectId_name: { projectId: project.id, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException(`Component "${dto.name}" already exists`);
    }

    const component = await this.prisma.component.create({
      data: { projectId: project.id, name: dto.name },
    });
    return toComponentDto(component);
  }

  async updateComponent(
    id: string,
    dto: UpdateComponentDto,
    userId: string,
  ): Promise<ComponentDto> {
    const component = await this.prisma.component.findUnique({ where: { id } });
    if (!component) {
      throw new NotFoundException(`Component ${id} not found`);
    }
    await this.membership.requireAdmin(component.projectId, userId);

    if (dto.name !== component.name) {
      const clash = await this.prisma.component.findUnique({
        where: {
          projectId_name: { projectId: component.projectId, name: dto.name },
        },
      });
      if (clash) {
        throw new ConflictException(`Component "${dto.name}" already exists`);
      }
    }

    const updated = await this.prisma.component.update({
      where: { id },
      data: { name: dto.name },
    });
    return toComponentDto(updated);
  }

  async deleteComponent(
    id: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const component = await this.prisma.component.findUnique({ where: { id } });
    if (!component) {
      throw new NotFoundException(`Component ${id} not found`);
    }
    await this.membership.requireAdmin(component.projectId, userId);
    await this.prisma.component.delete({ where: { id } });
    return { success: true };
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

  async updateLabel(
    id: string,
    dto: UpdateLabelDto,
    userId: string,
  ): Promise<LabelDto> {
    const label = await this.prisma.label.findUnique({ where: { id } });
    if (!label) throw new NotFoundException(`Label ${id} not found`);
    await this.membership.requireAdmin(label.projectId, userId);

    if (dto.name && dto.name !== label.name) {
      const clash = await this.prisma.label.findUnique({
        where: { projectId_name: { projectId: label.projectId, name: dto.name } },
      });
      if (clash) throw new ConflictException(`Label "${dto.name}" already exists`);
    }

    const updated = await this.prisma.label.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });
    return toLabelDto(updated);
  }

  async deleteLabel(id: string, userId: string): Promise<{ success: boolean }> {
    const label = await this.prisma.label.findUnique({ where: { id } });
    if (!label) throw new NotFoundException(`Label ${id} not found`);
    await this.membership.requireAdmin(label.projectId, userId);
    await this.prisma.label.delete({ where: { id } });
    return { success: true };
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
