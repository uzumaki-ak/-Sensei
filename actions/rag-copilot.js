"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import {
  buildUserTextPrompt,
  cosineSimilarity,
  createEmbeddingWithFallback,
  generateTextWithFallback,
  splitTextForEmbedding,
} from "@/lib/ai-fallback";

function normalizeText(value, limit = 5000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
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

export async function ingestRagContext(applicationId, options = {}) {
  try {
    const internalUserId = await getCurrentUserId();
    if (!applicationId) throw new Error("Select a job first.");

    const [application, latestResume, userProfile] = await Promise.all([
      db.jobApplication.findFirst({
        where: {
          id: applicationId,
          userId: internalUserId,
        },
        include: {
          job: true,
        },
      }),
      db.resume.findFirst({
        where: { userId: internalUserId },
        orderBy: { updatedAt: "desc" },
      }),
      db.user.findUnique({
        where: { id: internalUserId },
        select: {
          name: true,
          bio: true,
          experience: true,
          skills: true,
        },
      }),
    ]);

    if (!application) throw new Error("Job application not found.");

    const sourceDocuments = [];
    if (options?.includeJob !== false) {
      const jobText = [
        `Role: ${application.job.title}`,
        `Company: ${application.job.company}`,
        `Description: ${normalizeText(application.job.description, 6000)}`,
        `Tech stack: ${(application.job.techStack || []).join(", ")}`,
      ]
        .filter(Boolean)
        .join("\n");
      sourceDocuments.push({
        sourceType: "JOB",
        sourceLabel: `${application.job.company} - ${application.job.title}`,
        text: jobText,
      });
    }

    if (options?.includeResume !== false && latestResume?.content) {
      const resumeSummary = [
        latestResume.name ? `Resume name: ${latestResume.name}` : "",
        latestResume.type ? `Resume type: ${latestResume.type}` : "",
        latestResume.experience ? `Resume experience summary: ${latestResume.experience}` : "",
        Array.isArray(latestResume.skills) && latestResume.skills.length > 0
          ? `Resume skills: ${latestResume.skills.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      sourceDocuments.push({
        sourceType: "RESUME",
        sourceLabel: latestResume.name || "Latest Resume",
        text: [resumeSummary, normalizeText(latestResume.content, 12000)]
          .filter(Boolean)
          .join("\n\n"),
      });
    }

    const profileText = [
      userProfile?.name ? `Candidate: ${userProfile.name}` : "",
      Number.isFinite(userProfile?.experience)
        ? `Years of experience: ${userProfile.experience}`
        : "",
      userProfile?.bio ? `Bio: ${normalizeText(userProfile.bio, 2000)}` : "",
      Array.isArray(userProfile?.skills) && userProfile.skills.length > 0
        ? `Profile skills: ${userProfile.skills.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (profileText) {
      sourceDocuments.push({
        sourceType: "PROFILE",
        sourceLabel: "Candidate Profile",
        text: profileText,
      });
    }

    const customNotes = normalizeText(options?.customNotes, 8000);
    if (customNotes) {
      sourceDocuments.push({
        sourceType: "NOTE",
        sourceLabel: "Custom Notes",
        text: customNotes,
      });
    }

    if (sourceDocuments.length === 0) {
      throw new Error("Nothing to ingest. Add job/resume/notes.");
    }

    await db.ragKnowledgeChunk.deleteMany({
      where: {
        userId: internalUserId,
        applicationId,
      },
    });

    let createdCount = 0;
    const trace = [];

    for (const source of sourceDocuments) {
      const chunks = splitTextForEmbedding(source.text, 900, 140).slice(0, 30);
      for (let index = 0; index < chunks.length; index += 1) {
        const chunkText = chunks[index];
        const embed = await createEmbeddingWithFallback(chunkText, {
          timeoutMs: 12000,
          maxAttempts: 3,
        });
        trace.push(...embed.trace);

        await db.ragKnowledgeChunk.create({
          data: {
            userId: internalUserId,
            applicationId,
            sourceType: source.sourceType,
            sourceLabel: source.sourceLabel,
            chunkText,
            embedding: embed.embedding,
            metadata: {
              provider: embed.provider,
              model: embed.model,
              chunkIndex: index + 1,
            },
          },
        });
        createdCount += 1;
      }
    }

    return {
      success: true,
      chunksCreated: createdCount,
      sourceCount: sourceDocuments.length,
      trace,
    };
  } catch (error) {
    console.error("[RAG Ingest Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to ingest RAG context.",
    };
  }
}

export async function askRagQuestion(applicationId, question) {
  try {
    const internalUserId = await getCurrentUserId();
    if (!applicationId) throw new Error("Select a job first.");

    const cleanQuestion = normalizeText(question, 1200);
    if (!cleanQuestion) throw new Error("Question is required.");

    const [application, chunks] = await Promise.all([
      db.jobApplication.findFirst({
        where: {
          id: applicationId,
          userId: internalUserId,
        },
        include: {
          job: true,
        },
      }),
      db.ragKnowledgeChunk.findMany({
        where: {
          userId: internalUserId,
          applicationId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 250,
      }),
    ]);

    if (!application) throw new Error("Job application not found.");
    if (chunks.length === 0) {
      throw new Error("No context embedded yet. Run 'Ingest Context' first.");
    }

    const queryEmbed = await createEmbeddingWithFallback(cleanQuestion, {
      timeoutMs: 12000,
      maxAttempts: 3,
    });
    const ranked = chunks
      .map((chunk, idx) => {
        const score = cosineSimilarity(queryEmbed.embedding, chunk.embedding);
        return {
          rankId: `C${idx + 1}`,
          score,
          sourceLabel: chunk.sourceLabel,
          sourceType: chunk.sourceType,
          chunkText: chunk.chunkText,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const contextBlock = ranked
      .map(
        (item, index) =>
          `[CH${index + 1}] (${item.sourceType}) ${item.sourceLabel}\n${item.chunkText}`
      )
      .join("\n\n");

    const prompt = buildUserTextPrompt(
      "You are a resume-focused interview copilot. Answer only using retrieved context. Be concise, practical, and cite chunk ids like [CH1], [CH2]. If data is missing, explicitly say what is missing and ask for it.",
      `Job: ${application.job.company} - ${application.job.title}\n\nQuestion: ${cleanQuestion}\n\nRetrieved Context:\n${contextBlock}`
    );

    const generated = await generateTextWithFallback(prompt, {
      temperature: 0.2,
      maxTokens: 1000,
    });

    const citationIds = Array.from(
      new Set(
        (generated.text.match(/\[CH\d+\]/g) || []).map((token) =>
          token.replace(/\[|\]/g, "")
        )
      )
    );

    const citations = citationIds
      .map((id) => {
        const index = Number(id.replace("CH", "")) - 1;
        return ranked[index]
          ? {
              id,
              sourceLabel: ranked[index].sourceLabel,
              sourceType: ranked[index].sourceType,
              preview: ranked[index].chunkText.slice(0, 220),
              score: Number(ranked[index].score.toFixed(4)),
            }
          : null;
      })
      .filter(Boolean);

    const saved = await db.ragQueryHistory.create({
      data: {
        userId: internalUserId,
        applicationId,
        question: cleanQuestion,
        answer: generated.text,
        citations,
        retrievedChunks: ranked.map((item, index) => ({
          id: `CH${index + 1}`,
          sourceLabel: item.sourceLabel,
          sourceType: item.sourceType,
          score: Number(item.score.toFixed(5)),
          preview: item.chunkText.slice(0, 200),
        })),
        providerTrace: [...queryEmbed.trace, ...generated.trace],
      },
    });

    return {
      success: true,
      result: {
        id: saved.id,
        createdAt: saved.createdAt,
        question: cleanQuestion,
        answer: generated.text,
        citations,
        retrievedChunks: saved.retrievedChunks || [],
        providerTrace: saved.providerTrace || [],
      },
    };
  } catch (error) {
    console.error("[RAG Ask Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to answer question with RAG.",
    };
  }
}

export async function getRagQueryHistory(applicationId = null) {
  try {
    const internalUserId = await getCurrentUserId();

    const history = await db.ragQueryHistory.findMany({
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
      take: 60,
    });

    return {
      success: true,
      history: history.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        question: item.question,
        answer: item.answer,
        citations: item.citations || [],
        retrievedChunks: item.retrievedChunks || [],
        providerTrace: item.providerTrace || [],
        jobLabel: item.application
          ? `${item.application.job.company} - ${item.application.job.title}`
          : "General",
      })),
    };
  } catch (error) {
    console.error("[RAG History Error]:", error);
    return {
      success: false,
      error: error.message || "Failed to load RAG history.",
    };
  }
}
