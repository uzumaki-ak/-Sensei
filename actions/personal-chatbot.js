"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { buildUserTextPrompt, generateTextWithFallback } from "@/lib/ai-fallback";

const PLATFORM_FEATURE_KNOWLEDGE = [
  {
    label: "Midnight Job Hunt",
    text: "Purpose: Discover and save relevant jobs into the pipeline. Use case: quickly source opportunities by role, company, and stack. How to test: run a hunt, confirm jobs appear in Kanban, move status, and verify persistence on refresh.",
  },
  {
    label: "Job Kanban",
    text: "Purpose: Track applications from discovered to interviewed/offer stages. Use case: recruiter-ready view of pipeline management. How to test: drag jobs across columns, reload page, confirm status updates stay saved.",
  },
  {
    label: "Resume Studio",
    text: "Purpose: create/edit resumes and tailor content. Use case: role-specific resume optimization. How to test: edit sections, save, export, and verify updated resume is selectable for applications.",
  },
  {
    label: "Cover Letter",
    text: "Purpose: generate role-specific cover letters. Use case: fast personalized outreach package. How to test: generate for a selected job, inspect output relevance, and verify history entry appears.",
  },
  {
    label: "Reverse Recruiter",
    text: "Purpose: generate targeted founder/recruiter outreach drafts. Use case: bypass ATS with decision-maker messaging. How to test: pick job + decision maker, generate draft, verify history and copy actions.",
  },
  {
    label: "Company Intel",
    text: "Purpose: gather company signals and produce interview talking points. Use case: sharper interview/business context. How to test: run intel for a job, verify output sections and source references.",
  },
  {
    label: "GitHub Analyzer",
    text: "Purpose: compare repository evidence vs target role requirements. Use case: identify project gaps before interviews. How to test: submit public repo URL, verify missing skills and actionable plan.",
  },
  {
    label: "Cold Email Drip",
    text: "Purpose: generate multi-step recruiter follow-up sequence. Use case: structured outbound campaigns. How to test: generate sequence, review formatting in markdown view, and verify history recall.",
  },
  {
    label: "Offer Copilot",
    text: "Purpose: produce compensation negotiation scripts/playbooks. Use case: prepare data-backed negotiation calls/emails. How to test: input compensation targets, generate, and verify structured playbook output.",
  },
  {
    label: "Interview Simulator + Meet",
    text: "Purpose: real-time interview flow with transcript and scoring. Use case: mock interviews and feedback loops. How to test: create room, join candidate flow, answer prompts, end session, inspect scorecard.",
  },
  {
    label: "Telegram Sniper",
    text: "Purpose: send job alerts/automation updates via Telegram bot. Use case: instant notifications. How to test: configure bot token/chat id, trigger alert event, verify message delivery.",
  },
  {
    label: "RAG Copilot",
    text: "Purpose: ingest job/resume context and answer targeted prep questions with citations. Use case: role-specific interview story prep. How to test: ingest context, ask query, verify citations and Q/A history.",
  },
  {
    label: "Multi-Agent Studio",
    text: "Purpose: orchestrate researcher/planner/reviewer for a prep execution brief. Use case: structured 3-day preparation roadmap. How to test: run with goal text, confirm markdown output and run history.",
  },
  {
    label: "Prompt Eval Lab",
    text: "Purpose: compare multiple prompt variants and score outputs. Use case: improve prompt quality before production usage. How to test: submit task + variants, verify winner and rationale.",
  },
  {
    label: "Event Timeline",
    text: "Purpose: unified cross-tool activity feed. Use case: audit trail and portfolio proof of work. How to test: run any tool then check timeline entry ordering and route links.",
  },
  {
    label: "Personal DB Chatbot",
    text: "Purpose: answer questions from user-scoped DB + platform feature handbook. Use case: recruiter demo and guided product walkthrough. How to test: ask about your project history and feature testing steps, verify cited answers.",
  },
];

function normalizeText(value, limit = 3000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

function computeRelevanceScore(source, queryTokens) {
  if (!source || !Array.isArray(queryTokens) || queryTokens.length === 0) return 0;
  const haystack = `${source.label || ""} ${source.text || ""}`.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1;
  }
  return score;
}

function extractCitationIds(text) {
  return Array.from(
    new Set(
      (String(text || "").match(/\[S\d+\]/g) || []).map((token) =>
        token.replace(/\[|\]/g, "")
      )
    )
  );
}

function buildContextBlock(relevantSources) {
  return relevantSources
    .map(
      (source, index) =>
        `[S${index + 1}] ${source.type} - ${source.label}\n${normalizeText(source.text, 2500)}`
    )
    .join("\n\n");
}

async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      name: true,
      bio: true,
      experience: true,
      skills: true,
    },
  });
  if (!user) throw new Error("User not found");
  return user;
}

