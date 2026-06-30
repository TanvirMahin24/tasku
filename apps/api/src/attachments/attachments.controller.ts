import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { AttachmentDto } from '@tasku/types';
import { AttachmentsService } from './attachments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post('issues/:issueKey/attachments')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('issueKey') issueKey: string,
    @UploadedFile() file: any,
    @CurrentUser() user: AuthUser,
  ): Promise<AttachmentDto> {
    return this.attachments.create(issueKey, file, user.id);
  }

  @Get('attachments/:id/raw')
  async raw(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, mimeType, filename } = await this.attachments.getFile(
      id,
      user.id,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete('attachments/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attachments.remove(id, user.id);
  }
}
