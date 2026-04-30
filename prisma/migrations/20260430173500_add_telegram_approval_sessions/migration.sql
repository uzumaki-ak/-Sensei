-- CreateTable
CREATE TABLE "TelegramApprovalSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "recipientEmail" TEXT,
    "attachmentId" TEXT,
    "resumeId" TEXT,
    "feedback" TEXT,
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramApprovalSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramApprovalSession_userId_idx" ON "TelegramApprovalSession"("userId");

-- CreateIndex
CREATE INDEX "TelegramApprovalSession_applicationId_idx" ON "TelegramApprovalSession"("applicationId");

-- CreateIndex
CREATE INDEX "TelegramApprovalSession_chatId_status_idx" ON "TelegramApprovalSession"("chatId", "status");

-- CreateIndex
CREATE INDEX "TelegramApprovalSession_createdAt_idx" ON "TelegramApprovalSession"("createdAt");

-- AddForeignKey
ALTER TABLE "TelegramApprovalSession" ADD CONSTRAINT "TelegramApprovalSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramApprovalSession" ADD CONSTRAINT "TelegramApprovalSession_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
