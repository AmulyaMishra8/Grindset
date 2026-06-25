-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Problem" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "sealedExpectations" JSONB NOT NULL,
    "chatFormat" JSONB,
    "referenceCode" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSet" (
    "id" SERIAL NOT NULL,
    "problemId" INTEGER NOT NULL,

    CONSTRAINT "PracticeSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSet" (
    "id" SERIAL NOT NULL,
    "problemId" INTEGER NOT NULL,

    CONSTRAINT "TestSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Problem_slug_key" ON "Problem"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeSet_problemId_key" ON "PracticeSet"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "TestSet_problemId_key" ON "TestSet"("problemId");

-- AddForeignKey
ALTER TABLE "PracticeSet" ADD CONSTRAINT "PracticeSet_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSet" ADD CONSTRAINT "TestSet_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
