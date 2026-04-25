import { getModel } from "./gemini";

/**
 * ATS Resume Checker
 * Analyzes resumes against job descriptions using 4 categories:
 * 1. Keyword Matching (40% weight)
 * 2. Formatting & Parsing (20% weight)
 * 3. Readability & Structure (20% weight)
 * 4. Grammar & Spelling (20% weight)
 */

function extractKeywords(jobDescription) {
  const skillPatterns = [
    /\b(Python|Java|JavaScript|TypeScript|React|Angular|Vue|Node\.js|Express)\b/gi,
    /\b(Go|Rust|C\+\+|C#|Ruby|PHP|Swift|Kotlin|Scala)\b/gi,
    /\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins|Terraform)\b/gi,
    /\b(SQL|NoSQL|MongoDB|PostgreSQL|MySQL|Redis)\b/gi,
    /\b(Machine Learning|Deep Learning|NLP|Computer Vision|AI|ML)\b/gi,
    /\b(API|REST|GraphQL|Microservices)\b/gi,
    /\b(Agile|Scrum|JIRA|TDD|BDD)\b/gi,
    /\b(Git|CI\/CD|DevOps)\b/gi,
  ];

  const keywords = new Set();
  skillPatterns.forEach(pattern => {
    const matches = jobDescription.match(pattern);
    if (matches) {
      matches.forEach(m => keywords.add(m.toLowerCase()));
    }
  });

  // Extract more keywords using AI-like approach
  const commonWords = ['the', 'and', 'or', 'to', 'for', 'with', 'in', 'of', 'a', 'an', 'is', 'are', 'be'];
  const words = jobDescription.toLowerCase().split(/\W+/).filter(w =>
    w.length > 3 && !commonWords.includes(w)
  );
  words.forEach(w => keywords.add(w));

  return Array.from(keywords);
}

function checkKeywordMatching(resumeText, jobDescription) {
  const jobKeywords = extractKeywords(jobDescription);
  const resumeLower = resumeText.toLowerCase();

  const matched = [];
  const missing = [];

  jobKeywords.forEach(keyword => {
    if (resumeLower.includes(keyword.toLowerCase())) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  });

  const matchPercentage = jobKeywords.length > 0
    ? (matched.length / jobKeywords.length) * 100
    : 100;

  return {
    score: Math.round(matchPercentage * 10) / 10,
    matchedKeywords: matched.slice(0, 20),
    missingKeywords: missing.slice(0, 20),
    totalFound: matched.length,
    totalRequired: jobKeywords.length
  };
}

function checkFormattingParsing(resumeText) {
  const issues = [];
  let score = 100;

  // Check for tables
  if (/\|[^|]+\|/.test(resumeText) || /╔/.test(resumeText)) {
    issues.push("Tables detected - ATS cannot parse table layouts");
    score -= 30;
  }

  // Check for columns (heuristic)
  const lines = resumeText.split('\n').filter(l => l.trim());
  if (lines.length > 50 && lines.filter(l => l.length < 30).length > 20) {
    issues.push("Possible multi-column layout detected");
    score -= 15;
  }

  // Check for special characters
  if (/[─-◿]/.test(resumeText)) {
    issues.push("Special Unicode characters detected");
    score -= 20;
  }

  // Check for headers that are too long
  if (lines.length > 0 && lines[0].length > 80) {
    issues.push("Header line appears too long - possible header/footer");
    score -= 10;
  }

  // Check section headers
  const standardHeaders = ['experience', 'education', 'skills', 'summary', 'work history', 'projects'];
  const foundHeaders = standardHeaders.filter(header =>
    new RegExp(`^${header}`, 'im').test(resumeText)
  );

  if (foundHeaders.length < 3) {
    issues.push("Non-standard section headers may confuse ATS");
    score -= 10;
  }

  const passFail = score >= 80 ? "pass" : "fail";

  return {
    score: Math.max(0, score),
    status: passFail,
    issues,
    suggestions: ["Use standard fonts like Arial, Calibri, or Times New Roman"]
  };
}

function checkReadabilityStructure(resumeText) {
  const issues = [];
  let score = 100;

  // Check required sections
  const requiredSections = ['experience', 'skills'];
  const foundSections = requiredSections.filter(section =>
    new RegExp(`^${section}`, 'im').test(resumeText)
  );

  if (foundSections.length < requiredSections.length) {
    issues.push("Missing standard sections like Experience or Skills");
    score -= 15;
  }

  // Check bullet points
  const bulletCount = (resumeText.match(/[•\-\*]\s/g) || []).length;
  if (bulletCount < 3) {
    issues.push("Too few bullet points - use bullets for achievements");
    score -= 15;
  }

  // Check sentence length
  const sentences = resumeText.split(/[.!?]+/);
  const longSentences = sentences.filter(s => s.split(/\s+/).length > 30).length;
  if (longSentences > 3) {
    issues.push("Some sentences are too long (over 30 words)");
    score -= 10;
  }

  // Check for quantifiable achievements
  const metricsFound = (resumeText.match(/\d+%|\$\d+|\d+[Xx]|\d+\s+(years?|months?|years)/g) || []).length;
  if (metricsFound < 2) {
    issues.push("Add more quantifiable achievements (%, $, X, years)");
    score -= 15;
  }

  // Check length
  const textLines = resumeText.split('\n').filter(l => l.trim());
  if (textLines.length < 10) {
    issues.push("Resume appears too short");
    score -= 10;
  } else if (textLines.length > 100) {
    issues.push("Resume may be too long - consider condensing");
    score -= 10;
  }

  // Check action verbs
  const actionVerbs = ['led', 'developed', 'created', 'implemented', 'managed', 'designed', 'built', 'achieved', 'built', 'optimized'];
  const actionCount = actionVerbs.filter(verb =>
    new RegExp(`\\b${verb}\\b`, 'gi').test(resumeText)
  ).length;

  if (actionCount < 3) {
    issues.push("Use more action verbs at the start of bullet points");
    score -= 10;
  }

  return {
    score: Math.max(0, score),
    issues,
    bulletCount,
    metricsFound,
    actionVerbCount: actionCount
  };
}

