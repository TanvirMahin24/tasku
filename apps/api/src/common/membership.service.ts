import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Centralized authorization + lookup helpers. Every mutation that touches a
 * project (issues, comments, board, sprints, labels) routes through one of
 * these to enforce "must be a project member".
 */
@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the membership row or throws if the user is not a member. */
  async requireMembership(projectId: string, userId: string) {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }
    return membership;
  }

  /** Asserts the user is an ADMIN of the project. */
  async requireAdmin(projectId: string, userId: string) {
    const membership = await this.requireMembership(projectId, userId);
    if (membership.role !== Role.ADMIN) {
      throw new ForbiddenException('Admin role required');
    }
    return membership;
  }

  /** Resolve a project by its key, asserting membership. Returns the project. */
  async getProjectForMember(key: string, userId: string) {
    const project = await this.prisma.project.findUnique({ where: { key } });
    if (!project) {
      throw new NotFoundException(`Project ${key} not found`);
    }
    await this.requireMembership(project.id, userId);
    return project;
  }

  /**
   * Resolve an issue by its global key (e.g. "TASK-42") and assert the caller
   * is a member of its project. Returns the issue row.
   */
  async getIssueForMember(issueKey: string, userId: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { key: issueKey },
    });
    if (!issue) {
      throw new NotFoundException(`Issue ${issueKey} not found`);
    }
    await this.requireMembership(issue.projectId, userId);
    return issue;
  }
}
