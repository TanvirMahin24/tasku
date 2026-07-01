-- CreateEnum
CREATE TYPE "ViewScope" AS ENUM ('GLOBAL', 'TEAM');

-- CreateTable
CREATE TABLE "View" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scope" "ViewScope" NOT NULL DEFAULT 'GLOBAL',
    "teamId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "responsibleId" TEXT,
    "criteria" JSONB NOT NULL,
    "columns" JSONB NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "View_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewStar" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ViewStar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewActivity" (
    "id" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ViewTeams" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "View_teamId_idx" ON "View"("teamId");

-- CreateIndex
CREATE INDEX "View_archived_idx" ON "View"("archived");

-- CreateIndex
CREATE INDEX "ViewStar_userId_idx" ON "ViewStar"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewStar_viewId_userId_key" ON "ViewStar"("viewId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "_ViewTeams_AB_unique" ON "_ViewTeams"("A", "B");

-- CreateIndex
CREATE INDEX "_ViewTeams_B_index" ON "_ViewTeams"("B");

-- AddForeignKey
ALTER TABLE "View" ADD CONSTRAINT "View_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "View" ADD CONSTRAINT "View_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "View" ADD CONSTRAINT "View_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewStar" ADD CONSTRAINT "ViewStar_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewStar" ADD CONSTRAINT "ViewStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewActivity" ADD CONSTRAINT "ViewActivity_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewActivity" ADD CONSTRAINT "ViewActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ViewTeams" ADD CONSTRAINT "_ViewTeams_A_fkey" FOREIGN KEY ("A") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ViewTeams" ADD CONSTRAINT "_ViewTeams_B_fkey" FOREIGN KEY ("B") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;
