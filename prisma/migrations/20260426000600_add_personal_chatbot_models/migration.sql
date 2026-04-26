-- CreateTable
CREATE TABLE "PersonalChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalChatSession_userId_idx" ON "PersonalChatSession"("userId");

-- CreateIndex
CREATE INDEX "PersonalChatSession_applicationId_idx" ON "PersonalChatSession"("applicationId");

-- CreateIndex
CREATE INDEX "PersonalChatSession_updatedAt_idx" ON "PersonalChatSession"("updatedAt");

-- CreateIndex
CREATE INDEX "PersonalChatMessage_sessionId_idx" ON "PersonalChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "PersonalChatMessage_userId_idx" ON "PersonalChatMessage"("userId");

-- CreateIndex
CREATE INDEX "PersonalChatMessage_createdAt_idx" ON "PersonalChatMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "PersonalChatSession" ADD CONSTRAINT "PersonalChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalChatSession" ADD CONSTRAINT "PersonalChatSession_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalChatMessage" ADD CONSTRAINT "PersonalChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PersonalChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalChatMessage" ADD CONSTRAINT "PersonalChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
