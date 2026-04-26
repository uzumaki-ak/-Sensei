-- CreateTable
CREATE TABLE "RagKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "chunkText" TEXT NOT NULL,
    "embedding" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RagKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RagQueryHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "citations" JSONB,
    "retrievedChunks" JSONB,
    "providerTrace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RagQueryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultiAgentRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "goal" TEXT NOT NULL,
    "researcherOutput" TEXT NOT NULL,
    "plannerOutput" TEXT NOT NULL,
    "reviewerOutput" TEXT NOT NULL,
    "finalOutput" TEXT NOT NULL,
    "providerTrace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MultiAgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptEvalRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "task" TEXT NOT NULL,
    "variants" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "scores" JSONB NOT NULL,
    "winnerIndex" INTEGER,
    "judgeTrace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptEvalRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RagKnowledgeChunk_userId_idx" ON "RagKnowledgeChunk"("userId");

-- CreateIndex
CREATE INDEX "RagKnowledgeChunk_applicationId_idx" ON "RagKnowledgeChunk"("applicationId");

-- CreateIndex
CREATE INDEX "RagKnowledgeChunk_sourceType_idx" ON "RagKnowledgeChunk"("sourceType");

-- CreateIndex
CREATE INDEX "RagQueryHistory_userId_idx" ON "RagQueryHistory"("userId");

-- CreateIndex
CREATE INDEX "RagQueryHistory_applicationId_idx" ON "RagQueryHistory"("applicationId");

-- CreateIndex
CREATE INDEX "RagQueryHistory_createdAt_idx" ON "RagQueryHistory"("createdAt");

-- CreateIndex
CREATE INDEX "MultiAgentRun_userId_idx" ON "MultiAgentRun"("userId");

-- CreateIndex
CREATE INDEX "MultiAgentRun_applicationId_idx" ON "MultiAgentRun"("applicationId");

-- CreateIndex
CREATE INDEX "MultiAgentRun_createdAt_idx" ON "MultiAgentRun"("createdAt");

-- CreateIndex
CREATE INDEX "PromptEvalRun_userId_idx" ON "PromptEvalRun"("userId");

-- CreateIndex
CREATE INDEX "PromptEvalRun_applicationId_idx" ON "PromptEvalRun"("applicationId");

-- CreateIndex
CREATE INDEX "PromptEvalRun_createdAt_idx" ON "PromptEvalRun"("createdAt");

-- AddForeignKey
ALTER TABLE "RagKnowledgeChunk" ADD CONSTRAINT "RagKnowledgeChunk_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RagKnowledgeChunk" ADD CONSTRAINT "RagKnowledgeChunk_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RagQueryHistory" ADD CONSTRAINT "RagQueryHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RagQueryHistory" ADD CONSTRAINT "RagQueryHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiAgentRun" ADD CONSTRAINT "MultiAgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiAgentRun" ADD CONSTRAINT "MultiAgentRun_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptEvalRun" ADD CONSTRAINT "PromptEvalRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptEvalRun" ADD CONSTRAINT "PromptEvalRun_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
