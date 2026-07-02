import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import type { KnowledgeIngestDto } from '@tasku/types';
import { PrismaService } from '../../prisma/prisma.service';
import { MembershipService } from '../../common/membership.service';
import { RagService } from '../rag/rag.service';
import { GoogleService } from '../google/google.service';

function uploadDir(): string {
  return process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
}
function storedNameFor(id: string, filename: string): string {
  return `${id}${extname(filename || '')}`;
}

/** MIME/extension whitelist for FILE docs we can extract text from directly. */
function isTextFile(mimeType: string | null, filename: string | null): boolean {
  const mt = (mimeType || '').toLowerCase();
  if (
    mt.startsWith('text/') ||
    mt === 'application/json' ||
    mt === 'application/xml' ||
    mt === 'application/x-ndjson'
  ) {
    return true;
  }
  const ext = extname(filename || '').toLowerCase();
  return ['.txt', '.md', '.markdown', '.csv', '.json', '.log', '.xml'].includes(
    ext,
  );
}

@Injectable()
export class IngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly rag: RagService,
    private readonly google: GoogleService,
  ) {}

  // ---------------------------------------------------------------------------
  // Ingest a single doc
  // ---------------------------------------------------------------------------
  async ingest(docId: string, userId: string): Promise<KnowledgeIngestDto> {
    const doc = await this.prisma.knowledgeDoc.findUnique({
      where: { id: docId },
      include: { issue: { select: { projectId: true } } },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertAccess(doc, userId);

    // Imports resolve their content from the source doc.
    let source = doc;
    if (doc.isImport && doc.importedFromId) {
      const root = await this.prisma.knowledgeDoc.findUnique({
        where: { id: doc.importedFromId },
      });
      if (root) source = { ...doc, ...root, id: doc.id }; // keep target id for storage keys below
    }

    let text: string | null = null;
    let unsupported: string | null = null;

    if (source.type === 'LINK') {
      const url = source.url ?? '';
      const detected = this.google.detectFile(url);
      if (detected) {
        const conn = await this.prisma.googleConnection.findUnique({
          where: { userId },
          select: { userId: true },
        });
        if (!this.google.isConfigured() || !conn) {
          unsupported = 'Connect a Google account to ingest this link';
        } else {
          try {
            text = await this.google.fetchGoogleFileText(
              userId,
              detected.fileId,
              detected.kind,
            );
          } catch (err) {
            return this.mark(docId, 'ERROR', String(err).slice(0, 300));
          }
        }
      } else {
        unsupported = 'Only Google Docs/Sheets/Slides links can be ingested';
      }
    } else {
      // FILE
      if (isTextFile(source.mimeType, source.filename)) {
        const fileId = doc.isImport ? doc.importedFromId! : doc.id;
        try {
          text = await fs.readFile(
            join(uploadDir(), storedNameFor(fileId, source.filename ?? '')),
            'utf8',
          );
        } catch (err) {
          return this.mark(docId, 'ERROR', `Could not read file: ${String(err).slice(0, 200)}`);
        }
      } else {
        unsupported = `Unsupported file type (${source.mimeType ?? 'unknown'})`;
      }
    }

    if (unsupported) {
      return this.mark(docId, 'UNSUPPORTED', unsupported);
    }

    await this.rag.ingestDocContent(docId, text ?? '');
    return this.toDto(docId);
  }

  private async mark(
    docId: string,
    status: 'PENDING' | 'READY' | 'ERROR' | 'UNSUPPORTED',
    error: string | null,
  ): Promise<KnowledgeIngestDto> {
    await this.prisma.knowledgeDoc.update({
      where: { id: docId },
      data: { ingestStatus: status, ingestError: error, ingestedAt: null },
    });
    return this.toDto(docId);
  }

  // ---------------------------------------------------------------------------
  // Status list
  // ---------------------------------------------------------------------------
  async listStatus(
    userId: string,
    teamId?: string,
    issueId?: string,
  ): Promise<KnowledgeIngestDto[]> {
    if (teamId) {
      await this.requireTeamMember(teamId, userId);
      return this.statusFor({ teamId });
    }
    if (issueId) {
      // The web client passes the issue *key* (e.g. "TASK-1"), matching the
      // other issue-knowledge endpoints; resolve key -> id and check access.
      const issue = await this.membership.getIssueForMember(issueId, userId);
      return this.statusFor({ issueId: issue.id });
    }
    return [];
  }

  private async statusFor(where: {
    teamId?: string;
    issueId?: string;
  }): Promise<KnowledgeIngestDto[]> {
    const docs = await this.prisma.knowledgeDoc.findMany({
      where,
      include: { _count: { select: { chunks: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      ingestStatus: d.ingestStatus,
      ingestError: d.ingestError ?? null,
      chunkCount: d._count.chunks,
      ingestedAt: d.ingestedAt ? d.ingestedAt.toISOString() : null,
    }));
  }

  private async toDto(docId: string): Promise<KnowledgeIngestDto> {
    const doc = await this.prisma.knowledgeDoc.findUniqueOrThrow({
      where: { id: docId },
      include: { _count: { select: { chunks: true } } },
    });
    return {
      id: doc.id,
      title: doc.title,
      ingestStatus: doc.ingestStatus,
      ingestError: doc.ingestError ?? null,
      chunkCount: doc._count.chunks,
      ingestedAt: doc.ingestedAt ? doc.ingestedAt.toISOString() : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Access
  // ---------------------------------------------------------------------------
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
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new ForbiddenException('You are not a member of this team');
  }
}
