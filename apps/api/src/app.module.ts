import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { IssuesModule } from './issues/issues.module';
import { BoardModule } from './board/board.module';
import { BoardsModule } from './boards/boards.module';
import { SprintsModule } from './sprints/sprints.module';
import { CommentsModule } from './comments/comments.module';
import { LabelsModule } from './labels/labels.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TeamsModule } from './teams/teams.module';
import { TimelineModule } from './timeline/timeline.module';
import { OverviewModule } from './overview/overview.module';
import { SearchModule } from './search/search.module';
import { LinksModule } from './links/links.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { WatchersModule } from './watchers/watchers.module';
import { WorklogsModule } from './worklogs/worklogs.module';
import { ReportsModule } from './reports/reports.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { VersionsModule } from './versions/versions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { MentionsModule } from './mentions/mentions.module';
import { ViewsModule } from './views/views.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    EventsModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    IssuesModule,
    BoardModule,
    BoardsModule,
    SprintsModule,
    CommentsModule,
    LabelsModule,
    NotificationsModule,
    TeamsModule,
    TimelineModule,
    OverviewModule,
    SearchModule,
    LinksModule,
    AttachmentsModule,
    WatchersModule,
    WorklogsModule,
    ReportsModule,
    CustomFieldsModule,
    VersionsModule,
    DashboardModule,
    KnowledgeModule,
    MentionsModule,
    ViewsModule,
  ],
})
export class AppModule {}
