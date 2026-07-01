import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { chunkText, docToText, toVectorLiteral } from './chunk.util';

export interface IssueHit {
  issueId: string;
  key: string;
  title: string;
  score: number;
}

export interface KnowledgeHit {
  chunkId: string;
  docId: string;
  title: string;
  url: string | null;
  content: string;
  score: number;
}

/**
 * Retrieval-Augmented-Generation layer. Owns embedding + the raw-SQL reads and
 * writes of the pgvector `vector(768)` columns (which the Prisma client cannot
 * touch). Every method no-ops safely when no AI provider is configured.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
  ) {}

  // ---------------------------------------------------------------------------
  // Embeddings
  // ---------------------------------------------------------------------------
  async embed(texts: string[]): Promise<number[][] | null> {
    if (!texts.length) return [];
    const bundle = await this.providers.create();
    if (!bundle) return null;
    try {
      return await bundle.embeddings.embedDocuments(texts);
    } catch (err) {
      this.logger.warn(`embed failed: ${String(err)}`);
      return null;
    }
  }

  async embedQuery(text: string): Promise<number[] | null> {
    const bundle = await this.providers.create();
    if (!bundle) return null;
    try {
      return await bundle.embeddings.embedQuery(text);
    } catch (err) {
      this.logger.warn(`embedQuery failed: ${String(err)}`);
      return null;
    }
  }

  private hash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }

  // ---------------------------------------------------------------------------
  // Issue ingestion (title + key + description -> IssueEmbedding)
  // ---------------------------------------------------------------------------
  async ingestIssue(issueId: string): Promise<boolean> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, key: true, title: true, description: true },
    });
    if (!issue) return false;

    const text = [issue.key, issue.title, docToText(issue.description)]
      .filter(Boolean)
      .join('\n');
    const textHash = this.hash(text);

    const existing = await this.prisma.issueEmbedding.findUnique({
      where: { issueId },
      select: { textHash: true },
    });
    if (existing?.textHash === textHash) return true; // unchanged

    const vectors = await this.embed([text]);
    if (!vectors || !vectors[0]) return false;

    // Upsert non-vector columns via the client, then set the vector via raw SQL.
    await this.prisma.issueEmbedding.upsert({
      where: { issueId },
      create: { issueId, textHash },
      update: { textHash },
    });
    await this.prisma.$executeRawUnsafe(
      'UPDATE "IssueEmbedding" SET embedding = $1::vector WHERE "issueId" = $2',
      toVectorLiteral(vectors[0]),
      issueId,
    );
    return true;
  }

  // ---------------------------------------------------------------------------
  // Doc ingestion (chunk -> embed -> KnowledgeChunk rows + vectors)
  // ---------------------------------------------------------------------------
  async ingestDocContent(docId: string, text: string): Promise<void> {
    const clean = docToText(text);
    const contentHash = this.hash(clean);

    // Persist extracted text regardless of embedding availability.
    await this.prisma.knowledgeDoc.update({
      where: { id: docId },
      data: { content: clean, contentHash },
    });

    if (!clean.trim()) {
      await this.markDoc(docId, 'UNSUPPORTED', 'No extractable text');
      return;
    }

    const chunks = chunkText(clean);
    const vectors = await this.embed(chunks);
    if (!vectors) {
      // No provider — leave as PENDING so it can be retried once configured.
      await this.markDoc(
        docId,
        'PENDING',
        'AI provider not configured; retry ingestion after setup',
        false,
      );
      return;
    }

    try {
      await this.prisma.knowledgeChunk.deleteMany({ where: { docId } });
      for (let i = 0; i < chunks.length; i++) {
        const row = await this.prisma.knowledgeChunk.create({
          data: { docId, ord: i, content: chunks[i] },
          select: { id: true },
        });
        await this.prisma.$executeRawUnsafe(
          'UPDATE "KnowledgeChunk" SET embedding = $1::vector WHERE id = $2',
          toVectorLiteral(vectors[i]),
          row.id,
        );
      }
      await this.markDoc(docId, 'READY', null, true);
    } catch (err) {
      this.logger.warn(`ingestDocContent failed for ${docId}: ${String(err)}`);
      await this.markDoc(docId, 'ERROR', String(err).slice(0, 500));
    }
  }

  private async markDoc(
    docId: string,
    status: 'PENDING' | 'READY' | 'ERROR' | 'UNSUPPORTED',
    error: string | null,
    stamp = false,
  ): Promise<void> {
    await this.prisma.knowledgeDoc.update({
      where: { id: docId },
      data: {
        ingestStatus: status,
        ingestError: error,
        ingestedAt: stamp ? new Date() : null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Retrieval (pgvector cosine distance)
  // ---------------------------------------------------------------------------
  async retrieveIssues(
    query: string,
    projectIds: string[],
    k = 6,
  ): Promise<IssueHit[]> {
    if (!projectIds.length) return [];
    const vec = await this.embedQuery(query);
    if (!vec) return [];
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        { issueId: string; key: string; title: string; score: number }[]
      >(
        `SELECT e."issueId" AS "issueId", i.key AS key, i.title AS title,
                1 - (e.embedding <=> $1::vector) AS score
           FROM "IssueEmbedding" e
           JOIN "Issue" i ON i.id = e."issueId"
          WHERE e.embedding IS NOT NULL
            AND i."projectId" = ANY($2::text[])
          ORDER BY e.embedding <=> $1::vector
          LIMIT $3`,
        toVectorLiteral(vec),
        projectIds,
        k,
      );
      return rows.map((r) => ({ ...r, score: Number(r.score) }));
    } catch (err) {
      this.logger.warn(`retrieveIssues failed: ${String(err)}`);
      return [];
    }
  }

  async retrieveKnowledge(
    query: string,
    scope: { teamIds: string[]; projectIds: string[] },
    k = 6,
  ): Promise<KnowledgeHit[]> {
    const teamIds = scope.teamIds ?? [];
    const projectIds = scope.projectIds ?? [];
    if (!teamIds.length && !projectIds.length) return [];
    const vec = await this.embedQuery(query);
    if (!vec) return [];
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        {
          chunkId: string;
          docId: string;
          title: string;
          url: string | null;
          content: string;
          score: number;
        }[]
      >(
        `SELECT c.id AS "chunkId", c."docId" AS "docId", d.title AS title,
                d.url AS url, c.content AS content,
                1 - (c.embedding <=> $1::vector) AS score
           FROM "KnowledgeChunk" c
           JOIN "KnowledgeDoc" d ON d.id = c."docId"
           LEFT JOIN "Issue" i ON i.id = d."issueId"
          WHERE c.embedding IS NOT NULL
            AND (d."teamId" = ANY($2::text[]) OR i."projectId" = ANY($3::text[]))
          ORDER BY c.embedding <=> $1::vector
          LIMIT $4`,
        toVectorLiteral(vec),
        teamIds,
        projectIds,
        k,
      );
      return rows.map((r) => ({ ...r, score: Number(r.score) }));
    } catch (err) {
      this.logger.warn(`retrieveKnowledge failed: ${String(err)}`);
      return [];
    }
  }
}
