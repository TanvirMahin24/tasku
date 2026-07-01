-- CreateEnum
CREATE TYPE "KnowledgeType" AS ENUM ('FILE', 'LINK');

-- CreateEnum
CREATE TYPE "KnowledgeLinkKind" AS ENUM ('GOOGLE_DOC', 'GOOGLE_SHEET', 'GOOGLE_SLIDES', 'GENERIC');

-- CreateTable
CREATE TABLE "KnowledgeDoc" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "KnowledgeType" NOT NULL,
    "url" TEXT,
    "linkKind" "KnowledgeLinkKind",
    "filename" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "teamId" TEXT,
    "issueId" TEXT,
    "isImport" BOOLEAN NOT NULL DEFAULT false,
    "importedFromId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeDoc_teamId_idx" ON "KnowledgeDoc"("teamId");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_issueId_idx" ON "KnowledgeDoc"("issueId");

-- CreateIndex
CREATE INDEX "KnowledgeDoc_importedFromId_idx" ON "KnowledgeDoc"("importedFromId");

-- AddForeignKey
ALTER TABLE "KnowledgeDoc" ADD CONSTRAINT "KnowledgeDoc_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDoc" ADD CONSTRAINT "KnowledgeDoc_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDoc" ADD CONSTRAINT "KnowledgeDoc_importedFromId_fkey" FOREIGN KEY ("importedFromId") REFERENCES "KnowledgeDoc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDoc" ADD CONSTRAINT "KnowledgeDoc_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
