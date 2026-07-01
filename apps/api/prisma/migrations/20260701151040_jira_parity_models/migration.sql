-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'CHECKBOX', 'SELECT', 'MULTI_SELECT', 'USER', 'URL');

-- AlterEnum
ALTER TYPE "IssueType" ADD VALUE 'IDEA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LinkType" ADD VALUE 'DELIVERS';
ALTER TYPE "LinkType" ADD VALUE 'DELIVERED_BY';

-- CreateTable
CREATE TABLE "BoardStar" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardStar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldValue" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Version" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "released" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "releaseDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IssueVersions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "BoardStar_userId_idx" ON "BoardStar"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardStar_boardId_userId_key" ON "BoardStar"("boardId", "userId");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_projectId_idx" ON "CustomFieldDefinition"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_projectId_name_key" ON "CustomFieldDefinition"("projectId", "name");

-- CreateIndex
CREATE INDEX "CustomFieldValue_issueId_idx" ON "CustomFieldValue"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldValue_fieldId_issueId_key" ON "CustomFieldValue"("fieldId", "issueId");

-- CreateIndex
CREATE INDEX "Version_projectId_idx" ON "Version"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Version_projectId_name_key" ON "Version"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "_IssueVersions_AB_unique" ON "_IssueVersions"("A", "B");

-- CreateIndex
CREATE INDEX "_IssueVersions_B_index" ON "_IssueVersions"("B");

-- AddForeignKey
ALTER TABLE "BoardStar" ADD CONSTRAINT "BoardStar_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardStar" ADD CONSTRAINT "BoardStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Version" ADD CONSTRAINT "Version_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IssueVersions" ADD CONSTRAINT "_IssueVersions_A_fkey" FOREIGN KEY ("A") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IssueVersions" ADD CONSTRAINT "_IssueVersions_B_fkey" FOREIGN KEY ("B") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
