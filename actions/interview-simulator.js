"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { getModel } from "@/lib/gemini";

/**
 * Generates dynamic, hyper-specific interview questions based on the job and a user's project.
 * 
 * @param {string} applicationId - The ID of the saved job application.
 * @param {string} projectDetails - Text describing the user's project or experience.
 * @returns {Promise<{ success: boolean, questions?: string[], error?: string }>}
 */
export async function generateInterviewQuestions(applicationId, projectDetails) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    if (!applicationId || !projectDetails) {
      throw new Error("Job application and project details are required.");
    }

    // 1. Fetch Job Application Details
    const application = await db.jobApplication.findUnique({
      where: {
        id: applicationId,
        userId: userId,
      },
      include: {
        job: true,
      },
    });

    if (!application) throw new Error("Job application not found.");

    const jobStack = application.job.techStack?.join(", ") || "General software engineering";
    const jobDescription = application.job.description || "General requirements";

    // 2. Prompt Gemini AI to generate questions
    const model = getModel();
    const prompt = `
You are an expert Senior Technical Lead and Hiring Manager at ${application.job.company}.
You are interviewing a candidate for the role of "${application.job.title}".

=== JOB DESCRIPTION (START) ===
${jobDescription.substring(0, 2000)}
=== JOB DESCRIPTION (END) ===

=== REQUIRED TECH STACK (from job posting) ===
${jobStack}
=== END TECH STACK ===

=== CANDIDATE'S PROJECT/EXPERIENCE ===
"${projectDetails}"
=== END PROJECT ===

Your task is to generate exactly 10 highly specific, challenging interview questions.

CRITICAL RULES:
1. ONLY ask about technologies, frameworks, and concepts that are EXPLICITLY mentioned in the JOB DESCRIPTION or REQUIRED TECH STACK above. Do NOT invent or assume any technology that is not listed. For example, if the job says "React, Next.js, REST APIs" then do NOT ask about React Native, mobile development, GraphQL, or anything else not mentioned.
2. IGNORE job board boilerplate. If the description mentions platforms like "Abekus.ai", "LinkedIn", or "Wellfound" simplifying hiring, ignore it. Focus exclusively on the actual hiring company (${application.job.company}) and their specific role.
3. At least 4 questions must directly reference the candidate's specific project and ask "how did you implement X" or "why did you choose Y over Z" in that project.
4. At least 3 questions must be scenario-based using ONLY the listed tech stack (e.g. "Using Next.js API routes, how would you design a REST endpoint for X?").
5. At least 2 questions must test fundamental understanding of the listed stack (e.g. "Explain the difference between getServerSideProps and getStaticProps in Next.js").
6. 1 question should be about the candidate's workflow with Git or debugging approach relevant to the role.

Return ONLY a strict JSON object with this format:
{
  "questions": [
    "Question 1...",
    "Question 2..."
  ]
}
Do not include markdown code block formatting in the response.
    `;

    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();
    const cleanedJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedJson);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error("Failed to parse questions array from AI.");
    }

    return {
      success: true,
      questions: parsed.questions,
    };

  } catch (error) {
    console.error("[Interview Generator Error]:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred while generating questions.",
    };
  }
}

/**
 * Grades the interview answers against ideal senior-level responses.
 * 
 * @param {string} applicationId - The ID of the saved job application.
 * @param {Array<{question: string, answer: string}>} qaPairs - The questions and user answers.
 * @param {string} projectDetails - Text describing the user's project or experience.
 * @returns {Promise<{ success: boolean, results?: any[], error?: string, historyId?: string }>}
 */
export async function gradeInterviewAnswers(applicationId, qaPairs, projectDetails = "Mock Interview") {
    try {
        const { userId } = await auth();
        if (!userId) throw new Error("Unauthorized");
    
        if (!applicationId || !qaPairs || qaPairs.length === 0) {
          throw new Error("Answers are required for grading.");
        }
    
        // Fetch job context again for accurate grading
        const application = await db.jobApplication.findUnique({
          where: { id: applicationId, userId: userId },
          include: { job: true },
        });
    
        if (!application) throw new Error("Job application not found.");
    
        const model = getModel();
        const prompt = `
You are a strict, senior-level technical interviewer grading a candidate's interview for the role of ${application.job.title} at ${application.job.company}.

Here is the transcript of the interview questions and the candidate's answers:
${JSON.stringify(qaPairs, null, 2)}

Your task is to evaluate every single answer. For each question, you must provide:
1. An "Ideal Senior Answer" (what a top-tier candidate would say).
2. A "Score" out of 10 based on technical accuracy, depth, and problem-solving.
3. A short "Feedback" paragraph on what they missed or did well.

Return ONLY a strict JSON object with this format:
{
  "results": [
    {
      "question": "The original question...",
      "userAnswer": "The original answer...",
      "idealAnswer": "A detailed, technical ideal answer...",
      "score": 8,
      "feedback": "You hit the main points but missed discussing..."
    }
  ]
}
Do not include markdown code block formatting in the response.
        `;
    
        const result = await model.generateContent(prompt);
        const rawResponse = result.response.text();
        const cleanedJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanedJson);
    
        if (!parsed.results || !Array.isArray(parsed.results)) {
            throw new Error("Failed to parse grading results from AI.");
        }

        // Save to Database
        const savedHistory = await db.interviewHistory.create({
          data: {
            userId: userId,
            jobId: application.job.id, // Properly link to JobListing
            projectContext: projectDetails || "Mock Interview", 
            qaPairs: {
              create: parsed.results.map((r) => ({
                question: String(r.question) || "Unknown Question",
                userAnswer: String(r.userAnswer) || "No Answer",
                idealAnswer: String(r.idealAnswer) || "No Ideal Answer provided.",
                score: Number(r.score) || 0,
                feedback: String(r.feedback) || "No feedback.",
              }))
            }
          }
        });
    
        return {
          success: true,
          results: parsed.results,
          historyId: savedHistory.id
        };
    
      } catch (error) {
        console.error("[Interview Grading Error]:", error);
        return {
          success: false,
          error: error.message || "An unexpected error occurred while grading.",
        };
      }
}
