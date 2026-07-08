-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "transcript" JSONB NOT NULL,
    "scorecard" JSONB NOT NULL,
    "durationS" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "InterviewSession_userId_createdAt_idx" ON "InterviewSession"("userId", "createdAt");
-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
