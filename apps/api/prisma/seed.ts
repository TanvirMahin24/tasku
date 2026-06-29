/**
 * Seed script — realistic demo data for local dev.
 *
 * Creates 3 users, a "TASK" project (Tasku Demo) with the default workflow,
 * a handful of labels, one ACTIVE and one FUTURE sprint, and ~8 issues across
 * types/statuses with LexoRank ordering. Idempotent-ish: users are upserted by
 * email; if the TASK project already exists the issue/sprint seeding is skipped.
 *
 * Run: `npm run db:seed` (or `tsx prisma/seed.ts`).
 */
import {
  PrismaClient,
  Role,
  StatusCategory,
  IssueType,
  Priority,
  SprintState,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { LexoRank } from 'lexorank';

const prisma = new PrismaClient();

/** Generates an ascending sequence of lexorank strings for a column. */
function rankSequence(count: number): string[] {
  const ranks: string[] = [];
  let current = LexoRank.middle();
  for (let i = 0; i < count; i++) {
    ranks.push(current.toString());
    current = current.genNext();
  }
  return ranks;
}

async function main() {
  const passwordHash = await bcrypt.hash('password', 10);

  const [alice, bob, carol] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'alice@tasku.dev' },
      update: {},
      create: {
        email: 'alice@tasku.dev',
        passwordHash,
        displayName: 'Alice',
      },
    }),
    prisma.user.upsert({
      where: { email: 'bob@tasku.dev' },
      update: {},
      create: {
        email: 'bob@tasku.dev',
        passwordHash,
        displayName: 'Bob',
      },
    }),
    prisma.user.upsert({
      where: { email: 'carol@tasku.dev' },
      update: {},
      create: {
        email: 'carol@tasku.dev',
        passwordHash,
        displayName: 'Carol',
      },
    }),
  ]);

  const existingProject = await prisma.project.findUnique({
    where: { key: 'TASK' },
  });
  if (existingProject) {
    console.log('Project TASK already exists — skipping demo data.');
    return;
  }

  // --- Project + default workflow + members ---
  const project = await prisma.project.create({
    data: {
      key: 'TASK',
      name: 'Tasku Demo',
      description: 'A demo project showing off Tasku.',
      leadId: alice.id,
      statuses: {
        create: [
          { name: 'To Do', category: StatusCategory.TODO, order: 0 },
          { name: 'In Progress', category: StatusCategory.IN_PROGRESS, order: 1 },
          { name: 'Done', category: StatusCategory.DONE, order: 2 },
        ],
      },
      members: {
        create: [
          { userId: alice.id, role: Role.ADMIN },
          { userId: bob.id, role: Role.MEMBER },
          { userId: carol.id, role: Role.MEMBER },
        ],
      },
      labels: {
        create: [
          { name: 'frontend', color: '#3b82f6' },
          { name: 'backend', color: '#10b981' },
          { name: 'bug', color: '#ef4444' },
          { name: 'design', color: '#a855f7' },
        ],
      },
    },
    include: { statuses: true, labels: true },
  });

  const todo = project.statuses.find((s) => s.category === StatusCategory.TODO)!;
  const inProgress = project.statuses.find(
    (s) => s.category === StatusCategory.IN_PROGRESS,
  )!;
  const done = project.statuses.find((s) => s.category === StatusCategory.DONE)!;

  const labelByName = new Map(project.labels.map((l) => [l.name, l.id]));

  // --- Sprints (one active, one future) ---
  const activeSprint = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: 'Sprint 1',
      goal: 'Ship the core board.',
      state: SprintState.ACTIVE,
      startDate: new Date(),
    },
  });
  const futureSprint = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: 'Sprint 2',
      goal: 'Agile layer.',
      state: SprintState.FUTURE,
    },
  });

  // --- Issues ---
  // Per-column ascending ranks.
  const todoRanks = rankSequence(4);
  const inProgressRanks = rankSequence(3);
  const doneRanks = rankSequence(3);

  type Seed = {
    type: IssueType;
    title: string;
    description?: string;
    statusId: string;
    rank: string;
    priority: Priority;
    assigneeId?: string;
    reporterId: string;
    sprintId?: string | null;
    storyPoints?: number;
    labels?: string[];
    isEpic?: boolean;
  };

  // Define an epic first so children can reference it.
  const epic = await prisma.issue.create({
    data: {
      projectId: project.id,
      key: 'TASK-1',
      seq: 1,
      type: IssueType.EPIC,
      title: 'Core board experience',
      description: 'Umbrella epic for the Kanban board MVP.',
      statusId: inProgress.id,
      rank: inProgressRanks[0],
      priority: Priority.HIGH,
      reporterId: alice.id,
      assigneeId: alice.id,
      sprintId: activeSprint.id,
      storyPoints: 13,
    },
  });
  await prisma.activityLog.create({
    data: {
      issueId: epic.id,
      actorId: alice.id,
      field: 'created',
      newValue: epic.key,
    },
  });

  const seeds: Seed[] = [
    {
      type: IssueType.STORY,
      title: 'Drag-and-drop cards between columns',
      description: 'Cards should reorder via lexorank.',
      statusId: inProgress.id,
      rank: inProgressRanks[1],
      priority: Priority.HIGH,
      assigneeId: bob.id,
      reporterId: alice.id,
      sprintId: activeSprint.id,
      storyPoints: 5,
      labels: ['frontend'],
    },
    {
      type: IssueType.STORY,
      title: 'Issue detail drawer',
      statusId: inProgress.id,
      rank: inProgressRanks[2],
      priority: Priority.MEDIUM,
      assigneeId: carol.id,
      reporterId: bob.id,
      sprintId: activeSprint.id,
      storyPoints: 3,
      labels: ['frontend', 'design'],
    },
    {
      type: IssueType.TASK,
      title: 'Set up WebSocket gateway',
      statusId: done.id,
      rank: doneRanks[0],
      priority: Priority.MEDIUM,
      assigneeId: alice.id,
      reporterId: alice.id,
      sprintId: activeSprint.id,
      storyPoints: 2,
      labels: ['backend'],
    },
    {
      type: IssueType.BUG,
      title: 'Board flickers on reorder',
      description: 'Rank collisions cause a re-render loop.',
      statusId: done.id,
      rank: doneRanks[1],
      priority: Priority.HIGHEST,
      assigneeId: bob.id,
      reporterId: carol.id,
      sprintId: activeSprint.id,
      storyPoints: 1,
      labels: ['bug', 'frontend'],
    },
    {
      type: IssueType.TASK,
      title: 'Seed demo data',
      statusId: done.id,
      rank: doneRanks[2],
      priority: Priority.LOW,
      assigneeId: alice.id,
      reporterId: alice.id,
      sprintId: activeSprint.id,
      storyPoints: 1,
      labels: ['backend'],
    },
    {
      type: IssueType.STORY,
      title: 'Backlog view with sprints',
      statusId: todo.id,
      rank: todoRanks[0],
      priority: Priority.MEDIUM,
      assigneeId: carol.id,
      reporterId: alice.id,
      sprintId: futureSprint.id,
      storyPoints: 5,
      labels: ['frontend'],
    },
    {
      type: IssueType.BUG,
      title: 'Notifications not marked read',
      statusId: todo.id,
      rank: todoRanks[1],
      priority: Priority.HIGH,
      reporterId: bob.id,
      // unassigned + in backlog (no sprint)
      sprintId: null,
      labels: ['bug', 'backend'],
    },
  ];

  let seq = 2; // epic was TASK-1
  for (const s of seeds) {
    const issue = await prisma.issue.create({
      data: {
        projectId: project.id,
        key: `TASK-${seq}`,
        seq,
        type: s.type,
        title: s.title,
        description: s.description ?? null,
        statusId: s.statusId,
        rank: s.rank,
        priority: s.priority,
        reporterId: s.reporterId,
        assigneeId: s.assigneeId ?? null,
        sprintId: s.sprintId === undefined ? activeSprint.id : s.sprintId,
        storyPoints: s.storyPoints ?? null,
        parentId: s.type === IssueType.STORY ? epic.id : null,
        labels: s.labels?.length
          ? {
              create: s.labels
                .map((name) => labelByName.get(name))
                .filter((id): id is string => Boolean(id))
                .map((labelId) => ({ labelId })),
            }
          : undefined,
      },
    });
    await prisma.activityLog.create({
      data: {
        issueId: issue.id,
        actorId: s.reporterId,
        field: 'created',
        newValue: issue.key,
      },
    });
    if (issue.assigneeId && issue.assigneeId !== s.reporterId) {
      await prisma.notification.create({
        data: {
          recipientId: issue.assigneeId,
          type: 'ASSIGNED',
          issueKey: issue.key,
          message: `You were assigned to ${issue.key}: ${issue.title}`,
        },
      });
    }
    seq++;
  }

  // A subtask under the drag-and-drop story (TASK-2).
  const dndStory = await prisma.issue.findUnique({
    where: { key: 'TASK-2' },
  });
  if (dndStory) {
    const subSeq = seq;
    const subtask = await prisma.issue.create({
      data: {
        projectId: project.id,
        key: `TASK-${subSeq}`,
        seq: subSeq,
        type: IssueType.SUBTASK,
        title: 'Compute rank on drop',
        statusId: todo.id,
        rank: todoRanks[2],
        priority: Priority.MEDIUM,
        reporterId: bob.id,
        assigneeId: bob.id,
        parentId: dndStory.id,
        sprintId: activeSprint.id,
        storyPoints: 2,
      },
    });
    await prisma.activityLog.create({
      data: {
        issueId: subtask.id,
        actorId: bob.id,
        field: 'created',
        newValue: subtask.key,
      },
    });
    seq++;
  }

  // Keep the project's sequence counter consistent with seeded keys.
  await prisma.project.update({
    where: { id: project.id },
    data: { issueSeq: seq - 1 },
  });

  // A couple of comments to populate the activity feed.
  const commentTarget = await prisma.issue.findUnique({
    where: { key: 'TASK-2' },
  });
  if (commentTarget) {
    await prisma.comment.create({
      data: {
        issueId: commentTarget.id,
        authorId: alice.id,
        body: 'Looks great @Bob — can you add keyboard support too?',
      },
    });
    await prisma.activityLog.create({
      data: { issueId: commentTarget.id, actorId: alice.id, field: 'comment' },
    });
    await prisma.notification.create({
      data: {
        recipientId: bob.id,
        type: 'MENTIONED',
        issueKey: commentTarget.key,
        message: `You were mentioned on ${commentTarget.key}`,
      },
    });
  }

  console.log('Seed complete:');
  console.log('  users: alice@tasku.dev / bob@tasku.dev / carol@tasku.dev (password: "password")');
  console.log(`  project: TASK (Tasku Demo), ${seq - 1} issues`);
  console.log(`  sprints: ${activeSprint.name} (ACTIVE), ${futureSprint.name} (FUTURE)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
