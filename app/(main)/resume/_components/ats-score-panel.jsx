"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { checkResumeATS } from "@/actions/resume";
import {
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Search,
  FileWarning,
  Type,
  LayoutList,
} from "lucide-react";
import { toast } from "sonner";

function ScoreRing({ score, size = 80 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let color = "text-red-500";
  if (score >= 80) color = "text-green-500";
  else if (score >= 60) color = "text-yellow-500";
  else if (score >= 40) color = "text-orange-500";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${color} transition-all duration-1000 ease-out`}
        />
      </svg>
      <span className="absolute text-lg font-bold">{Math.round(score)}</span>
    </div>
  );
}

function CategoryCard({ icon: Icon, label, score, weight, issues, expanded, onToggle }) {
  let statusColor = "text-red-500 bg-red-500/10";
  let statusIcon = XCircle;
  if (score >= 80) {
    statusColor = "text-green-500 bg-green-500/10";
    statusIcon = CheckCircle2;
  } else if (score >= 60) {
    statusColor = "text-yellow-500 bg-yellow-500/10";
    statusIcon = AlertTriangle;
  }

  const StatusIcon = statusIcon;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${statusColor}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-[10px] text-muted-foreground uppercase">{weight} weight</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <StatusIcon className={`h-3.5 w-3.5 ${statusColor.split(" ")[0]}`} />
            <span className="text-sm font-bold">{Math.round(score)}%</span>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && issues && issues.length > 0 && (
        <div className="px-3 pb-3 border-t">
          <ul className="mt-2 space-y-1.5">
            {issues.map((issue, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-amber-500 mt-0.5 shrink-0">&#8226;</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ATSScorePanel({ resumeId, existingScore, existingFeedback }) {
  const [isChecking, setIsChecking] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(() => {
    if (existingFeedback) {
      try {
        return JSON.parse(existingFeedback);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [expandedCategory, setExpandedCategory] = useState(null);

  const handleCheck = async () => {
    if (!resumeId) {
      toast.error("Save your resume first");
      return;
    }

    setIsChecking(true);
    try {
      const atsResult = await checkResumeATS(resumeId, jobDescription);
      setResult(atsResult);
      toast.success(`ATS Score: ${Math.round(atsResult.overallScore)}%`);
    } catch (error) {
      toast.error(error.message || "ATS check failed");
    } finally {
      setIsChecking(false);
    }
  };

  if (!resumeId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">
          Save a resume first to run ATS analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Job Description Input */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase">
          Job Description (optional, for keyword matching)
        </label>
        <div className="flex gap-2">
          <Input
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here for keyword analysis..."
            className="text-sm"
          />
          <Button onClick={handleCheck} disabled={isChecking} size="sm" className="shrink-0 gap-1.5">
            {isChecking ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                Run ATS Check
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {/* Overall Score */}
          <div className="flex items-center gap-5 p-4 rounded-xl border bg-muted/20">
            <ScoreRing score={result.overallScore} />
            <div>
              <p className="text-sm font-semibold">Overall ATS Score</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {result.overallScore >= 80
                  ? "Excellent — your resume is ATS-ready."
                  : result.overallScore >= 60
                  ? "Good — minor improvements recommended."
                  : "Needs work — review the categories below."}
              </p>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="space-y-2">
            <CategoryCard
              icon={Search}
              label="Keyword Matching"
              score={result.categories?.keywordMatching?.score ?? 0}
              weight="40%"
              issues={[
                ...(result.categories?.keywordMatching?.missingKeywords?.length
                  ? [`Missing keywords: ${result.categories.keywordMatching.missingKeywords.slice(0, 8).join(", ")}`]
                  : []),
                ...(result.categories?.keywordMatching?.totalFound !== undefined
                  ? [`Matched ${result.categories.keywordMatching.totalFound} of ${result.categories.keywordMatching.totalRequired} keywords`]
                  : []),
              ]}
              expanded={expandedCategory === "keyword"}
              onToggle={() => setExpandedCategory(expandedCategory === "keyword" ? null : "keyword")}
            />
            <CategoryCard
              icon={FileWarning}
              label="Formatting & Parsing"
              score={result.categories?.formattingParsing?.score ?? 0}
              weight="20%"
              issues={result.categories?.formattingParsing?.issues || []}
              expanded={expandedCategory === "formatting"}
              onToggle={() => setExpandedCategory(expandedCategory === "formatting" ? null : "formatting")}
            />
            <CategoryCard
              icon={LayoutList}
              label="Readability & Structure"
              score={result.categories?.readabilityStructure?.score ?? 0}
              weight="20%"
              issues={result.categories?.readabilityStructure?.issues || []}
              expanded={expandedCategory === "readability"}
              onToggle={() => setExpandedCategory(expandedCategory === "readability" ? null : "readability")}
            />
            <CategoryCard
              icon={Type}
              label="Grammar & Spelling"
              score={result.categories?.grammarSpelling?.score ?? 0}
              weight="20%"
              issues={result.categories?.grammarSpelling?.errors || []}
              expanded={expandedCategory === "grammar"}
              onToggle={() => setExpandedCategory(expandedCategory === "grammar" ? null : "grammar")}
            />
          </div>

          {/* Recommendations */}
          {result.recommendations?.length > 0 && (
            <div className="p-3 rounded-lg border bg-muted/20">
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Recommendations</p>
              <ul className="space-y-1.5">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 shrink-0">&#8594;</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
