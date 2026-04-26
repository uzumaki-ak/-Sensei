"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import { generateDripSequence, getDripCampaignHistory } from "@/actions/drip-campaigns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, Send, Copy, Clock4 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";

function splitSequenceIntoEmails(sequenceMarkdown = "") {
  const source = String(sequenceMarkdown || "").trim();
  if (!source) return [];

  const sectionRegex = /(^|\n)###\s*(Email\s*\d+[^#\n]*)/gi;
  const matches = [...source.matchAll(sectionRegex)];
  if (!matches.length) {
    return [
      {
        key: "sequence-1",
        title: "Email Sequence",
        content: source,
      },
    ];
  }

  const sections = [];
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index + (matches[index][1]?.length || 0);
    const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const title = matches[index][2].trim();
    const content = source.slice(start, end).trim();
    sections.push({
      key: `${title}-${index}`,
      title,
      content,
    });
  }
  return sections;
}

function DripCampaignsContent() {
  const { applications, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [sequenceHistory, setSequenceHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const activeEmails = useMemo(
    () => splitSequenceIntoEmails(analysisResult?.sequenceMarkdown || ""),
    [analysisResult]
  );

  const selectedJobLabel = useMemo(() => {
    const app = applications.find((item) => item.id === selectedJobId);
    if (!app) return "Selected role";
    return `${app.job.company} - ${app.job.title}`;
  }, [applications, selectedJobId]);

  const copyText = async (value, label = "Content") => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Could not copy text.");
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const result = await getDripCampaignHistory(selectedJobId || null);
        if (!mounted) return;
        if (result.success) {
          const items = result.history || [];
          setSequenceHistory(items);
          setAnalysisResult((current) => {
            if (current && items.some((item) => item.id === current.id)) {
              return current;
            }
            return items[0] || null;
          });
        } else {
          toast.error(result.error || "Failed to load history.");
        }
      } catch {
        if (mounted) {
          toast.error("Failed to load history.");
        }
      } finally {
        if (mounted) {
          setHistoryLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      mounted = false;
    };
  }, [selectedJobId]);

  const handleAnalyze = async () => {
    if (!selectedJobId) {
      toast.error("Please select a job from your pipeline.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const result = await generateDripSequence(selectedJobId);
      if (result.success) {
        const next =
          result.historyItem || {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: new Date().toISOString(),
            jobLabel: selectedJobLabel,
            sequenceMarkdown: result.sequenceMarkdown,
          };
        setAnalysisResult(next);
        setSequenceHistory((prev) => [next, ...prev.filter((item) => item.id !== next.id)].slice(0, 50));
        toast.success("Drip campaign generated.");
      } else {
        toast.error(result.error || "Failed to generate sequence.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="rounded-sm border border-border/70 bg-muted/30 p-3">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Cold Email Drip Campaigns</h1>
          <p className="text-muted-foreground">
            Generate structured 3-step outreach flows and copy each message instantly.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Setup</CardTitle>
              <CardDescription>Select the role to target.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Job Role</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={jobsLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={jobsLoading ? "Loading jobs..." : "Select a job"} />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.length === 0 && !jobsLoading ? (
                      <SelectItem value="none" disabled>
                        No jobs found. Hunt first.
                      </SelectItem>
                    ) : (
                      applications.map((app) => (
                        <SelectItem key={app.id} value={app.id}>
                          {app.job.company} - {app.job.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full gap-2" onClick={handleAnalyze} disabled={isAnalyzing || jobsLoading}>
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isAnalyzing ? "Drafting..." : "Generate Drip Sequence"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Run History</CardTitle>
              <CardDescription>Recent generated sequences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {historyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading history...
                </div>
              ) : sequenceHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No generated sequences yet.</p>
              ) : (
                sequenceHistory.map((entry) => (
                  <button
                    key={entry.id}
                    className={`w-full rounded-sm border px-3 py-2 text-left transition-colors ${
                      analysisResult?.id === entry.id ? "border-primary/60 bg-primary/10" : "hover:border-border"
                    }`}
                    onClick={() => setAnalysisResult(entry)}
                  >
                    <p className="line-clamp-1 text-sm font-medium">{entry.jobLabel}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock4 className="h-3 w-3" />
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          {analysisResult ? (
            <Card className="h-full">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Your 3-Part Sequence</CardTitle>
                    <CardDescription>{analysisResult.jobLabel}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{activeEmails.length} emails generated</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => copyText(analysisResult.sequenceMarkdown, "Full sequence")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeEmails.map((email) => (
                  <div key={email.key} className="rounded-sm border border-border/70 bg-background p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold">{email.title}</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => copyText(email.content, email.title)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{email.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="flex min-h-[420px] items-center justify-center border-dashed">
              <div className="p-6 text-center text-muted-foreground">
                <Mail className="mx-auto mb-4 h-12 w-12 opacity-20" />
                <p>Select a job and generate an outreach sequence.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DripCampaignsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <DripCampaignsContent />
    </Suspense>
  );
}
