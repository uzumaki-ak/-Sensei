"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { buildUserTextPrompt, generateTextWithFallback } from "@/lib/ai-fallback";

function normalizeText(value, limit = 5000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function tryParseJson(text) {
  try {
    return JSON.parse(String(text || "").replace(/```json|```/gi, "").trim());
  } catch {
    return null;
  }
}

async function getCurrentUserId() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");
  return user.id;
}

function fallbackScores(variants, outputs) {
  return variants.map((_, idx) => {
    const output = String(outputs[idx] || "");
    const lengthScore = Math.min(10, Math.max(3, Math.round(output.length / 120)));
    return {
      index: idx,
      score: lengthScore,
      rationale: "Heuristic fallback based on response completeness.",
    };
  });
}

export async function runPromptEval(applicationId, task, variants = []) {
  try {
    const internalUserId = await getCurrentUserId();
    const cleanTask = normalizeText(task, 2500);
    if (!cleanTask) throw new Error("Task is required.");

    const cleanVariants = (Array.isArray(variants) ? variants : [])
      .map((item) => normalizeText(item, 1200))
      .filter(Boolean)
      .slice(0, 5);
    if (cleanVariants.length < 2) {
      throw new Error("Add at least two prompt variants.");
    }

    let appContext = "";
    if (applicationId) {
      const application = await db.jobApplication.findFirst({
        where: {
          id: applicationId,
          userId: internalUserId,
        },
        include: {
          job: true,
        },
      });
      if (application) {
        appContext = `Target job context: ${application.job.company} - ${application.job.title}. Tech stack: ${(
          application.job.techStack || []
        ).join(", ")}.`;
      }
    }

    const outputs = [];
    const traces = [];

    for (const variant of cleanVariants) {
      const generated = await generateTextWithFallback(
        buildUserTextPrompt(
          "You are a high-precision career assistant. Follow the variant style exactly.",
          `Task:\n${cleanTask}\n\n${appContext}\n\nPrompt Variant:\n${variant}`
        ),
        {
          temperature: 0.3,
          maxTokens: 900,
        }
      );
      outputs.push(generated.text);
      traces.push(...generated.trace);
    }

    const judgePrompt = buildUserTextPrompt(
      "You are a strict evaluator. Compare candidate outputs and return JSON only.",
      `Task:\n${cleanTask}\n\nVariants:\n${cleanVariants
        .map((variant, idx) => `Variant ${idx + 1}: ${variant}`)
        .join("\n\n")}\n\nOutputs:\n${outputs
        .map((output, idx) => `Output ${idx + 1}:\n${output}`)
        .join("\n\n")}\n\nReturn strict JSON:\n{\n  "scores":[{"index":0,"score":1-10,"rationale":"string"}],\n  "winnerIndex":0,\n  "summary":"string"\n}`
    );

    let judgeResult = null;
    let judgeTrace = [];
    try {
      const judged = await generateTextWithFallback(judgePrompt, {
        temperature: 0,
        maxTokens: 700,
      });
      judgeTrace = judged.trace;
      judgeResult = tryParseJson(judged.text);
    } catch {
      judgeResult = null;
    }

    const scores = Array.isArray(judgeResult?.scores)
      ? judgeResult.scores
          .map((item) => ({
            index: Number(item?.index),
            score: Math.max(1, Math.min(10, Number(item?.score) || 0)),
            rationale: normalizeText(item?.rationale, 240),
          }))
          .filter((item) => Number.isInteger(item.index))
      : fallbackScores(cleanVariants, outputs);

    const winnerFromScores = [...scores].sort((a, b) => b.score - a.score)[0]?.index ?? 0;
    const winnerIndex =
      Number.isInteger(judgeResult?.winnerIndex) && judgeResult.winnerIndex >= 0
        ? Math.min(judgeResult.winnerIndex, cleanVariants.length - 1)
        : winnerFromScores;

    const summary =
      normalizeText(judgeResult?.summary, 500) ||
      "Evaluation complete. Highest score selected as winner.";

    const saved = await db.promptEvalRun.create({
      data: {
        userId: internalUserId,
        applicationId: applicationId || null,
        task: cleanTask,
        variants: cleanVariants,
        outputs,
        scores,
        winnerIndex,
        judgeTrace: [...traces, ...judgeTrace],
      },
    });

    return {
      success: true,
      run: {
        id: saved.id,
        createdAt: saved.createdAt,
        task: cleanTask,
        variants: cleanVariants,
        outputs,
        scores,
        winnerIndex,
        summary,
        judgeTrace: saved.judgeTrace || [],
      },
    };
  } catch (error) {
    console.error("[Prompt Eval Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to run prompt evaluation.",
    };
  }
}

export async function getPromptEvalRuns(applicationId = null) {
  try {
    const internalUserId = await getCurrentUserId();

    const runs = await db.promptEvalRun.findMany({
      where: {
        userId: internalUserId,
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
      take: 50,
    });

    return {
      success: true,
      history: runs.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        task: item.task,
        variants: item.variants || [],
        outputs: item.outputs || [],
        scores: item.scores || [],
        winnerIndex: item.winnerIndex,
        judgeTrace: item.judgeTrace || [],
        jobLabel: item.application
          ? `${item.application.job.company} - ${item.application.job.title}`
          : "General",
      })),
    };
  } catch (error) {
    console.error("[Prompt Eval History Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to load prompt eval history.",
    };
  }
}
