-- AlterTable
ALTER TABLE "JobApplication" ADD COLUMN     "attachmentId" TEXT,
ADD COLUMN     "attachmentName" TEXT;

-- CreateTable
CREATE TABLE "ResumeAttachment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResumeAttachment_userId_idx" ON "ResumeAttachment"("userId");

-- CreateIndex
CREATE INDEX "ResumeAttachment_applicationId_idx" ON "ResumeAttachment"("applicationId");
