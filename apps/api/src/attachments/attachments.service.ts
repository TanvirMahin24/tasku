import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AttachmentDto } from '@tasku/types';
import { promises as fs, createReadStream } from 'fs';
import { extname, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { toAttachmentDto } from '../common/mappers';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/** Resolves the on-disk upload directory. */
function uploadDir(): string {
  return process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
}

/**
 * Bytes are stored as `${attachmentId}${ext}`. The attachment id is a Prisma
 * cuid, so the disk name is unique without needing an extra cuid library or a
 * schema column — we derive it from the row id + the original extension.
 */
function storedNameFor(id: string, filename: string): string {
  return `${id}${extname(filename || '')}`;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
  ) {}

  async create(
    issueKey: string,
    file: any,
    userId: string,
  ): Promise<AttachmentDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('File exceeds 10MB limit');
    }
    const issue = await this.membership.getIssueForMember(issueKey, userId);

    const dir = uploadDir();
    await fs.mkdir(dir, { recursive: true });

    const created = await this.prisma.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          issueId: issue.id,
          filename: file.originalname || 'file',
          url: '', // filled below once we have the id
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size,
        },
      });
      const withUrl = await tx.attachment.update({
        where: { id: attachment.id },
        data: { url: `/api/v1/attachments/${attachment.id}/raw` },
      });
      await tx.activityLog.create({
        data: {
          issueId: issue.id,
          actorId: userId,
          field: 'attachment',
          oldValue: null,
          newValue: withUrl.filename,
        },
      });
      return withUrl;
    });

    // Write the bytes under the derived disk name.
    await fs.writeFile(
      join(dir, storedNameFor(created.id, created.filename)),
      file.buffer,
    );

    return toAttachmentDto(created);
  }

  /** Locate a stored attachment for streaming, asserting access. */
  async getFile(id: string, userId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: { issue: { select: { projectId: true } } },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    await this.membership.requireMembership(attachment.issue.projectId, userId);

    const path = join(uploadDir(), storedNameFor(id, attachment.filename));
    return {
      stream: createReadStream(path),
      mimeType: attachment.mimeType,
      filename: attachment.filename,
    };
  }

  async remove(id: string, userId: string): Promise<{ success: boolean }> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: { issue: { select: { projectId: true } } },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    await this.membership.requireMembership(attachment.issue.projectId, userId);

    await this.prisma.attachment.delete({ where: { id } });
    // Best-effort unlink; ignore a missing file.
    await fs
      .unlink(join(uploadDir(), storedNameFor(id, attachment.filename)))
      .catch(() => undefined);
    return { success: true };
  }
}
