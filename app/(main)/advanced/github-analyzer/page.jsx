"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import { analyzeGithubGap, getGithubAnalysisHistory } from "@/actions/github-analyzer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Github, LayoutTemplate, AlertCircle, Lightbulb, History, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Suspense } from "react";

// Mermaid renderer component
function MermaidBlock({ code }) {
  const ref = useRef(null);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        console.warn("Mermaid render failed:", err);
        if (!cancelled) setSvg(`<pre class="text-red-400 text-xs">${err.message}</pre>`);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div
      ref={ref}
      className="my-4 flex justify-center overflow-x-auto rounded-lg bg-background/50 border p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// Custom code renderer that intercepts mermaid blocks
function CodeBlock({ className, children, ...props }) {
  const match = /language-(\w+)/.exec(className || "");
  const lang = match?.[1];
  const code = String(children).replace(/\n$/, "");

  if (lang === "mermaid") {
    return <MermaidBlock code={code} />;
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

// Rich markdown renderer
function RichMarkdown({ children }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted/50 prose-pre:border prose-table:border-collapse prose-th:border prose-th:px-3 prose-th:py-2 prose-th:bg-muted/50 prose-td:border prose-td:px-3 prose-td:py-2 prose-img:rounded-lg [&_input[type=checkbox]]:mr-2 [&_input[type=checkbox]]:accent-primary">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlock,
          // Render task list items with proper styling
          li: ({ children, className, ...props }) => {
            if (className === "task-list-item") {
              return (
                <li className="list-none flex items-start gap-2" {...props}>
                  {children}
                </li>
              );
            }
            return <li {...props}>{children}</li>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

// Analysis result display
function AnalysisDisplay({ data }) {
  const analysis = data.analysis || data; // handle both new and old format

  return (
    <div className="space-y-6">
      {/* Skill Gaps */}
      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Identified Skill Gaps
          </CardTitle>
          <CardDescription>
            Skills required by the job that your repository does not demonstrate:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(analysis.missingSkills?.length > 0) ? (
              analysis.missingSkills.map((skill, index) => (
                <Badge key={index} variant="destructive" className="px-3 py-1 text-sm">
                  {skill}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="px-3 py-1 bg-green-500/10 text-green-600 border-green-500/20">
                No major gaps identified!
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resume Recommendation */}
      {analysis.resumeRecommendation && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <Lightbulb className="h-5 w-5" />
              Should You Put This on Your Resume?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{analysis.resumeRecommendation}</p>
          </CardContent>
        </Card>
      )}

      {/* Weekend Refactor Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">🛠️ Weekend Refactor Plan</CardTitle>
          <CardDescription>Implement this specific refactor to bridge your skill gap before the interview.</CardDescription>
        </CardHeader>
        <CardContent>
          <RichMarkdown>{analysis.projectPlanMarkdown}</RichMarkdown>
        </CardContent>
      </Card>
    </div>
  );
}

// History item card
function HistoryCard({ item, onSelect }) {
  const date = new Date(item.createdAt);
  return (
    <Card
      className="cursor-pointer hover:border-primary/40 transition-all hover:shadow-md"
      onClick={() => onSelect(item)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Github className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium truncate">{item.repoUrl}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {item.missingSkills?.slice(0, 4).map((skill, i) => (
                <Badge key={i} variant="outline" className="text-xs px-1.5 py-0">
                  {skill}
                </Badge>
              ))}
              {item.missingSkills?.length > 4 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0">
                  +{item.missingSkills.length - 4}
                </Badge>
              )}
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function GithubAnalyzerContent() {
  const { applications, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [activeTab, setActiveTab] = useState("new"); // "new" | "history"

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // Load history when job changes or tab switches
  const loadHistory = useCallback(async () => {
    if (!selectedJobId) return;
    setHistoryLoading(true);
    try {
      const result = await getGithubAnalysisHistory(selectedJobId);
      if (result.success) {
        setHistoryItems(result.history || []);
      }
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedJobId]);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const handleAnalyze = async () => {
    if (!selectedJobId) {
      toast.error("Please select a job from your pipeline.");
      return;
    }
    if (!repoUrl.trim()) {
      toast.error("Please enter a GitHub repository URL.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setSelectedHistoryItem(null);
    setActiveTab("new");

    try {
      const result = await analyzeGithubGap(repoUrl.trim(), selectedJobId);
      if (result.success) {
        setAnalysisResult(result);
        toast.success("Analysis complete and saved to history!");
      } else {
        toast.error(result.error || "Failed to analyze GitHub profile.");
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Github className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">GitHub Gap Analyzer</h1>
          <p className="text-muted-foreground">Compare a specific public repo against job requirements and generate a weekend refactor plan.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Input Column */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Setup</CardTitle>
              <CardDescription>Select a target job and paste the GitHub repository URL.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Job Role</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={jobsLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={jobsLoading ? "Loading jobs..." : "Select a job from your pipeline"} />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.length === 0 && !jobsLoading ? (
                      <SelectItem value="none" disabled>No jobs found. Hunt first!</SelectItem>
                    ) : (
                      applications.map((app) => (
                        <SelectItem key={app.id} value={app.id}>
                          {app.job.title} at {app.job.company}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Repository URL</label>
                <Input
                  placeholder="e.g. https://github.com/facebook/react"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                />
                <p className="text-xs text-muted-foreground">Must be a public repository.</p>
              </div>

              <Button
                className="w-full mt-2 gap-2"
                onClick={handleAnalyze}
                disabled={isAnalyzing || jobsLoading}
              >
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutTemplate className="h-4 w-4" />}
                {isAnalyzing ? "Analyzing..." : "Generate Gap Analysis"}
              </Button>
            </CardContent>
          </Card>

          {/* Tabs for switching */}
          {selectedJobId && (
            <Card>
              <CardContent className="p-3">
                <div className="flex gap-1">
                  <Button
                    variant={activeTab === "new" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => { setActiveTab("new"); setSelectedHistoryItem(null); }}
                  >
                    <LayoutTemplate className="h-4 w-4" />
                    Latest Result
                  </Button>
                  <Button
                    variant={activeTab === "history" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => setActiveTab("history")}
                  >
                    <History className="h-4 w-4" />
                    History
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* History List */}
          {activeTab === "history" && (
            <div className="space-y-3">
              {historyLoading ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : historyItems.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    No past analyses for this job yet.
                  </CardContent>
                </Card>
              ) : (
                historyItems.map((item) => (
                  <HistoryCard
                    key={item.id}
                    item={item}
                    onSelect={(sel) => {
                      setSelectedHistoryItem(sel);
                      setAnalysisResult(null);
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Results Column */}
        <div className="lg:col-span-8">
          {/* Show selected history item */}
          {selectedHistoryItem ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="sm" onClick={() => setSelectedHistoryItem(null)}>
                  ← Back
                </Button>
                <span className="text-xs text-muted-foreground">
                  Analyzed on {new Date(selectedHistoryItem.createdAt).toLocaleString()}
                </span>
              </div>
              <AnalysisDisplay data={selectedHistoryItem} />
            </div>
          ) : analysisResult ? (
            <AnalysisDisplay data={analysisResult} />
          ) : (
            <Card className="h-full min-h-[400px] flex items-center justify-center border-dashed">
              <div className="text-center text-muted-foreground p-6">
                <Github className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Run an analysis to see your skill gaps and a custom project plan.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GithubAnalyzerPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <GithubAnalyzerContent />
    </Suspense>
  );
}
