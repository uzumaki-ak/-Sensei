"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";
import { analyzeResumeWithAI } from "@/lib/ats-checker";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function saveResume(content) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    // Check if a resume already exists for this user
    const existing = await db.resume.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    let resume;
    if (existing) {
      resume = await db.resume.update({
        where: { id: existing.id },
        data: { content },
      });
    } else {
      resume = await db.resume.create({
        data: {
          userId: user.id,
          content,
        },
      });
    }

    revalidatePath("/resume");
    return resume;
  } catch (error) {
    console.error("Error saving resume:", error);
    throw new Error("Failed to save resume");
  }
}

export async function getResume() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  // Find the default resume or the first one for this user
  return await db.resume.findFirst({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function getAllResumes() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  return await db.resume.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getJobsForTailoring() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  // Get jobs that have descriptions (needed for tailoring)
  const applications = await db.jobApplication.findMany({
    where: {
      userId: user.id,
      job: { description: { not: null } },
      status: { in: ["Discovered", "To Apply"] },
    },
    include: { job: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return applications;
}

export async function improveWithAI({ current, type }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  const prompt = `
    As an expert resume writer, improve the following ${type} description for a ${user.industry} professional.
    Make it more impactful, quantifiable, and aligned with industry standards.
    Current content: "${current}"

    Requirements:
    1. Use action verbs
    2. Include metrics and results where possible
    3. Highlight relevant technical skills
    4. Keep it concise but detailed
    5. Focus on achievements over responsibilities
    6. Use industry-specific keywords
    
    Format the response as a single paragraph without any additional text or explanations.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const improvedContent = response.text().trim();
    return improvedContent;
  } catch (error) {
    console.error("Error improving content:", error);
    throw new Error("Failed to improve content");
  }
}

/**
 * ATS Resume Checker
 * Analyzes resume against job description (optional)
 */
export async function checkResumeATS(resumeId, jobDescription = "") {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  // Get resume content
  const resume = await db.resume.findFirst({
    where: { id: resumeId, userId: user.id },
  });

  if (!resume) throw new Error("Resume not found");

  // Run ATS check
  const atsResult = await analyzeResumeWithAI(resume.content, jobDescription);

  // Update resume with ATS score
  await db.resume.update({
    where: { id: resumeId },
    data: {
      atsScore: atsResult.overallScore,
      feedback: JSON.stringify(atsResult),
    },
  });

  revalidatePath("/resume");

  return atsResult;
}

/**
 * Generate tailored resume for a specific job
 */
export async function generateTailoredResume(jobApplicationId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      resumes: true,
      industryInsight: true,
    },
  });

  if (!user) throw new Error("User not found");

  // Get job details
  const application = await db.jobApplication.findFirst({
    where: { id: jobApplicationId, userId: user.id },
    include: { job: true },
  });

  if (!application) throw new Error("Application not found");
  if (!application.job.description) throw new Error("Job description not available");

  // Get user's default resume or first resume
  const userResume = user.resumes.find(r => r.isDefault) || user.resumes[0];
  if (!userResume) throw new Error("No resume found. Please create a resume first.");

  // Generate tailored resume using AI
  const prompt = `
You are an expert resume writer. Create a tailored resume for a specific job.

USER PROFILE:
- Name: ${user.name || "Not set"}
- Bio: ${user.bio || "Not set"}
- Skills: ${(user.skills || []).join(", ")}

CURRENT RESUME:
${userResume.content}

TARGET JOB:
Title: ${application.job.title}
Company: ${application.job.company}
Description: ${application.job.description.substring(0, 2000)}
Tech Stack: ${(application.job.techStack || []).join(", ")}

TASK:
Rewrite the resume content to best match this job. Use Jake's resume format:
- Contact info at top
- Professional summary (2-3 lines)
- Skills section matching job requirements
- Work experience with bullet points (achievements over responsibilities)
- Use quantifiable metrics where possible
- Keep it concise but detailed

Return ONLY the resume content in plain text format (not markdown), ready to be used as-is.
`;

  try {
    const result = await model.generateContent(prompt);
    const tailoredContent = result.response.text().trim();

    // Create new tailored resume
    const newResume = await db.resume.create({
      data: {
        userId: user.id,
        name: `Tailored: ${application.job.title} at ${application.job.company}`,
        type: application.job.title,
        content: tailoredContent,
        isDefault: false,
        skills: application.job.techStack || [],
      },
    });

    // Run ATS check on new resume
    const atsResult = await analyzeResumeWithAI(tailoredContent, application.job.description);

    await db.resume.update({
      where: { id: newResume.id },
      data: {
        atsScore: atsResult.overallScore,
        feedback: JSON.stringify(atsResult),
      },
    });

    revalidatePath("/resume");

    return {
      resume: newResume,
      atsScore: atsResult.overallScore,
      atsDetails: atsResult,
    };
  } catch (error) {
    console.error("Error generating tailored resume:", error);
    throw new Error("Failed to generate tailored resume");
  }
}

/**
 * AI Chat for resume editing
 */
export async function chatWithResume({ resumeId, message, history = [] }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const resume = await db.resume.findFirst({
    where: { id: resumeId, userId: user.id },
  });

  if (!resume) throw new Error("Resume not found");

  // Build conversation context
  const conversationHistory = history.map(h => `${h.role}: ${h.content}`).join('\n');

  const prompt = `
You are an expert resume advisor. Help the user edit and improve their resume.

RESUME CONTENT:
${resume.content}

CONVERSATION HISTORY:
${conversationHistory}

USER MESSAGE:
${message}

INSTRUCTIONS:
1. You can suggest changes, improvements, or answer questions about the resume
2. If the user wants to make specific edits, provide the new content
3. Be specific and actionable
4. Focus on making the resume more impactful, quantifiable, and ATS-friendly

Respond in a helpful, conversational manner. If providing new resume content, clearly mark it.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text().trim();

    return {
      response,
      resumeId,
    };
  } catch (error) {
    console.error("Error in resume chat:", error);
    throw new Error("Failed to get response");
  }
}