async function checkGrammarSpelling(resumeText) {
  const model = getModel();
  const issues = [];
  let score = 100;

  try {
    const prompt = `
You are a grammar and spelling checker. Analyze the following resume text for errors.

Resume:
${resumeText}

Check for:
1. Spelling errors
2. Grammar mistakes
3. Punctuation errors
4. Run-on sentences
5. Subject-verb agreement issues

Return a JSON object with:
{
  "errors": ["list of specific errors found with context"],
  "suggestions": ["list of corrections"],
  "summary": "brief overall assessment"
}

Return ONLY valid JSON, no markdown formatting.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```(?:json)?\n?/gi, "").trim();
    const grammarResult = JSON.parse(cleaned);

    issues.push(...grammarResult.errors);

    const errorCount = grammarResult.errors?.length || 0;
    if (errorCount > 5) score -= 30;
    else if (errorCount > 3) score -= 20;
    else if (errorCount > 1) score -= 10;

    return {
      score: Math.max(0, score),
      errorCount,
      errors: issues.slice(0, 10),
      suggestions: grammarResult.suggestions?.slice(0, 5) || [],
      summary: grammarResult.summary || ""
    };
  } catch (error) {
    console.error("[ATS] Grammar check failed:", error);
    issues.push("Grammar check unavailable");
    return {
      score: 50,
      errorCount: 1,
      errors: issues,
      suggestions: [],
      summary: "Could not complete grammar check"
    };
  }
}

export async function analyzeResumeWithAI(resumeText, jobDescription = "") {
  // Category 1: Keyword Matching (40%)
  const keywordResult = checkKeywordMatching(resumeText, jobDescription);

  // Category 2: Formatting & Parsing (20%)
  const formattingResult = checkFormattingParsing(resumeText);

  // Category 3: Readability & Structure (20%)
  const readabilityResult = checkReadabilityStructure(resumeText);

  // Category 4: Grammar & Spelling (20%) - async
  const grammarResult = await checkGrammarSpelling(resumeText);

  // Calculate weighted overall score
  const overallScore = (
    keywordResult.score * 0.40 +
    formattingResult.score * 0.20 +
    readabilityResult.score * 0.20 +
    grammarResult.score * 0.20
  );

  // Generate recommendations
  const recommendations = [];

  if (keywordResult.score < 60) {
    recommendations.push(`Add more keywords from job description - missing ${keywordResult.missingKeywords.length} key skills`);
  }

  if (formattingResult.status === "fail") {
    recommendations.push("Fix formatting issues - avoid tables, columns, and special characters");
  }

  if (readabilityResult.score < 70) {
    recommendations.push("Improve readability - use bullet points and quantify achievements");
  }

  if (grammarResult.score < 80) {
    recommendations.push("Proofread for grammar and spelling errors");
  }

  if (overallScore >= 80) {
    recommendations.push("Great resume! Ready for ATS submission");
  } else if (overallScore >= 60) {
    recommendations.push("Good start - address the issues above to improve your score");
  } else {
    recommendations.push("Needs improvement - review all categories and make changes");
  }

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    categories: {
      keywordMatching: {
        score: keywordResult.score,
        weight: "40%",
        ...keywordResult
      },
      formattingParsing: {
        score: formattingResult.score,
        weight: "20%",
        ...formattingResult
      },
      readabilityStructure: {
        score: readabilityResult.score,
        weight: "20%",
        ...readabilityResult
      },
      grammarSpelling: {
        score: grammarResult.score,
        weight: "20%",
        errorCount: grammarResult.errorCount,
        errors: grammarResult.errors,
        suggestions: grammarResult.suggestions
      }
    },
    recommendations
  };
}

/**
 * Quick ATS check without job description (just formatting + grammar)
 */
export async function quickAtsCheck(resumeText) {
  const formattingResult = checkFormattingParsing(resumeText);
  const readabilityResult = checkReadabilityStructure(resumeText);
  const grammarResult = await checkGrammarSpelling(resumeText);

  const overallScore = (
    formattingResult.score * 0.30 +
    readabilityResult.score * 0.30 +
    grammarResult.score * 0.40
  );

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    categories: {
      formattingParsing: formattingResult,
      readabilityStructure: readabilityResult,
      grammarSpelling: {
        score: grammarResult.score,
        errorCount: grammarResult.errorCount,
        errors: grammarResult.errors,
        suggestions: grammarResult.suggestions
      }
    },
    recommendations: overallScore >= 70
      ? ["Resume looks good!"]
      : ["Consider improving formatting and structure"]
  };
}