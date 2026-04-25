#!/usr/bin/env python3
"""
ATS Resume Checker
Analyzes resumes against job descriptions using 4 categories:
1. Keyword Matching (40% weight)
2. Formatting & Parsing (20% weight)
3. Readability & Structure (20% weight)
4. Grammar & Spelling (20% weight)
"""

import json
import re
import sys
from typing import Dict, List, Tuple
import subprocess
import os

try:
    import spacy
    from textstat import text_stats
    import language_tool_python
    nlp = spacy.load("en_core_web_sm")
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "spacy", "textstat", "language-tool-python", "-q"])
    subprocess.check_call([sys.executable, "-m", "spacy", "download", "en_core_web_sm", "-q"])
    import spacy
    from textstat import text_stats
    import language_tool_python
    nlp = spacy.load("en_core_web_sm")


def extract_keywords(job_description: str) -> List[str]:
    """Extract keywords from job description."""
    # Common skill patterns
    skill_patterns = [
        r'\b(Python|Java|JavaScript|TypeScript|React|Angular|Vue|Node\.js|Express)\b',
        r'\b(Go|Rust|C\+\+|C#|Ruby|PHP|Swift|Kotlin|Scala)\b',
        r'\b(AWS|Azure|GCP|Docker|Kubernetes|Jenkins|Terraform)\b',
        r'\b(SQL|NoSQL|MongoDB|PostgreSQL|MySQL|Redis)\b',
        r'\b(Machine Learning|Deep Learning|NLP|Computer Vision)\b',
        r'\b(API|REST|GraphQL|Microservices|Monolithic)\b',
        r'\b(Agile|Scrum|JIRA|TDD|BDD)\b',
        r'\b(Git|Docker|Kubernetes|CI/CD|DevOps)\b',
        r'\b(AI|ML|MLOps|Data Science|Analytics)\b',
        r'\b(Leadership|Management|Team Building)\b',
    ]

    keywords = set()
    for pattern in skill_patterns:
        matches = re.findall(pattern, job_description, re.IGNORECASE)
        keywords.update([m.lower() for m in matches])

    # Also extract noun chunks that might be skills
    doc = nlp(job_description)
    for chunk in doc.noun_chunks:
        chunk_text = chunk.text.lower()
        if len(chunk_text) > 3 and chunk_text not in keywords:
            # Check if it looks like a skill
            if any(word in chunk_text for word in ['skill', 'tool', 'technology', 'framework', 'language']):
                keywords.add(chunk_text)

    return list(keywords)


def check_keyword_matching(resume_text: str, job_description: str) -> Dict:
    """Category 1: Keyword Matching (40% weight)."""
    job_keywords = extract_keywords(job_description)
    resume_lower = resume_text.lower()

    matched = []
    missing = []
    for keyword in job_keywords:
        if keyword.lower() in resume_lower:
            matched.append(keyword)
        else:
            missing.append(keyword)

    match_percentage = (len(matched) / len(job_keywords) * 100) if job_keywords else 100

    return {
        "score": round(match_percentage, 1),
        "matched_keywords": matched[:20],  # Limit for output
        "missing_keywords": missing[:20],
        "total_found": len(matched),
        "total_required": len(job_keywords)
    }


