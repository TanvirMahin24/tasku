import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type {
  ChatContext,
  ChatReference,
  ChatRole,
  ToolCallTrace,
} from '@tasku/types';
import { PrismaService } from '../../prisma/prisma.service';
import { IssuesService } from '../../issues/issues.service';
import { ProviderFactory } from '../providers/provider.factory';
import { RagService } from '../rag/rag.service';
import { buildTools } from '../tools';
import type { ToolContext } from '../tools/types';
import { MAJHI_SYSTEM_PROMPT } from './system-prompt';
import { resolveChatContext } from './context.util';

export interface AgentRunInput {
  userId: string;
  message: string;
  chatContext?: ChatContext | null;
  history: { role: ChatRole; content: string }[];
}

export interface AgentRunResult {
  text: string;
  references: ChatReference[];
  toolCalls: ToolCallTrace[];
}

@Injectable()
export class MajhiAgent {
  private readonly logger = new Logger(MajhiAgent.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly issues: IssuesService,
    private readonly providers: ProviderFactory,
    private readonly rag: RagService,
  ) {}

  /** Run Majhi for one user turn. Returns `null` when no provider is configured. */
  async run(input: AgentRunInput): Promise<AgentRunResult | null> {
    const bundle = await this.providers.create();
    if (!bundle) return null;

    // De-duped reference + trace collectors shared with every tool.
    const refMap = new Map<string, ChatReference>();
    const toolCalls: ToolCallTrace[] = [];
    const addReference = (ref: ChatReference): void => {
      refMap.set(`${ref.kind}:${ref.id}`, ref);
    };
    const addTrace = (t: ToolCallTrace): void => {
      toolCalls.push(t);
    };

    const [memberProjectIds, memberTeamIds] = await Promise.all([
      this.prisma.projectMember
        .findMany({ where: { userId: input.userId }, select: { projectId: true } })
        .then((rows) => rows.map((r) => r.projectId)),
      this.prisma.teamMember
        .findMany({ where: { userId: input.userId }, select: { teamId: true } })
        .then((rows) => rows.map((r) => r.teamId)),
    ]);

    const toolCtx: ToolContext = {
      userId: input.userId,
      memberProjectIds,
      memberTeamIds,
      chatContext: input.chatContext,
      prisma: this.prisma,
      issues: this.issues,
      rag: this.rag,
      addReference,
      addTrace,
    };

    // Pre-retrieve so references exist even if the model skips tool calls.
    const contextBlock = await this.buildContextBlock(
      input,
      { memberProjectIds, memberTeamIds },
      addReference,
    );

    const tools = buildTools(toolCtx);
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', `${MAJHI_SYSTEM_PROMPT}\n\nContext for this question:\n{context_block}`],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const history = input.history
      .filter((m) => m.role === 'USER' || m.role === 'ASSISTANT')
      .slice(-10)
      .map((m) =>
        m.role === 'USER'
          ? new HumanMessage(m.content)
          : new AIMessage(m.content),
      );

    let text: string;
    try {
      const agent = await createToolCallingAgent({
        llm: bundle.chat,
        tools,
        prompt,
      });
      const executor = new AgentExecutor({
        agent,
        tools,
        maxIterations: 6,
        handleParsingErrors: true,
      });
      const result = await executor.invoke({
        input: input.message,
        chat_history: history,
        context_block: contextBlock,
      });
      text = this.asText(result.output);
    } catch (err) {
      this.logger.warn(`agent run failed, falling back: ${String(err)}`);
      text = await this.fallback(bundle.chat, input, contextBlock, history);
    }

    return { text, references: [...refMap.values()], toolCalls };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  private async buildContextBlock(
    input: AgentRunInput,
    scope: { memberProjectIds: string[]; memberTeamIds: string[] },
    addReference: (r: ChatReference) => void,
  ): Promise<string> {
    const lines: string[] = [];

    const resolved = await resolveChatContext(
      this.prisma,
      input.chatContext,
      input.userId,
      scope.memberProjectIds,
      scope.memberTeamIds,
    );
    resolved.references.forEach(addReference);
    lines.push(resolved.summary);

    const [issueHits, knowledgeHits] = await Promise.all([
      this.rag.retrieveIssues(input.message, scope.memberProjectIds, 5),
      this.rag.retrieveKnowledge(
        input.message,
        { teamIds: scope.memberTeamIds, projectIds: scope.memberProjectIds },
        4,
      ),
    ]);

    if (issueHits.length) {
      lines.push('\nPossibly relevant issues:');
      for (const h of issueHits) {
        lines.push(`- ${h.key}: ${h.title}`);
        addReference({
          kind: 'issue',
          id: h.issueId,
          key: h.key,
          title: h.title,
          url: `/issues/${h.key}`,
        });
      }
    }

    if (knowledgeHits.length) {
      lines.push('\nPossibly relevant knowledge-base passages:');
      const seen = new Set<string>();
      for (const h of knowledgeHits) {
        lines.push(`- ${h.title}: ${h.content.slice(0, 200)}`);
        if (!seen.has(h.docId)) {
          seen.add(h.docId);
          addReference({
            kind: 'knowledge',
            id: h.docId,
            title: h.title,
            url: h.url ?? null,
          });
        }
      }
    }

    if (!issueHits.length && !knowledgeHits.length) {
      lines.push(
        '\n(No pre-retrieved matches — use tools to look things up as needed.)',
      );
    }

    return lines.join('\n');
  }

  private async fallback(
    chat: BaseChatModel,
    input: AgentRunInput,
    contextBlock: string,
    history: (HumanMessage | AIMessage)[],
  ): Promise<string> {
    try {
      const res = await chat.invoke([
        new AIMessage(MAJHI_SYSTEM_PROMPT),
        ...history,
        new HumanMessage(
          `Context for this question:\n${contextBlock}\n\nQuestion: ${input.message}`,
        ),
      ]);
      return this.asText(res?.content ?? res);
    } catch (err) {
      this.logger.warn(`fallback failed: ${String(err)}`);
      return "I'm having trouble reaching the AI model right now. Please try again in a moment.";
    }
  }

  private asText(output: unknown): string {
    if (typeof output === 'string') return output;
    if (Array.isArray(output)) {
      return output
        .map((p) =>
          typeof p === 'string' ? p : typeof p?.text === 'string' ? p.text : '',
        )
        .join('');
    }
    if (output && typeof (output as any).content === 'string') {
      return (output as any).content;
    }
    return String(output ?? '');
  }
}
