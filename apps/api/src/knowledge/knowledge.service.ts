import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KnowledgeLinkKind, type Prisma } from '@prisma/client';
import { promises as fs, createReadStream } from 'fs';
import { extname, join } from 'path';
import type {
  CreateKnowledgeLinkDto,
  ImportableKnowledgeDocDto,
  KnowledgeDocDto,
} from '@tasku/types';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { toUserDto } from '../common/mappers';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB, mirrors attachments

// createdBy for display + importedFrom (with its owner) so imported docs can
// render a "from <team/issue>" badge and detect a removed source.
const INCLUDE = {
  createdBy: true,
  issue: { select: { projectId: true } },
  importedFrom: {
    include: {
      team: { select: { name: true } },
      issue: { select: { key: true } },
    },
  },
} satisfies Prisma.KnowledgeDocInclude;

type DocWithIncludes = Prisma.KnowledgeDocGetPayload<{ include: typeof INCLUDE }>;

// The provenance bits a caller knows; toDto derives imported/importBroken/label.
type SourceSeed = {
  origin: 'self' | 'inherited';
  issueKey?: string;
  issueTitle?: string;
};

function uploadDir(): string {
  return process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
}
function storedNameFor(id: string, filename: string): string {
  return `${id}${extname(filename || '')}`;
}

