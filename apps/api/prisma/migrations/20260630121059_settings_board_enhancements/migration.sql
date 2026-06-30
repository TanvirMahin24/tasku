-- CreateEnum
CREATE TYPE "BoardSwimlane" AS ENUM ('NONE', 'ASSIGNEE', 'EPIC', 'TEAM', 'PRIORITY');

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "swimlaneBy" "BoardSwimlane" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Status" ADD COLUMN     "wipLimit" INTEGER;
