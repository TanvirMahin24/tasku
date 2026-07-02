import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatRole as PrismaChatRole, type ChatMessage } from '@prisma/client';
import type {
  ChatMessageDto,
  ChatReference,
  ChatResponseDto,
  ChatRole,
  ChatSessionDto,
  ChatSessionSummaryDto,
  ToolCallTrace,
} from '@tasku/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AiConfig } from '../ai.config';
import { MajhiAgent } from '../agent/majhi.agent';
import { SendChatDto } from './dto/send-chat.dto';

const NO_PROVIDER_MESSAGE =
  'Majhi is not configured yet. Ask an administrator to set a `GEMINI_API_KEY` ' +
  '(Gemini) or run a local Ollama server (`OLLAMA_BASE_URL`) to enable the AI ' +
  'assistant.';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AiConfig,
    private readonly agent: MajhiAgent,
  ) {}

  // ---------------------------------------------------------------------------
  // Send a message
  // ---------------------------------------------------------------------------
  async send(userId: string, dto: SendChatDto): Promise<ChatResponseDto> {
    const session = await this.resolveSession(userId, dto);

    const history = await this.prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
    });

    // Always record the user's message.
    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: PrismaChatRole.USER,
        content: dto.message,
        references: [],
      },
    });

    const provider = await this.config.activeProvider();

    let text: string;
    let references: ChatReference[] = [];
    let toolCalls: ToolCallTrace[] = [];

    if (!provider) {
      text = NO_PROVIDER_MESSAGE;
    } else {
      try {
        const result = await this.agent.run({
          userId,
          message: dto.message,
          chatContext: dto.context ?? null,
          history: history.map((m) => ({
            role: m.role as ChatRole,
            content: m.content,
          })),
        });
        if (!result) {
          text = NO_PROVIDER_MESSAGE;
        } else {
          text = result.text;
          references = result.references;
          toolCalls = result.toolCalls;
        }
      } catch {
        text =
          "I ran into a problem while thinking about that. Please try again in a moment.";
      }
    }

    const assistant = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: PrismaChatRole.ASSISTANT,
        content: text,
        references: references as unknown as object,
        toolCalls: toolCalls as unknown as object,
      },
    });

    // Touch the session so it sorts to the top.
    await this.prisma.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    });

    return { sessionId: session.id, message: this.toMessageDto(assistant) };
  }

  private async resolveSession(userId: string, dto: SendChatDto) {
    if (dto.sessionId) {
      const existing = await this.prisma.chatSession.findUnique({
        where: { id: dto.sessionId },
      });
      if (!existing) throw new NotFoundException('Chat session not found');
      if (existing.userId !== userId) {
        throw new ForbiddenException('Not your chat session');
      }
      return existing;
    }
    const title = this.deriveTitle(dto.message);
    return this.prisma.chatSession.create({
      data: {
        userId,
        title,
        contextType: dto.context?.type ?? null,
        contextId: dto.context?.id ?? dto.context?.projectKey ?? null,
      },
    });
  }

  private deriveTitle(message: string): string {
    const clean = message.replace(/\s+/g, ' ').trim();
    return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean || 'New chat';
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------
  async listSessions(userId: string): Promise<ChatSessionSummaryDto[]> {
    const sessions = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return sessions.map((s) => this.toSummary(s));
  }

  async getSession(id: string, userId: string): Promise<ChatSessionDto> {
    const session = await this.prisma.chatSession.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session) throw new NotFoundException('Chat session not found');
    if (session.userId !== userId) {
      throw new ForbiddenException('Not your chat session');
    }
    return {
      ...this.toSummary(session),
      messages: session.messages.map((m) => this.toMessageDto(m)),
    };
  }

  async deleteSession(
    id: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    const session = await this.prisma.chatSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Chat session not found');
    if (session.userId !== userId) {
      throw new ForbiddenException('Not your chat session');
    }
    await this.prisma.chatSession.delete({ where: { id } });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Mappers
  // ---------------------------------------------------------------------------
  private toSummary(s: {
    id: string;
    title: string;
    contextType: string | null;
    contextId: string | null;
    updatedAt: Date;
  }): ChatSessionSummaryDto {
    return {
      id: s.id,
      title: s.title,
      contextType: s.contextType,
      contextId: s.contextId,
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private toMessageDto(m: ChatMessage): ChatMessageDto {
    return {
      id: m.id,
      role: m.role as ChatRole,
      content: m.content,
      references: (m.references as unknown as ChatReference[]) ?? [],
      toolCalls: (m.toolCalls as unknown as ToolCallTrace[]) ?? undefined,
      createdAt: m.createdAt.toISOString(),
    };
  }
}