/** Best-effort classification of an external link for its icon. */
function detectLinkKind(url: string): KnowledgeLinkKind {
  const u = url.toLowerCase();
  if (u.includes('docs.google.com/document')) return KnowledgeLinkKind.GOOGLE_DOC;
  if (u.includes('docs.google.com/spreadsheets'))
    return KnowledgeLinkKind.GOOGLE_SHEET;
  if (u.includes('docs.google.com/presentation'))
    return KnowledgeLinkKind.GOOGLE_SLIDES;
  return KnowledgeLinkKind.GENERIC;
}

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  // ---------------------------------------------------------------------------
  // Team KB
  // ---------------------------------------------------------------------------
  async listTeam(teamId: string, userId: string): Promise<KnowledgeDocDto[]> {
    await this.requireTeamMember(teamId, userId);
    const docs = await this.prisma.knowledgeDoc.findMany({
      where: { teamId },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => this.toDto(d, { origin: 'self' }, true));
  }

  async createTeamLink(
    teamId: string,
    dto: CreateKnowledgeLinkDto,
    userId: string,
  ): Promise<KnowledgeDocDto> {
    await this.requireTeamMember(teamId, userId);
    return this.createLink({ teamId }, dto, userId);
  }

  async createTeamFile(
    teamId: string,
    file: any,
    title: string | undefined,
    userId: string,
  ): Promise<KnowledgeDocDto> {
    await this.requireTeamMember(teamId, userId);
    return this.createFile({ teamId }, file, title, userId);
  }

  async importToTeam(
    teamId: string,
    sourceDocId: string,
    userId: string,
  ): Promise<KnowledgeDocDto> {
    await this.requireTeamMember(teamId, userId);
    return this.doImport({ teamId }, sourceDocId, userId);
  }

  // ---------------------------------------------------------------------------
  // Issue KB — effective list = own docs + every ancestor's docs (ancestors-only
  // inheritance). Each is tagged with its source for the badge.
  // ---------------------------------------------------------------------------
  async listIssueEffective(
    issueKey: string,
    userId: string,
  ): Promise<KnowledgeDocDto[]> {
    const issue = await this.membership.getIssueForMember(issueKey, userId);

    // Walk the parent chain, guarding against cycles.
    const chain: { id: string; key: string; title: string }[] = [];
    const seen = new Set<string>();
    let cur: { id: string; key: string; title: string; parentId: string | null } | null =
      issue;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.push({ id: cur.id, key: cur.key, title: cur.title });
      cur = cur.parentId
        ? await this.prisma.issue.findUnique({
            where: { id: cur.parentId },
            select: { id: true, key: true, title: true, parentId: true },
          })
        : null;
    }

    const docs = await this.prisma.knowledgeDoc.findMany({
      where: { issueId: { in: chain.map((c) => c.id) } },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    // Own docs first, then ancestors in chain order.
    const rank = new Map(chain.map((c, i) => [c.id, i]));
    docs.sort((a, b) => (rank.get(a.issueId!) ?? 0) - (rank.get(b.issueId!) ?? 0));

    return docs.map((d) => {
      const isSelf = d.issueId === issue.id;
      const owner = chain.find((c) => c.id === d.issueId);
      const source: SourceSeed = isSelf
        ? { origin: 'self' }
        : {
            origin: 'inherited',
            issueKey: owner?.key,
            issueTitle: owner?.title,
          };
      return this.toDto(d, source, isSelf);
    });
  }

  async createIssueLink(
    issueKey: string,
    dto: CreateKnowledgeLinkDto,
    userId: string,
  ): Promise<KnowledgeDocDto> {
    const issue = await this.membership.getIssueForMember(issueKey, userId);
    return this.createLink({ issueId: issue.id }, dto, userId);
  }

  async createIssueFile(
    issueKey: string,
    file: any,
    title: string | undefined,
    userId: string,
  ): Promise<KnowledgeDocDto> {
    const issue = await this.membership.getIssueForMember(issueKey, userId);
    return this.createFile({ issueId: issue.id }, file, title, userId);
  }

  async importToIssue(
    issueKey: string,
    sourceDocId: string,
    userId: string,
  ): Promise<KnowledgeDocDto> {
    const issue = await this.membership.getIssueForMember(issueKey, userId);
    return this.doImport({ issueId: issue.id }, sourceDocId, userId);
  }

  // ---------------------------------------------------------------------------
  // Import picker — originals from KBs the caller can access.
  // ---------------------------------------------------------------------------
  async importable(
    userId: string,
    search?: string,
  ): Promise<ImportableKnowledgeDocDto[]> {
    const [teams, projects] = await Promise.all([
      this.prisma.teamMember.findMany({
        where: { userId },
        select: { teamId: true },
      }),
      this.prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      }),
    ]);
    const teamIds = teams.map((t) => t.teamId);
    const projectIds = projects.map((p) => p.projectId);

    const or: Prisma.KnowledgeDocWhereInput[] = [];
    if (teamIds.length) or.push({ teamId: { in: teamIds } });
    if (projectIds.length)
      or.push({ issue: { projectId: { in: projectIds } } });
    if (!or.length) return [];

    const where: Prisma.KnowledgeDocWhereInput = { isImport: false, OR: or };
    if (search?.trim()) {
      where.title = { contains: search.trim(), mode: 'insensitive' };
    }

    const docs = await this.prisma.knowledgeDoc.findMany({
      where,
      include: { team: { select: { name: true } }, issue: { select: { key: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      linkKind: d.linkKind ?? null,
      ownerKind: d.teamId ? 'team' : 'issue',
      ownerLabel: d.team?.name ?? d.issue?.key ?? '?',
    }));
  }

  // ---------------------------------------------------------------------------
  // File stream (import resolves to the source's bytes) + delete
  // ---------------------------------------------------------------------------
  async getFile(id: string, userId: string) {
    const doc = await this.prisma.knowledgeDoc.findUnique({
      where: { id },
      include: { issue: { select: { projectId: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertAccess(doc, userId);
    if (doc.type !== 'FILE') {
      throw new BadRequestException('Not a file document');
    }
    // An import shares the source's stored bytes (no re-upload); the snapshot
    // filename carries the same extension so the disk name matches.
    const fileId = doc.isImport ? doc.importedFromId : doc.id;
    if (!fileId) throw new NotFoundException('Source document was removed');
    return {
      stream: createReadStream(
        join(uploadDir(), storedNameFor(fileId, doc.filename ?? '')),
      ),
      mimeType: doc.mimeType ?? 'application/octet-stream',
      filename: doc.filename ?? 'file',
    };
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const doc = await this.prisma.knowledgeDoc.findUnique({
      where: { id },
      include: { issue: { select: { projectId: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertAccess(doc, userId);

    await this.prisma.knowledgeDoc.delete({ where: { id } });
    // Only originals own bytes on disk; imports just referenced them.
    if (doc.type === 'FILE' && !doc.isImport) {
      await fs
        .unlink(join(uploadDir(), storedNameFor(doc.id, doc.filename ?? '')))
        .catch(() => undefined);
    }
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------
  private async createLink(
    owner: { teamId?: string; issueId?: string },
    dto: CreateKnowledgeLinkDto,
    userId: string,
  ): Promise<KnowledgeDocDto> {
    const url = dto.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new BadRequestException('A valid http(s) URL is required');
    }
    if (!dto.title?.trim()) {
      throw new BadRequestException('Title is required');
    }
    const created = await this.prisma.knowledgeDoc.create({
      data: {
        ...owner,
        title: dto.title.trim(),
        type: 'LINK',
        url,
        linkKind: detectLinkKind(url),
        createdById: userId,
      },
      include: INCLUDE,
    });
    return this.toDto(created, { origin: 'self' }, true);
  }

  private async createFile(
    owner: { teamId?: string; issueId?: string },
    file: any,
    title: string | undefined,
    userId: string,
  ): Promise<KnowledgeDocDto> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('File exceeds 10MB limit');
    }
    const dir = uploadDir();
    await fs.mkdir(dir, { recursive: true });

    const filename = file.originalname || 'file';
    const created = await this.prisma.knowledgeDoc.create({
      data: {
        ...owner,
        title: title?.trim() || filename,
        type: 'FILE',
        filename,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        createdById: userId,
      },
      include: INCLUDE,
    });
    await fs.writeFile(
      join(dir, storedNameFor(created.id, filename)),
      file.buffer,
    );
    return this.toDto(created, { origin: 'self' }, true);
  }

  private async doImport(
    owner: { teamId?: string; issueId?: string },
    sourceDocId: string,
    userId: string,
  ): Promise<KnowledgeDocDto> {
    const source = await this.prisma.knowledgeDoc.findUnique({
      where: { id: sourceDocId },
      include: { issue: { select: { projectId: true } } },
    });
    if (!source) throw new NotFoundException('Source document not found');

    // Import originals only — dereference if the picked doc is itself an import.
    let root = source;
    if (source.isImport) {
      if (!source.importedFromId) {
        throw new BadRequestException('Source is a broken import');
      }
      const deref = await this.prisma.knowledgeDoc.findUnique({
        where: { id: source.importedFromId },
        include: { issue: { select: { projectId: true } } },
      });
      if (!deref) throw new NotFoundException('Source document not found');
      root = deref;
    }
    await this.assertAccess(root, userId);

    const created = await this.prisma.knowledgeDoc.create({
      data: {
        ...owner,
        // Snapshot display fields (so a removed source still renders a title);
        // bytes/live provenance come from importedFromId.
        title: root.title,
        type: root.type,
        url: root.url,
        linkKind: root.linkKind,
        filename: root.filename,
        mimeType: root.mimeType,
        size: root.size,
        isImport: true,
        importedFromId: root.id,
        createdById: userId,
      },
      include: INCLUDE,
    });
    return this.toDto(created, { origin: 'self' }, true);
  }

  /** Assert the caller can access a doc via its owning team or issue's project. */
  private async assertAccess(
    doc: { teamId: string | null; issueId: string | null; issue?: { projectId: string } | null },
    userId: string,
  ): Promise<void> {
    if (doc.teamId) {
      await this.requireTeamMember(doc.teamId, userId);
      return;
    }
    if (doc.issueId && doc.issue) {
      await this.membership.requireMembership(doc.issue.projectId, userId);
      return;
    }
    throw new ForbiddenException('No access to this document');
  }

  private async requireTeamMember(teamId: string, userId: string): Promise<void> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this team');
    }
  }

  private toDto(
    doc: DocWithIncludes,
    source: SourceSeed,
    canDelete: boolean,
  ): KnowledgeDocDto {
    const broken = doc.isImport && !doc.importedFromId;
    const importedFrom = doc.isImport
      ? doc.importedFrom
        ? {
            kind: (doc.importedFrom.teamId ? 'team' : 'issue') as 'team' | 'issue',
            label:
              doc.importedFrom.team?.name ?? doc.importedFrom.issue?.key ?? '?',
          }
        : null
      : undefined;
    return {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      url: doc.url ?? null,
      linkKind: doc.linkKind ?? null,
      filename: doc.filename ?? null,
      mimeType: doc.mimeType ?? null,
      size: doc.size ?? null,
      rawUrl:
        doc.type === 'FILE' && !broken
          ? `/api/v1/knowledge/${doc.id}/raw`
          : null,
      createdBy: toUserDto(doc.createdBy),
      createdAt: doc.createdAt.toISOString(),
      source: {
        ...source,
        imported: doc.isImport,
        importedFrom,
        importBroken: broken || undefined,
      },
      canDelete,
    };
  }
}
