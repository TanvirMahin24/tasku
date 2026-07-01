import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AiStatusDto } from '@tasku/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AiConfig } from './ai.config';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class StatusController {
  constructor(
    private readonly config: AiConfig,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  async status(@CurrentUser() user: AuthUser): Promise<AiStatusDto> {
    const [providers, provider, models, googleConn] = await Promise.all([
      this.config.getProviders(),
      this.config.activeProvider(),
      this.config.models(),
      this.prisma.googleConnection.findUnique({
        where: { userId: user.id },
        select: { userId: true },
      }),
    ]);
    return {
      enabled: providers.ollama || providers.gemini,
      provider,
      chatModel: models.chatModel,
      embedModel: models.embedModel,
      providers,
      googleConnected: !!googleConn,
    };
  }
}