async function buildPersonalSources(userId, applicationId = null) {
  const [selectedApplication, recentApplications, resumes, ragRuns, multiAgentRuns, promptEvalRuns, companyIntelRuns, githubRuns] =
    await Promise.all([
      applicationId
        ? db.jobApplication.findFirst({
            where: { id: applicationId, userId },
            include: {
              job: true,
              resume: true,
            },
          })
        : Promise.resolve(null),
      db.jobApplication.findMany({
        where: { userId },
        include: { job: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      db.resume.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 2,
      }),
      db.ragQueryHistory.findMany({
        where: {
          userId,
          ...(applicationId ? { applicationId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      db.multiAgentRun.findMany({
        where: {
          userId,
          ...(applicationId ? { applicationId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 2,
      }),
      db.promptEvalRun.findMany({
        where: {
          userId,
          ...(applicationId ? { applicationId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 2,
      }),
      db.companyIntelHistory.findMany({
        where: {
          userId,
          ...(applicationId ? { applicationId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 2,
      }),
      db.githubAnalysisHistory.findMany({
        where: {
          userId,
          ...(applicationId ? { applicationId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 2,
      }),
    ]);

  if (applicationId && !selectedApplication) {
    throw new Error("Selected job context was not found.");
  }

  const sources = [];

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      bio: true,
      experience: true,
      skills: true,
    },
  });

  const profileText = [
    user?.name ? `Candidate name: ${user.name}` : "",
    Number.isFinite(user?.experience) ? `Years of experience: ${user.experience}` : "",
    user?.bio ? `Bio: ${normalizeText(user.bio, 1800)}` : "",
    Array.isArray(user?.skills) && user.skills.length > 0
      ? `Skills: ${user.skills.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (profileText) {
    sources.push({
      type: "PROFILE",
      label: "Candidate Profile",
      text: profileText,
    });
  }

  if (selectedApplication?.job) {
    sources.push({
      type: "TARGET_JOB",
      label: `${selectedApplication.job.company} - ${selectedApplication.job.title}`,
      text: [
        `Role: ${selectedApplication.job.title}`,
        `Company: ${selectedApplication.job.company}`,
        `Tech stack: ${(selectedApplication.job.techStack || []).join(", ") || "Not specified"}`,
        `Description: ${normalizeText(selectedApplication.job.description, 2200)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  if (recentApplications.length > 0) {
    sources.push({
      type: "PIPELINE",
      label: "Recent Job Pipeline",
      text: recentApplications
        .map(
          (item, index) =>
            `${index + 1}. ${item.job.company} - ${item.job.title} [${item.status}] | Stack: ${(item.job.techStack || []).join(", ")}`
        )
        .join("\n"),
    });
  }

  for (const resume of resumes) {
    sources.push({
      type: "RESUME",
      label: resume.name || "Resume",
      text: [
        resume.type ? `Type: ${resume.type}` : "",
        resume.experience ? `Experience summary: ${normalizeText(resume.experience, 600)}` : "",
        Array.isArray(resume.skills) && resume.skills.length > 0
          ? `Skills: ${resume.skills.join(", ")}`
          : "",
        `Content: ${normalizeText(resume.content, 2600)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  for (const item of ragRuns) {
    sources.push({
      type: "RAG_HISTORY",
      label: "RAG Copilot Q/A",
      text: `Q: ${normalizeText(item.question, 700)}\nA: ${normalizeText(item.answer, 1200)}`,
    });
  }

  for (const run of multiAgentRuns) {
    sources.push({
      type: "MULTI_AGENT",
      label: "Multi-Agent Run",
      text: [
        `Goal: ${normalizeText(run.goal, 500)}`,
        `Researcher: ${normalizeText(run.researcherOutput, 900)}`,
        `Planner: ${normalizeText(run.plannerOutput, 900)}`,
        `Reviewer: ${normalizeText(run.reviewerOutput, 900)}`,
      ].join("\n"),
    });
  }

  for (const run of promptEvalRuns) {
    sources.push({
      type: "PROMPT_EVAL",
      label: "Prompt Eval Run",
      text: [
        `Task: ${normalizeText(run.task, 700)}`,
        `Winner Variant Index: ${Number.isInteger(run.winnerIndex) ? run.winnerIndex + 1 : "N/A"}`,
        `Best Output: ${normalizeText((run.outputs || [])[run.winnerIndex || 0], 1200)}`,
      ].join("\n"),
    });
  }

  for (const run of companyIntelRuns) {
    sources.push({
      type: "COMPANY_INTEL",
      label: "Company Intel",
      text: normalizeText(run.talkingPointsMarkdown || JSON.stringify(run.intel || {}), 2200),
    });
  }

  for (const run of githubRuns) {
    sources.push({
      type: "GITHUB_ANALYZER",
      label: "GitHub Gap Analysis",
      text: [
        `Repo: ${run.repoUrl}`,
        `Missing skills: ${(run.missingSkills || []).join(", ")}`,
        `Resume recommendation: ${normalizeText(run.resumeRecommendation, 700)}`,
        `Plan: ${normalizeText(run.projectPlanMarkdown, 1400)}`,
      ].join("\n"),
    });
  }

  for (const feature of PLATFORM_FEATURE_KNOWLEDGE) {
    sources.push({
      type: "PLATFORM_FEATURE",
      label: feature.label,
      text: feature.text,
    });
  }

  return {
    sources,
    jobLabel: selectedApplication?.job
      ? `${selectedApplication.job.company} - ${selectedApplication.job.title}`
      : "General",
  };
}

export async function getPersonalChatSessions(applicationId = null) {
  try {
    const user = await getCurrentUser();
    const sessions = await db.personalChatSession.findMany({
      where: {
        userId: user.id,
        ...(applicationId ? { applicationId } : {}),
      },
      include: {
        application: {
          include: {
            job: true,
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });

    return {
      success: true,
      sessions: sessions.map((session) => ({
        id: session.id,
        title: session.title || "New chat",
        applicationId: session.applicationId,
        updatedAt: session.updatedAt,
        preview: normalizeText(session.messages?.[0]?.content, 120),
        jobLabel: session.application
          ? `${session.application.job.company} - ${session.application.job.title}`
          : "General",
      })),
    };
  } catch (error) {
    console.error("[Personal Chat Sessions Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to load personal chat sessions.",
    };
  }
}

export async function getPersonalChatMessages(sessionId) {
  try {
    const user = await getCurrentUser();
    if (!sessionId) throw new Error("Session id is required.");

    const session = await db.personalChatSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
      include: {
        application: {
          include: {
            job: true,
          },
        },
      },
    });
    if (!session) throw new Error("Session not found.");

    const messages = await db.personalChatMessage.findMany({
      where: {
        sessionId,
        userId: user.id,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 200,
    });

    return {
      success: true,
      session: {
        id: session.id,
        title: session.title || "New chat",
        applicationId: session.applicationId,
        jobLabel: session.application
          ? `${session.application.job.company} - ${session.application.job.title}`
          : "General",
      },
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        citations: message.citations || [],
        createdAt: message.createdAt,
      })),
    };
  } catch (error) {
    console.error("[Personal Chat Messages Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to load personal chat messages.",
    };
  }
}

export async function sendPersonalChatMessage(payload = {}) {
  try {
    const user = await getCurrentUser();
    const cleanMessage = normalizeText(payload?.message, 2000);
    if (!cleanMessage) throw new Error("Message is required.");

    let session = null;
    const selectedApplicationId = payload?.applicationId || null;

    if (payload?.sessionId) {
      session = await db.personalChatSession.findFirst({
        where: {
          id: payload.sessionId,
          userId: user.id,
        },
      });
      if (!session) throw new Error("Chat session not found.");
    } else {
      session = await db.personalChatSession.create({
        data: {
          userId: user.id,
          applicationId: selectedApplicationId,
          title: cleanMessage.slice(0, 72),
        },
      });
    }

    await db.personalChatMessage.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        role: "user",
        content: cleanMessage,
      },
    });

    const { sources, jobLabel } = await buildPersonalSources(
      user.id,
      session.applicationId || selectedApplicationId
    );

    const queryTokens = tokenize(cleanMessage);
    const relevant = [...sources]
      .map((source) => ({
        ...source,
        score: computeRelevanceScore(source, queryTokens),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const contextBlock = buildContextBlock(relevant);
    const prompt = buildUserTextPrompt(
      "You are a personal career copilot. Use only provided context. Never fabricate details. If context is missing, clearly state what is missing and ask a focused follow-up question. Keep answers structured and actionable. Cite source ids like [S1], [S2].",
      `Selected context: ${jobLabel}\n\nUser question:\n${cleanMessage}\n\nKnowledge context:\n${contextBlock}`
    );

    const generated = await generateTextWithFallback(prompt, {
      temperature: 0.2,
      maxTokens: 950,
      timeoutMs: 22000,
      maxAttempts: 3,
    });

    const citationIds = extractCitationIds(generated.text);
    const citations = citationIds
      .map((citationId) => {
        const index = Number(citationId.replace("S", "")) - 1;
        const source = relevant[index];
        if (!source) return null;
        return {
          id: citationId,
          type: source.type,
          label: source.label,
          preview: normalizeText(source.text, 200),
        };
      })
      .filter(Boolean);

    const assistant = await db.personalChatMessage.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        role: "assistant",
        content: generated.text,
        citations,
      },
    });

    await db.personalChatSession.update({
      where: { id: session.id },
      data: {
        updatedAt: new Date(),
        title: session.title || cleanMessage.slice(0, 72),
      },
    });

    return {
      success: true,
      session: {
        id: session.id,
        title: session.title || cleanMessage.slice(0, 72),
        applicationId: session.applicationId || selectedApplicationId,
      },
      reply: {
        id: assistant.id,
        role: assistant.role,
        content: assistant.content,
        citations: assistant.citations || [],
        createdAt: assistant.createdAt,
      },
      providerTrace: generated.trace || [],
    };
  } catch (error) {
    console.error("[Personal Chat Send Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to send personal chat message.",
    };
  }
}
