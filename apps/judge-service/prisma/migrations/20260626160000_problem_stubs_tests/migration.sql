-- AlterTable: stubs the editor pre-fills + curated test cases run on the sandbox
ALTER TABLE "Problem" ADD COLUMN "starterCode" JSONB;
ALTER TABLE "Problem" ADD COLUMN "testCases" JSONB;
