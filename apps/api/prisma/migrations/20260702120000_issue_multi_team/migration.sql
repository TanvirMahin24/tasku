-- Issue teams: single FK (Issue.teamId) -> many-to-many (_IssueTeams).
-- Create the join table first, copy existing single-team assignments, then
-- drop the old column so no data is lost.

-- CreateTable
CREATE TABLE "_IssueTeams" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_IssueTeams_AB_unique" ON "_IssueTeams"("A", "B");
CREATE INDEX "_IssueTeams_B_index" ON "_IssueTeams"("B");

-- AddForeignKey
ALTER TABLE "_IssueTeams" ADD CONSTRAINT "_IssueTeams_A_fkey" FOREIGN KEY ("A") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_IssueTeams" ADD CONSTRAINT "_IssueTeams_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing single-team assignments.
INSERT INTO "_IssueTeams" ("A", "B")
SELECT "id", "teamId" FROM "Issue" WHERE "teamId" IS NOT NULL;

-- Drop the old single-team column.
ALTER TABLE "Issue" DROP CONSTRAINT "Issue_teamId_fkey";
DROP INDEX "Issue_teamId_idx";
ALTER TABLE "Issue" DROP COLUMN "teamId";
