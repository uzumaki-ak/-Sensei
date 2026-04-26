-- AlterTable
ALTER TABLE "InterviewMeetRoom"
ADD COLUMN IF NOT EXISTS "evaluation" JSONB,
ADD COLUMN IF NOT EXISTS "evaluatedAt" TIMESTAMP(3);
