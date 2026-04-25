import { db } from "@/lib/prisma";
import { getModel } from "@/lib/gemini";

/**
 * AI Agent for Smart Resume Selection
 * Analyzes job requirements and selects the best matching resume
 */

/**
 * Step 1: Analyze job description to extract key requirements
 */
async function analyzeJobRequirements(jobDescription, jobTitle, techStack) {
  const model = getModel();

  const prompt = `
You are a Job Requirement Analysis Agent. Extract key information from this job posting.

Job Title: ${jobTitle}
Tech Stack: ${techStack?.join(", ") || "Not specified"}
Job Description: ${jobDescription?.substring(0, 2000) || "Not provided"}

Analyze and return a JSON object with:
{
  "roleType": "The main role category (e.g., 'AI Engineer', 'Web Developer', 'Mobile Developer', 'Blockchain', 'Data Scientist', 'Backend', 'Frontend', 'Full Stack')",
  "requiredSkills": ["list of key technical skills required"],
  "experienceLevel": "Junior|Mid|Senior|Lead",
  "domainFocus": "The domain focus (e.g., 'AI/ML', 'Web', 'Mobile', 'Blockchain', 'Data', 'Cloud', 'DevOps')",
  "keyResponsibilities": ["main responsibilities"]
}

Return ONLY valid JSON, no markdown formatting.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```(?:json)?\n?/gi, "").trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("[ResumeSelector] Job analysis failed:", error);
    // Fallback analysis
    return {
      roleType: inferRoleType(jobTitle, techStack),
      requiredSkills: techStack || [],
      experienceLevel: "Mid",
      domainFocus: inferDomainFocus(jobTitle, techStack),
      keyResponsibilities: [],
    };
  }
}

/**
 * Step 2: Score each resume against job requirements
 */
async function scoreResumes(jobAnalysis, resumes) {
  const model = getModel();

  const prompt = `
You are a Resume Matching Agent. Score how well each resume matches the job requirements.

Job Analysis:
- Role Type: ${jobAnalysis.roleType}
- Required Skills: ${jobAnalysis.requiredSkills.join(", ")}
- Experience Level: ${jobAnalysis.experienceLevel}
- Domain Focus: ${jobAnalysis.domainFocus}

Resumes to Score:
${resumes.map((r, i) => `
--- Resume ${i + 1} ---
ID: ${r.id}
Name: ${r.name}
Type: ${r.type || "Not specified"}
Skills: ${(r.skills || []).join(", ")}
Experience Summary: ${r.experience?.substring(0, 500) || "Not provided"}
Resume Content Preview: ${r.content?.substring(0, 1000) || "Not available"}
`).join("\n")}

For each resume, calculate:
1. roleMatch (0-100): How well does the resume's experience match the role type
2. skillsMatch (0-100): Percentage of required skills present in resume
3. domainMatch (0-100): How well does the domain focus align
4. overallScore (0-100): Weighted combination of above

Return ONLY a JSON array:
[
  {"resumeId": "id", "roleMatch": 85, "skillsMatch": 70, "domainMatch": 90, "overallScore": 82, "reasoning": "Brief explanation"}
]

Return ONLY valid JSON, no markdown formatting.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```(?:json)?\n?/gi, "").trim();
    const scores = JSON.parse(cleaned);

    // Sort by overall score descending
    return scores.sort((a, b) => b.overallScore - a.overallScore);
  } catch (error) {
    console.error("[ResumeSelector] Scoring failed:", error);
    // Fallback scoring
    return resumes.map((r) => ({
      resumeId: r.id,
      roleMatch: calculateBasicScore(r.type, jobAnalysis.roleType),
      skillsMatch: calculateSkillsMatch(r.skills, jobAnalysis.requiredSkills),
      domainMatch: 50,
      overallScore: calculateBasicScore(r.type, jobAnalysis.roleType),
      reasoning: "Fallback scoring due to AI error",
    }));
  }
}

/**
 * Main function: Select the best resume for a job
 */
export async function selectBestResume(userId, jobId) {
  try {
    // Fetch job details
    const job = await db.jobListing.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error("Job not found");
    }

    // Fetch all user resumes
    const resumes = await db.resume.findMany({
      where: { userId },
    });

    if (resumes.length === 0) {
      return {
        selectedResume: null,
        matchScore: 0,
        allScores: [],
        message: "No resumes found. Please create a resume first.",
      };
    }

    if (resumes.length === 1) {
      return {
        selectedResume: resumes[0],
        matchScore: 100,
        allScores: [
          {
            resumeId: resumes[0].id,
            overallScore: 100,
            reasoning: "Only resume available",
          },
        ],
        message: "Using your only available resume",
      };
    }

    // Step 1: Analyze job
    const jobAnalysis = await analyzeJobRequirements(
      job.description,
      job.title,
      job.techStack
    );

    // Step 2: Score resumes
    const scores = await scoreResumes(jobAnalysis, resumes);

    // Step 3: Select best match
    const bestMatch = scores[0];
    const selectedResume = resumes.find((r) => r.id === bestMatch.resumeId);

    // Map scores with resume details
    const allScoresWithDetails = scores.map((score) => ({
      ...score,
      resume: resumes.find((r) => r.id === score.resumeId),
    }));

    return {
      selectedResume,
      matchScore: bestMatch.overallScore,
      jobAnalysis,
      allScores: allScoresWithDetails,
      message:
        bestMatch.overallScore >= 70
          ? `Selected "${selectedResume.name}" with ${bestMatch.overallScore}% match`
          : `No strong match found. "${selectedResume.name}" is the closest match at ${bestMatch.overallScore}%`,
    };
  } catch (error) {
    console.error("[ResumeSelector] Error:", error);
    throw error;
  }
}

