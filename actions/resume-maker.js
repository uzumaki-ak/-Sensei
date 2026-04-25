"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

function cleanJsonResponse(text) {
  return text.replace(/```(?:json)?\n?/gi, "").replace(/```$/g, "").trim();
}

/**
 * Step 1: AI generates questions based on the job description
 */
export async function generateResumeQuestions(jobApplicationId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: { resumes: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  if (!user) throw new Error("User not found");

  const application = await db.jobApplication.findFirst({
    where: { id: jobApplicationId, userId: user.id },
    include: { job: true },
  });
  if (!application) throw new Error("Application not found");

  const existingResume = user.resumes[0];

  const prompt = `
You are a career coach helping someone build a tailored resume for a specific job.

=== JOB DETAILS ===
Title: ${application.job.title}
Company: ${application.job.company}
Tech Stack: ${(application.job.techStack || []).join(", ")}
Description: ${application.job.description?.substring(0, 2000) || "Not provided"}
===================

=== USER PROFILE ===
Name: ${user.name || "Not set"}
Bio: ${user.bio || "Not set"}
Skills: ${(user.skills || []).join(", ")}
${existingResume ? `Existing Resume Content:\n${existingResume.content?.substring(0, 1500)}` : "No existing resume"}
====================

Generate 6-8 highly targeted questions to extract the exact accomplishments, metrics, and experiences needed to build a strong resume for THIS specific job. 

CRITICAL RULES:
1. ONLY ask about technologies, frameworks, and concepts that are EXPLICITLY mentioned in the JOB DETAILS. Do NOT invent or assume any technology that is not listed. If the job is for React/Next.js, do NOT ask about React Native or mobile development.
2. IGNORE job board boilerplate. If the description mentions platforms like "Abekus.ai", "LinkedIn", or "Wellfound" simplifying hiring, ignore it. Focus exclusively on the actual hiring company (${application.job.company}) and their specific role.
3. Questions must be specific. Instead of "What is your work experience?", ask "How have you used ${application.job.techStack?.[0] || 'the required technologies'} in your past roles to improve performance or deliver features?"
4. Ask for measurable metrics (e.g., "What was the scale of the API you built? How many users or requests did it handle?").
5. Ask how their existing skills translate to the core responsibilities mentioned in the job description.

Return ONLY a valid JSON array of question strings. No markdown, no extra text.
Example: ["How did you implement [Tech from Job] in your last project?", "Can you provide metrics on the impact of your [Specific Skill] work?"]
`;

  try {
    const result = await model.generateContent(prompt);
    const text = cleanJsonResponse(result.response.text());
    const questions = JSON.parse(text);
    return {
      questions,
      jobTitle: application.job.title,
      company: application.job.company,
      jobId: application.job.id,
      applicationId: application.id,
    };
  } catch (error) {
    console.error("Error generating questions:", error);
    throw new Error("Failed to generate resume questions");
  }
}

/**
 * Step 2: AI builds structured resume data from user answers
 */
export async function buildResumeFromAnswers({ jobApplicationId, answers }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: { resumes: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  if (!user) throw new Error("User not found");

  const application = await db.jobApplication.findFirst({
    where: { id: jobApplicationId, userId: user.id },
    include: { job: true },
  });
  if (!application) throw new Error("Application not found");

  const existingResume = user.resumes[0];

  const prompt = `
You are an expert resume writer. Build a complete, polished resume for a candidate applying to a specific job.

JOB TARGET:
Title: ${application.job.title}
Company: ${application.job.company}
Tech Stack: ${(application.job.techStack || []).join(", ")}
Description: ${application.job.description?.substring(0, 2000) || "Not provided"}

CANDIDATE INFO:
Name: ${user.name || "Candidate"}
Email: ${user.email || ""}
Bio: ${user.bio || ""}
Existing Skills: ${(user.skills || []).join(", ")}
${existingResume ? `\nExisting Resume Content:\n${existingResume.content?.substring(0, 2000)}` : ""}

CANDIDATE'S ANSWERS TO QUESTIONS:
${answers.map((a, i) => `Q${i + 1}: ${a.question}\nA: ${a.answer}`).join("\n\n")}

INSTRUCTIONS:
1. Create a comprehensive, tailored resume that directly targets this job
2. Use strong action verbs and quantify achievements wherever possible
3. Prioritize skills and experience that match the job requirements
4. Write 3-5 impactful bullet points per experience entry
5. Include a compelling professional summary that connects the candidate to this role

Return ONLY valid JSON with this exact structure:
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone or empty string",
  "linkedin": "linkedin url or empty string",
  "github": "github url or empty string",
  "website": "",
  "summary": "2-3 sentence professional summary tailored to the job",
  "skills": ["skill1", "skill2", "..."],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, State",
      "startDate": "Mon YYYY",
      "endDate": "Mon YYYY or Present",
      "bullets": ["Achievement 1 with metrics", "Achievement 2", "..."]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "school": "University Name",
      "location": "City, State",
      "startDate": "YYYY",
      "endDate": "YYYY",
      "gpa": "GPA or empty string"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "techStack": "Tech used",
      "description": "",
      "bullets": ["What it does", "Impact/result"]
    }
  ],
  "certifications": ["Cert 1", "Cert 2"]
}
`;

  try {
    const result = await model.generateContent(prompt);
    const text = cleanJsonResponse(result.response.text());
    const resumeData = JSON.parse(text);
    return resumeData;
  } catch (error) {
    console.error("Error building resume:", error);
    throw new Error("Failed to build resume from answers");
  }
}

/**
 * Step 3: AI refines resume based on user feedback
 */
export async function refineResume({ currentData, feedback, jobApplicationId }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  const application = await db.jobApplication.findFirst({
    where: { id: jobApplicationId, userId: user.id },
    include: { job: true },
  });

  const prompt = `
You are an expert resume writer. The user wants to modify their resume.

CURRENT RESUME DATA:
${JSON.stringify(currentData, null, 2)}

TARGET JOB:
Title: ${application?.job?.title || "Not specified"}
Company: ${application?.job?.company || "Not specified"}

USER FEEDBACK:
${feedback}

Apply the requested changes to the resume data. Keep the same JSON structure. Make sure the changes align with the target job requirements. If the user asks to add something, add it. If they ask to remove, remove it. If they ask to improve, rewrite with stronger language and metrics.

Return ONLY the updated JSON in the exact same structure as the input. No markdown, no extra text.
`;

  try {
    const result = await model.generateContent(prompt);
    const text = cleanJsonResponse(result.response.text());
    const updatedData = JSON.parse(text);
    return updatedData;
  } catch (error) {
    console.error("Error refining resume:", error);
    throw new Error("Failed to refine resume");
  }
}

/**
 * Step 4: Save the final resume to DB
 */
export async function saveTailoredResume({ resumeData, jobApplicationId }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  // Include the user's photo URL if available
  if (user.imageUrl && !resumeData.photoUrl) {
    resumeData.photoUrl = user.imageUrl;
  }

  const application = await db.jobApplication.findFirst({
    where: { id: jobApplicationId, userId: user.id },
    include: { job: true },
  });

  // Convert structured data to markdown for storage
  const markdown = resumeDataToMarkdown(resumeData);

  const resume = await db.resume.create({
    data: {
      userId: user.id,
      name: `Tailored: ${application?.job?.title || "Custom"} at ${application?.job?.company || "Company"}`,
      type: application?.job?.title || "Custom",
      content: markdown,
      isDefault: false,
      skills: resumeData.skills || [],
      experience: resumeData.summary || "",
    },
  });

  revalidatePath("/resume");
  return resume;
}

export async function getAllResumes() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  const resumes = await db.resume.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return resumes;
}

export async function deleteResume(id) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({ where: { clerkUserId: userId } });
  if (!user) throw new Error("User not found");

  await db.resume.delete({
    where: { id, userId: user.id },
  });

  revalidatePath("/resume");
  return { success: true };
}

