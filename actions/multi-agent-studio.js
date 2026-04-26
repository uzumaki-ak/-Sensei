"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { buildUserTextPrompt, generateTextWithFallback } from "@/lib/ai-fallback";

function normalizeText(value, limit = 6000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

async function getCurrentUserId() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, bio: true, skills: true },
  });
  if (!user) throw new Error("User not found");
  return user;
}

function withStageTrace(stage, trace = []) {
  if (!Array.isArray(trace)) return [];
  return trace.map((item) => ({ ...item, stage }));
}

function normalizeFailureMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  return "unknown failure";
}

const FAST_AGENT_SETTINGS = {
  timeoutMs: 22000,
  maxAttempts: 2,
};

export async function runMultiAgentStudio(applicationId, goal) {
  try {
    const user = await getCurrentUserId();
    if (!applicationId) throw new Error("Select a job first.");
    const cleanGoal = normalizeText(goal, 1800);
    if (!cleanGoal) throw new Error("Goal is required.");

    const application = await db.jobApplication.findFirst({
      where: {
        id: applicationId,
        userId: user.id,
      },
      include: {
        job: true,
      },
    });
    if (!application) throw new Error("Job application not found.");

    const sharedContext = `
Candidate profile:
- Bio: ${normalizeText(user.bio, 800) || "Not provided"}
- Skills: ${(user.skills || []).join(", ") || "Not provided"}

Target job:
- Company: ${application.job.company}
- Role: ${application.job.title}
- Tech stack: ${(application.job.techStack || []).join(", ") || "Not specified"}
- Job description: ${normalizeText(application.job.description, 2600) || "Not available"}

Goal:
${cleanGoal}
`;

    const trace = [];
    const startedAt = Date.now();

    const researcher = await generateTextWithFallback(
      buildUserTextPrompt(
        "You are Agent 1 (Researcher). Produce concise job-context insights and likely interview focus areas. Return clean markdown only (no HTML tags).",
        sharedContext
      ),
      { ...FAST_AGENT_SETTINGS, temperature: 0.2, maxTokens: 480 }
    );
    trace.push(...withStageTrace("researcher", researcher.trace));

    const [plannerResult, reviewerResult] = await Promise.allSettled([
      generateTextWithFallback(
        buildUserTextPrompt(
          "You are Agent 2 (Planner). Build an impact-ordered tactical prep plan with concrete steps and outputs. Return clean markdown only (no HTML tags).",
          `${sharedContext}\n\nResearcher output:\n${researcher.text}`
        ),
        { ...FAST_AGENT_SETTINGS, temperature: 0.2, maxTokens: 560 }
      ),
      generateTextWithFallback(
        buildUserTextPrompt(
          "You are Agent 3 (Reviewer). Critique blind spots and assumptions in this prep goal, and provide stronger alternatives. Return clean markdown only (no HTML tags).",
          `${sharedContext}\n\nResearcher output:\n${researcher.text}`
        ),
        { ...FAST_AGENT_SETTINGS, temperature: 0.2, maxTokens: 520 }
      ),
    ]);

    let plannerOutput =
      "Planner was unavailable due provider timeout. Use Researcher and Reviewer notes to proceed.";
    if (plannerResult.status === "fulfilled") {
      plannerOutput = plannerResult.value.text;
      trace.push(...withStageTrace("planner", plannerResult.value.trace));
    } else {
      trace.push({
        stage: "planner",
        provider: "none",
        model: "none",
        success: false,
        error: normalizeFailureMessage(plannerResult.reason),
      });
    }

    let reviewerOutput =
      "Reviewer was unavailable due provider timeout. Proceed with caution and validate assumptions manually.";
    if (reviewerResult.status === "fulfilled") {
      reviewerOutput = reviewerResult.value.text;
      trace.push(...withStageTrace("reviewer", reviewerResult.value.trace));
    } else {
      trace.push({
        stage: "reviewer",
        provider: "none",
        model: "none",
        success: false,
        error: normalizeFailureMessage(reviewerResult.reason),
      });
    }

    if (plannerResult.status === "rejected" && reviewerResult.status === "rejected") {
      throw new Error(
        "Both planner and reviewer timed out. Try again with a shorter goal or reduced provider fallback."
      );
    }

    let finalOutput = "";
    try {
      const synthesizer = await generateTextWithFallback(
        buildUserTextPrompt(
          "You are Agent 4 (Synthesizer). Merge outputs into one execution brief with exactly these markdown sections: ## Today (Day 0), ## Next 3 Days, ## Mock Questions, ## Risk Checklist. Use markdown tables when useful. No HTML tags.",
          `${sharedContext}\n\nResearcher output:\n${researcher.text}\n\nPlanner output:\n${plannerOutput}\n\nReviewer output:\n${reviewerOutput}`
        ),
        { ...FAST_AGENT_SETTINGS, temperature: 0.15, maxTokens: 760 }
      );
      trace.push(...withStageTrace("synthesizer", synthesizer.trace));
      finalOutput = synthesizer.text;
    } catch (error) {
      trace.push({
        stage: "synthesizer",
        provider: "none",
        model: "none",
        success: false,
        error: normalizeFailureMessage(error),
      });
      finalOutput = `# Execution Brief\n\n## Today (Day 0)\n${plannerOutput}\n\n## Next 3 Days\n${researcher.text}\n\n## Mock Questions\n- Build 5 role-specific technical questions from the plan above.\n- Add 3 behavioral ownership questions tied to your projects.\n\n## Risk Checklist\n${reviewerOutput}`;
    }

    const saved = await db.multiAgentRun.create({
      data: {
        userId: user.id,
        applicationId,
        goal: cleanGoal,
        researcherOutput: researcher.text,
        plannerOutput,
        reviewerOutput,
        finalOutput,
        providerTrace: trace,
      },
    });

    return {
      success: true,
      run: {
        id: saved.id,
        createdAt: saved.createdAt,
        goal: saved.goal,
        researcherOutput: saved.researcherOutput,
        plannerOutput: saved.plannerOutput,
        reviewerOutput: saved.reviewerOutput,
        finalOutput: saved.finalOutput,
        providerTrace: saved.providerTrace || [],
        elapsedMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    console.error("[Multi-Agent Studio Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to run multi-agent studio.",
    };
  }
}

export async function getMultiAgentRuns(applicationId = null) {
  try {
    const user = await getCurrentUserId();

    const runs = await db.multiAgentRun.findMany({
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
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 60,
    });

    return {
      success: true,
      history: runs.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        goal: item.goal,
        researcherOutput: item.researcherOutput,
        plannerOutput: item.plannerOutput,
        reviewerOutput: item.reviewerOutput,
        finalOutput: item.finalOutput,
        providerTrace: item.providerTrace || [],
        jobLabel: item.application
          ? `${item.application.job.company} - ${item.application.job.title}`
          : "General",
      })),
    };
  } catch (error) {
    console.error("[Multi-Agent Runs Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to load multi-agent runs.",
    };
  }
}
