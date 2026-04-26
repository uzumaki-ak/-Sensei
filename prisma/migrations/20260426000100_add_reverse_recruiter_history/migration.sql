-- CreateTable
CREATE TABLE "ReverseRecruiterHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReverseRecruiterHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReverseRecruiterHistory_userId_idx" ON "ReverseRecruiterHistory"("userId");

-- CreateIndex
CREATE INDEX "ReverseRecruiterHistory_applicationId_idx" ON "ReverseRecruiterHistory"("applicationId");

-- AddForeignKey
ALTER TABLE "ReverseRecruiterHistory" ADD CONSTRAINT "ReverseRecruiterHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReverseRecruiterHistory" ADD CONSTRAINT "ReverseRecruiterHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;