def check_formatting_parsing(resume_text: str) -> Dict:
    """Category 2: Formatting & Parsing (20% weight)."""
    issues = []
    score = 100

    # Check for tables (ATS usually can't read tables)
    if re.search(r'\|.*\|', resume_text) or re.search(r'╔.*╗', resume_text):
        issues.append("Tables detected - ATS cannot parse table layouts")
        score -= 30

    # Check for columns (common in modern resumes)
    if resume_text.count('\n\n') > 5 and len(resume_text.split('\n')) > 50:
        # Could indicate columns
        issues.append("Possible multi-column layout detected")
        score -= 15

    # Check for text boxes or special characters
    if re.search(r'[─-◿]', resume_text):  # Box drawing chars
        issues.append("Special Unicode characters detected")
        score -= 20

    # Check for headers/footers (often not parsed)
    lines = resume_text.split('\n')
    if len(lines) > 0 and len(lines[0]) > 80:
        issues.append("Header line appears too long - possible header/footer")
        score -= 10

    # Check font suggestions (we can't check actual font, but can suggest)
    font_issues = []
    if len(resume_text) > 0:
        font_issues.append("Use standard fonts like Arial, Calibri, or Times New Roman")

    # Standard section headers check
    standard_headers = ['experience', 'education', 'skills', 'summary', 'objective']
    found_headers = []
    for header in standard_headers:
        if re.search(rf'^{header}', resume_text, re.IGNORECASE | re.MULTILINE):
            found_headers.append(header)

    if len(found_headers) < 3:
        issues.append("Non-standard section headers may confuse ATS")
        score -= 10

    pass_fail = "pass" if score >= 80 else "fail"

    return {
        "score": max(0, score),
        "status": pass_fail,
        "issues": issues,
        "suggestions": font_issues
    }


def check_readability_structure(resume_text: str) -> Dict:
    """Category 3: Readability & Structure (20% weight)."""
    issues = []
    score = 100

    # Check section headers
    required_sections = ['experience', 'skills']
    found_sections = []
    for section in required_sections:
        if re.search(rf'^{section}', resume_text, re.IGNORECASE | re.MULTILINE):
            found_sections.append(section)

    if len(found_sections) < len(required_sections):
        issues.append("Missing standard sections like Experience or Skills")
        score -= 15

    # Check bullet points usage
    bullet_count = len(re.findall(r'[•\-\*]\s', resume_text))
    if bullet_count < 3:
        issues.append("Too few bullet points - use bullets for achievements")
        score -= 15

    # Check sentence length (too long = hard to scan)
    sentences = re.split(r'[.!?]+', resume_text)
    long_sentences = sum(1 for s in sentences if len(s.split()) > 30)
    if long_sentences > 3:
        issues.append("Some sentences are too long (over 30 words)")
        score -= 10

    # Check for quantifiable achievements
    metrics_found = len(re.findall(r'\d+%|\$\d+|\d+[Xx]|\d+\s+(years?|months?|years)', resume_text))
    if metrics_found < 2:
        issues.append("Add more quantifiable achievements ( %, $, X, years)")
        score -= 15

    # White space check (too cramped = bad)
    lines = [l for l in resume_text.split('\n') if l.strip()]
    if len(lines) < 10:
        issues.append("Resume appears too short")
        score -= 10
    elif len(lines) > 100:
        issues.append("Resume may be too long - consider condensing")
        score -= 10

    # Action verbs check
    action_verbs = ['led', 'developed', 'created', 'implemented', 'managed', 'designed', 'built', 'achieved']
    action_count = sum(1 for verb in action_verbs if re.search(rf'\b{verb}', resume_text, re.IGNORECASE))
    if action_count < 3:
        issues.append("Use more action verbs at the start of bullet points")
        score -= 10

    return {
        "score": max(0, score),
        "issues": issues,
        "bullet_count": bullet_count,
        "metrics_found": metrics_found,
        "action_verb_count": action_count
    }


def check_grammar_spelling(resume_text: str) -> Dict:
    """Category 4: Grammar & Spelling (20% weight)."""
    errors = []
    suggestions = []
    score = 100

    try:
        tool = language_tool_python.LanguageTool('en-US')
        matches = tool.check(resume_text)

        # Filter for serious errors only
        serious_categories = ['TYPOS', 'GRAMMAR', 'PUNCTUATION']
        for match in matches:
            if match.rule.get('category', {}).get('id') in serious_categories:
                errors.append(f"{match.ruleId}: {match.message}")
                if match.replacements:
                    suggestions.append(f"Consider: {', '.join(match.replacements[:3])}")

        # Deduct score based on error count
        error_count = len(errors)
        if error_count > 5:
            score -= 30
        elif error_count > 3:
            score -= 20
        elif error_count > 1:
            score -= 10
    except Exception as e:
        errors.append(f"Grammar check unavailable: {str(e)}")
        score = 50

    return {
        "score": max(0, score),
        "error_count": len(errors),
        "errors": errors[:10],  # Limit output
        "suggestions": suggestions[:5]
    }