function resumeDataToMarkdown(d) {
  const parts = [];
  parts.push(`# ${d.name || "Your Name"}`);
  const contact = [d.email, d.phone, d.linkedin, d.github].filter(Boolean);
  if (contact.length) parts.push(contact.join(" | "));
  if (d.summary) parts.push(`\n## Summary\n${d.summary}`);
  if (d.skills?.length) parts.push(`\n## Skills\n${d.skills.join(", ")}`);
  if (d.experience?.length) {
    parts.push("\n## Experience");
    d.experience.forEach((e) => {
      parts.push(`\n### ${e.title} — ${e.company}`);
      parts.push(`*${e.startDate} – ${e.endDate || "Present"}*${e.location ? ` | ${e.location}` : ""}`);
      (e.bullets || []).forEach((b) => parts.push(`- ${b}`));
    });
  }
  if (d.education?.length) {
    parts.push("\n## Education");
    d.education.forEach((e) => {
      parts.push(`\n**${e.degree}** — ${e.school} (${e.startDate} – ${e.endDate || "Present"})${e.gpa ? ` | GPA: ${e.gpa}` : ""}`);
    });
  }
  if (d.projects?.length) {
    parts.push("\n## Projects");
    d.projects.forEach((p) => {
      parts.push(`\n### ${p.name}${p.techStack ? ` | ${p.techStack}` : ""}`);
      (p.bullets || []).forEach((b) => parts.push(`- ${b}`));
    });
  }
  if (d.certifications?.length) parts.push(`\n## Certifications\n${d.certifications.join("\n")}`);
  return parts.join("\n");
}
