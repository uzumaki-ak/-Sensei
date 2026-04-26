-- CreateTable
CREATE TABLE "CompanyIntelHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "manualLinks" TEXT[],
    "intel" JSONB NOT NULL,
    "talkingPointsMarkdown" TEXT,
    "recentNews" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyIntelHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DripCampaignHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "sequenceMarkdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DripCampaignHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferCopilotHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "offerInput" JSONB NOT NULL,
    "playbook" JSONB NOT NULL,
    "compensation" JSONB NOT NULL,
    "negotiationScriptMarkdown" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferCopilotHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyIntelHistory_userId_idx" ON "CompanyIntelHistory"("userId");

-- CreateIndex
CREATE INDEX "CompanyIntelHistory_applicationId_idx" ON "CompanyIntelHistory"("applicationId");

-- CreateIndex
CREATE INDEX "DripCampaignHistory_userId_idx" ON "DripCampaignHistory"("userId");

-- CreateIndex
CREATE INDEX "DripCampaignHistory_applicationId_idx" ON "DripCampaignHistory"("applicationId");

-- CreateIndex
CREATE INDEX "OfferCopilotHistory_userId_idx" ON "OfferCopilotHistory"("userId");

-- CreateIndex
CREATE INDEX "OfferCopilotHistory_applicationId_idx" ON "OfferCopilotHistory"("applicationId");

-- AddForeignKey
ALTER TABLE "CompanyIntelHistory" ADD CONSTRAINT "CompanyIntelHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyIntelHistory" ADD CONSTRAINT "CompanyIntelHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DripCampaignHistory" ADD CONSTRAINT "DripCampaignHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DripCampaignHistory" ADD CONSTRAINT "DripCampaignHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferCopilotHistory" ADD CONSTRAINT "OfferCopilotHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferCopilotHistory" ADD CONSTRAINT "OfferCopilotHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