def analyze_resume(resume_text: str, job_description: str = "") -> Dict:
    """
    Main function to analyze resume against job description.
    Returns JSON with overall score and category scores.
    """
    # Category 1: Keyword Matching (40%)
    keyword_result = check_keyword_matching(resume_text, job_description)

    # Category 2: Formatting & Parsing (20%)
    formatting_result = check_formatting_parsing(resume_text)

    # Category 3: Readability & Structure (20%)
    readability_result = check_readability_structure(resume_text)

    # Category 4: Grammar & Spelling (20%)
    grammar_result = check_grammar_spelling(resume_text)

    # Calculate weighted overall score
    overall_score = (
        keyword_result["score"] * 0.40 +
        formatting_result["score"] * 0.20 +
        readability_result["score"] * 0.20 +
        grammar_result["score"] * 0.20
    )

    # Generate recommendations
    recommendations = []

    if keyword_result["score"] < 60:
        recommendations.append(f"Add more keywords from job description - missing {len(keyword_result['missing_keywords'])} key skills")

    if formatting_result["status"] == "fail":
        recommendations.append("Fix formatting issues - avoid tables, columns, and special characters")

    if readability_result["score"] < 70:
        recommendations.append("Improve readability - use bullet points and quantify achievements")

    if grammar_result["score"] < 80:
        recommendations.append("Proofread for grammar and spelling errors")

    if overall_score >= 80:
        recommendations.append("Great resume! Ready for ATS submission")
    elif overall_score >= 60:
        recommendations.append("Good start - address the issues above to improve your score")
    else:
        recommendations.append("Needs improvement - review all categories and make changes")

    return {
        "overall_score": round(overall_score, 1),
        "categories": {
            "keyword_matching": {
                "score": keyword_result["score"],
                "weight": "40%",
                "matched_keywords": keyword_result["matched_keywords"],
                "missing_keywords": keyword_result["missing_keywords"],
                "match_percentage": keyword_result["score"]
            },
            "formatting_parsing": {
                "score": formatting_result["score"],
                "weight": "20%",
                "status": formatting_result["status"],
                "issues": formatting_result["issues"],
                "suggestions": formatting_result["suggestions"]
            },
            "readability_structure": {
                "score": readability_result["score"],
                "weight": "20%",
                "issues": readability_result["issues"],
                "metrics_found": readability_result["metrics_found"]
            },
            "grammar_spelling": {
                "score": grammar_result["score"],
                "weight": "20%",
                "error_count": grammar_result["error_count"],
                "errors": grammar_result["errors"],
                "suggestions": grammar_result["suggestions"]
            }
        },
        "recommendations": recommendations
    }


if __name__ == "__main__":
    # Example usage
    if len(sys.argv) > 1:
        resume_file = sys.argv[1]
        job_desc = sys.argv[2] if len(sys.argv) > 2 else ""

        with open(resume_file, 'r') as f:
            resume_text = f.read()
    else:
        # Demo with sample data
        resume_text = """
        John Doe
        Software Engineer

        Experience
        - Led development of microservices architecture using Python and Docker
        - Developed RESTful APIs serving 1M+ users
        - Implemented CI/CD pipeline reducing deployment time by 50%

        Skills
        Python, JavaScript, Docker, Kubernetes, AWS, SQL
        """
        job_desc = """
        Looking for a Senior Python Developer with experience in:
        - Python, Django, FastAPI
        - Docker, Kubernetes
        - AWS, microservices
        - RESTful API design
        - Agile methodology
        """

    result = analyze_resume(resume_text, job_desc)
    print(json.dumps(result, indent=2))