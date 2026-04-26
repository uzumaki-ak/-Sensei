-- CreateTable
CREATE TABLE "InterviewMeetRoom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "candidateName" TEXT,
    "candidateContext" TEXT,
    "companyContext" TEXT,
    "jobContext" JSONB,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "maxQuestions" INTEGER NOT NULL DEFAULT 8,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewMeetRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewMeetTurn" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewMeetTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewMeetRoom_code_key" ON "InterviewMeetRoom"("code");

-- CreateIndex
CREATE INDEX "InterviewMeetRoom_ownerUserId_idx" ON "InterviewMeetRoom"("ownerUserId");

-- CreateIndex
CREATE INDEX "InterviewMeetRoom_applicationId_idx" ON "InterviewMeetRoom"("applicationId");

-- CreateIndex
CREATE INDEX "InterviewMeetRoom_status_idx" ON "InterviewMeetRoom"("status");

-- CreateIndex
CREATE INDEX "InterviewMeetTurn_roomId_idx" ON "InterviewMeetTurn"("roomId");

-- CreateIndex
CREATE INDEX "InterviewMeetTurn_role_idx" ON "InterviewMeetTurn"("role");

-- AddForeignKey
ALTER TABLE "InterviewMeetRoom" ADD CONSTRAINT "InterviewMeetRoom_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewMeetRoom" ADD CONSTRAINT "InterviewMeetRoom_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewMeetTurn" ADD CONSTRAINT "InterviewMeetTurn_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "InterviewMeetRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;