/**
 * Generate email with selected resume context
 */
export async function generateEmailWithResume(applicationId, resumeId) {
  const model = getModel();

  // Fetch application with job and resume
  const application = await db.jobApplication.findFirst({
    where: { id: applicationId },
    include: { job: true },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  const resume = await db.resume.findUnique({
    where: { id: resumeId },
  });

  // Get user info
  const user = await db.user.findUnique({
    where: { id: application.userId },
    select: { name: true, bio: true, skills: true },
  });

  const prompt = `
You are an expert Ghostwriter who crafts personalized, high-converting cold emails for tech professionals.

CANDIDATE PROFILE:
Name: ${user?.name || "Candidate"}
${user?.bio ? `Bio: ${user.bio}` : ""}
${user?.skills?.length ? `Key Skills: ${user.skills.join(", ")}` : ""}

RESUME BEING USED:
Resume Name: ${resume?.name || "Primary Resume"}
Resume Type: ${resume?.type || "General"}
Resume Skills: ${(resume?.skills || []).join(", ")}
${resume?.experience ? `Experience Summary: ${resume.experience}` : ""}

Full Resume Content:
${resume?.content?.substring(0, 3000) || "Resume content not available"}

TARGET JOB:
Title: ${application.job.title}
Company: ${application.job.company}
Tech Stack: ${(application.job.techStack || []).join(", ")}
Job Description:
${application.job.description?.substring(0, 2000) || "Not provided"}

INSTRUCTIONS:
1. Write a compelling cold email (200-300 words) that feels human, not templated.
2. Open with a hook — mention something specific about the company or the role that excites you.
3. Reference 2-3 SPECIFIC projects, achievements, or experiences from the resume that directly map to the job requirements. Use concrete numbers and outcomes where available.
4. Draw a clear connection between your past work and what this role needs.
5. Show genuine enthusiasm without being over-the-top.
6. Close with a confident but polite call-to-action asking for a 15-minute call.
7. Use a professional but warm tone — no buzzwords, no fluff.
8. The subject line should be specific and intriguing, not generic.

Format as:
Subject: [Specific, compelling subject line]

[Email body with proper paragraphs]

[Professional sign-off with candidate name]

Return ONLY the email text, no extra commentary.`;

  const result = await model.generateContent(prompt);
  const draftEmail = result.response.text().trim();

  // Update application with resume ID and draft email
  await db.jobApplication.update({
    where: { id: applicationId },
    data: {
      resumeId,
      draftEmail,
    },
  });

  return {
    draftEmail,
    resumeUsed: resume,
  };
}

/**
 * Helper: Infer role type from job title and tech stack
 */
function inferRoleType(title, techStack) {
  const t = (title || "").toLowerCase();
  const ts = (techStack || []).join(" ").toLowerCase();

  if (t.includes("ai") || t.includes("ml") || t.includes("machine learning"))
    return "AI Engineer";
  if (t.includes("blockchain") || t.includes("web3") || ts.includes("solidity"))
    return "Blockchain Developer";
  if (t.includes("mobile") || t.includes("android") || t.includes("ios"))
    return "Mobile Developer";
  if (t.includes("frontend") || t.includes("react") || t.includes("vue"))
    return "Frontend Developer";
  if (t.includes("backend") || t.includes("api") || t.includes("server"))
    return "Backend Developer";
  if (t.includes("full stack") || t.includes("fullstack")) return "Full Stack Developer";
  if (t.includes("data")) return "Data Scientist";
  if (t.includes("devops") || t.includes("sre")) return "DevOps Engineer";

  return "Software Engineer";
}

/**
 * Helper: Infer domain focus
 */
function inferDomainFocus(title, techStack) {
  const combined = `${title} ${(techStack || []).join(" ")}`.toLowerCase();

  if (combined.includes("ai") || combined.includes("ml")) return "AI/ML";
  if (combined.includes("blockchain") || combined.includes("web3")) return "Blockchain";
  if (combined.includes("mobile") || combined.includes("app")) return "Mobile";
  if (combined.includes("web") || combined.includes("frontend") || combined.includes("react")) return "Web";
  if (combined.includes("data")) return "Data";
  if (combined.includes("cloud") || combined.includes("aws")) return "Cloud";

  return "General";
}

/**
 * Helper: Calculate basic score based on type matching
 */
function calculateBasicScore(resumeType, jobRoleType) {
  if (!resumeType || !jobRoleType) return 50;

  const rt = resumeType.toLowerCase();
  const jt = jobRoleType.toLowerCase();

  if (rt === jt) return 100;
  if (rt.includes(jt) || jt.includes(rt)) return 85;
  if ((rt.includes("full") && jt.includes("stack")) || (jt.includes("full") && rt.includes("stack"))) return 75;

  return 40;
}

/**
 * Helper: Calculate skills match percentage
 */
function calculateSkillsMatch(resumeSkills, requiredSkills) {
  if (!resumeSkills?.length || !requiredSkills?.length) return 50;

  const matching = requiredSkills.filter((skill) =>
    resumeSkills.some((rs) => rs.toLowerCase().includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(rs.toLowerCase()))
  );

  return Math.round((matching.length / requiredSkills.length) * 100);
}

/**
 * API: Get resume selection for a job
 */
export async function getResumeSelectionForJob(userId, jobId) {
  return selectBestResume(userId, jobId);
}

/**
 * API: Get all resumes with match scores for a job
 */
export async function getAllResumesWithScores(userId, jobId) {
  const result = await selectBestResume(userId, jobId);
  return {
    resumes: result.allScores,
    selectedResumeId: result.selectedResume?.id,
    jobAnalysis: result.jobAnalysis,
  };
}
