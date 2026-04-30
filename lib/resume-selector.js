import { db } from "@/lib/prisma";
import { handleGeminiError } from "@/lib/gemini";
import { generateTextWithFallback } from "@/lib/ai-fallback";

async function generateTextWithProviderFallback(prompt, options = {}) {
  const result = await generateTextWithFallback(
    [{ role: "user", content: String(prompt || "") }],
    {
      temperature:
        typeof options.temperature === "number" ? options.temperature : 0.2,
      maxTokens:
        typeof options.maxTokens === "number" ? options.maxTokens : 900,
      timeoutMs:
        typeof options.timeoutMs === "number" ? options.timeoutMs : 25000,
      maxAttempts:
        typeof options.maxAttempts === "number" ? options.maxAttempts : 8,
    }
  );
  return result;
}

/**
 * AI Agent for Smart Resume Selection
 * Analyzes job requirements and selects the best matching resume
 */

/**
 * Step 1: Analyze job description to extract key requirements
 */
async function analyzeJobRequirements(jobDescription, jobTitle, techStack) {
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
    const result = await generateTextWithProviderFallback(prompt, {
      temperature: 0.15,
      maxTokens: 500,
      maxAttempts: 6,
    });
    const text = String(result?.text || "").trim();
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
    const result = await generateTextWithProviderFallback(prompt, {
      temperature: 0.15,
      maxTokens: 700,
      maxAttempts: 6,
    });
    const text = String(result?.text || "").trim();
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

function extractCandidateLinks(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  const links = [...new Set(matches.map((link) => link.replace(/[),.;]+$/, "")))];

  const result = {
    linkedin: "",
    github: "",
    portfolio: "",
    others: [],
  };

  for (const link of links) {
    const lower = link.toLowerCase();
    if (!result.linkedin && lower.includes("linkedin.com")) {
      result.linkedin = link;
      continue;
    }
    if (!result.github && lower.includes("github.com")) {
      result.github = link;
      continue;
    }
    if (
      !result.portfolio &&
      !lower.includes("linkedin.com") &&
      !lower.includes("github.com")
    ) {
      result.portfolio = link;
      continue;
    }
    result.others.push(link);
  }

  return result;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractUrls(text) {
  return Array.from(
    new Set(
      (String(text || "").match(/https?:\/\/[^\s<>"'`]+/gi) || []).map((url) =>
        url.replace(/[),.;]+$/, "")
      )
    )
  );
}

function isInvalidRedraftOutput(draftEmail, { company, candidateName }) {
  const text = String(draftEmail || "");
  if (!text.trim()) return true;
  if (!/^subject\s*:/im.test(text)) return true;

  const escapedCandidate = escapeRegex(candidateName);
  if (
    escapedCandidate &&
    new RegExp(`\\bhi\\s+${escapedCandidate}\\b`, "i").test(text)
  ) {
    return true;
  }

  const escapedCompany = escapeRegex(company);
  if (!escapedCompany) return false;

  // Guard against role reversal hallucinations like:
  // "I built ... at Intuit", "We scaled ... for Intuit" in applicant email.
  const roleReversalPattern = new RegExp(
    `\\b(i|we)\\b[^.\\n]{0,35}\\b(built|led|designed|implemented|optimized|migrated|improved|scaled|cut|reduced|launched|drove|delivered)\\b[^.\\n]{0,60}\\b(at|for|inside|within)\\s+${escapedCompany}\\b`,
    "i"
  );

  return roleReversalPattern.test(text);
}

function normalizeGreeting(draftEmail, candidateName = "") {
  const lines = String(draftEmail || "").split(/\r?\n/);
  if (lines.length === 0) return draftEmail;

  const escapedCandidate = escapeRegex(candidateName);
  const candidateRegex = escapedCandidate
    ? new RegExp(`^\\s*(hi|dear)\\s+${escapedCandidate}\\s*,?\\s*$`, "i")
    : null;
  const genericGreetingRegex =
    /^\s*(hi|dear)\s+(\[?\s*hiring\s*manager[^\]]*\]?|hiring\s*manager|recruiter|sir\/?madam)\s*,?\s*$/i;

  for (let i = 0; i < Math.min(lines.length, 12); i += 1) {
    const line = lines[i];
    if (genericGreetingRegex.test(line)) {
      lines[i] = "Dear Hiring Team,";
      return lines.join("\n");
    }
    if (candidateRegex && candidateRegex.test(line)) {
      lines[i] = "Dear Hiring Team,";
      return lines.join("\n");
    }
  }

  return lines.join("\n");
}

/**
 * Generate email with selected resume context
 */
export async function generateEmailWithResume(applicationId, resumeId, options = {}) {
  const feedback = String(options?.userFeedback || "").trim();
  const currentDraftOverride = String(options?.currentDraft || "").trim();

  // Fetch application with job and resume
  const application = await db.jobApplication.findFirst({
    where: { id: applicationId },
    include: { job: true },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  let resolvedResumeId = resumeId;
  if (!resolvedResumeId) {
    const fallbackResume = await db.resume.findFirst({
      where: { userId: application.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { id: true },
    });
    resolvedResumeId = fallbackResume?.id || null;
  }

  if (!resolvedResumeId) {
    throw new Error("No resume profile found. Please save at least one resume.");
  }

  const resume = await db.resume.findFirst({
    where: { id: resolvedResumeId, userId: application.userId },
  });
  if (!resume) {
    throw new Error("Selected resume profile was not found. Please pick another profile.");
  }

  // Get user info
  const user = await db.user.findUnique({
    where: { id: application.userId },
    select: { name: true, bio: true, skills: true },
  });

  const links = extractCandidateLinks(
    `${user?.bio || ""}\n${resume?.content || ""}`
  );
  const feedbackLinks = extractUrls(feedback);
  const currentDraft =
    currentDraftOverride || String(application?.draftEmail || "").trim();
  const isRedraft = Boolean(feedback && currentDraft);
  const knownLinks = [
    links.linkedin ? `LinkedIn: ${links.linkedin}` : null,
    links.github ? `GitHub: ${links.github}` : null,
    links.portfolio ? `Portfolio: ${links.portfolio}` : null,
    ...feedbackLinks.map((url, index) => `Feedback URL ${index + 1}: ${url}`),
  ].filter(Boolean);

  const prompt = isRedraft
    ? `
You are a precision editor for job-application cold emails.
You MUST edit the existing draft and preserve facts.

CANDIDATE PROFILE:
Name: ${user?.name || "Candidate"}
${user?.bio ? `Bio: ${user.bio}` : ""}
${user?.skills?.length ? `Key Skills: ${user.skills.join(", ")}` : ""}

RESUME BEING USED:
Resume Name: ${resume?.name || "Primary Resume"}
Resume Type: ${resume?.type || "General"}
Resume Skills: ${(resume?.skills || []).join(", ")}
${resume?.experience ? `Experience Summary: ${resume.experience}` : ""}

KNOWN PUBLIC LINKS (safe to include):
${knownLinks.length ? knownLinks.join("\n") : "No explicit links found"}

TARGET JOB:
Title: ${application.job.title}
Company: ${application.job.company}
Tech Stack: ${(application.job.techStack || []).join(", ")}

EXISTING DRAFT (edit this):
${currentDraft}

USER FEEDBACK TO APPLY:
${feedback}

STRICT RULES:
1. Keep candidate perspective as an external applicant. Never write as if candidate works at ${application.job.company}.
2. Do NOT add new achievements, metrics, employers, or project claims unless already present in the existing draft or resume content.
3. Make the smallest effective edit to satisfy feedback; keep all unaffected facts unchanged.
4. If feedback asks for a greeting name equal to candidate name ("${user?.name || "Candidate"}"), use "Hiring Team" instead.
5. Keep links factual; include user-provided URLs from feedback when relevant.
6. Keep tone professional and application-oriented.
7. Keep format:
Subject: ...

[email body]

[sign-off]
8. Return only the final email text. No explanation.
`
    : `
You are an expert ghostwriter who crafts personalized, high-converting cold emails for tech professionals.

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

KNOWN PUBLIC LINKS (include in sign-off if present):
${knownLinks.length ? knownLinks.join("\n") : "No explicit links found"}

TARGET JOB:
Title: ${application.job.title}
Company: ${application.job.company}
Tech Stack: ${(application.job.techStack || []).join(", ")}
Job Description:
${application.job.description?.substring(0, 2000) || "Not provided"}

INSTRUCTIONS:
1. Write a compelling cold email (190-280 words) that feels human, not templated.
2. Open with a hook that mentions something specific about the company or role.
3. Reference 2-3 specific projects/achievements from the resume that map to job needs. Use numbers/outcomes where available.
4. Show why this profile fits the role and close with a polite 15-minute call request.
5. Use a professional and warm tone. Avoid fluff and generic cliches.
6. Add a strong subject line.
7. Include a short sign-off block with candidate name and available links (LinkedIn, GitHub, portfolio).
8. Do not invent achievements, links, or technologies not present in given context.
9. Keep candidate perspective external to ${application.job.company}; never imply they already work there.

Format as:
Subject: [Specific, compelling subject line]

[Email body with proper paragraphs]

[Professional sign-off]

Return only the email text.
`;

  let draftEmail = "";
  try {
    const result = await generateTextWithProviderFallback(prompt, {
      temperature: isRedraft ? 0.2 : 0.35,
      maxTokens: 900,
      maxAttempts: 10,
      timeoutMs: 30000,
    });
    draftEmail = String(result?.text || "").trim();

    if (
      isRedraft &&
      isInvalidRedraftOutput(draftEmail, {
        company: application.job.company,
        candidateName: user?.name || "",
      })
    ) {
      const repairPrompt = `
Fix the following draft so it is a valid application email.
- Candidate is applying to ${application.job.company}, not working there.
- Do not invent new achievements.
- Keep user's requested edits.
- Keep factual links.
- Keep format:
Subject: ...

[email body]

[sign-off]

BROKEN DRAFT:
${draftEmail}
`;
      const repaired = await generateTextWithProviderFallback(repairPrompt, {
        temperature: 0.15,
        maxTokens: 900,
        maxAttempts: 6,
        timeoutMs: 25000,
      });
      draftEmail = String(repaired?.text || "").trim();
    }

    draftEmail = normalizeGreeting(draftEmail, user?.name || "");
  } catch (error) {
    const message = String(error?.message || "");
    if (message.startsWith("All text providers failed.")) {
      throw new Error(message);
    }
    throw new Error(handleGeminiError(error));
  }

  // Update application with resume ID and draft email
  await db.jobApplication.update({
    where: { id: applicationId },
    data: {
      resumeId: resolvedResumeId,
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

