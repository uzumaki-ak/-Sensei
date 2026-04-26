"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import { generateCompanyIntel, getCompanyIntelHistory } from "@/actions/company-intel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Building2,
  Newspaper,
  ExternalLink,
  Copy,
  Clock4,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

function riskTone(label) {
  const normalized = String(label || "").toUpperCase();
  if (normalized === "RED") {
    return {
      className: "bg-red-600 text-white border-red-600",
      icon: ShieldAlert,
    };
  }
  if (normalized === "YELLOW") {
    return {
      className: "bg-amber-500 text-black border-amber-500",
      icon: AlertTriangle,
    };
  }
  return {
    className: "bg-emerald-600 text-white border-emerald-600",
    icon: ShieldCheck,
  };
}

function SourcePills({ evidenceIds }) {
  if (!Array.isArray(evidenceIds) || evidenceIds.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No explicit evidence IDs.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {evidenceIds.map((id) => (
        <Badge key={id} variant="outline">
          {id}
        </Badge>
      ))}
    </div>
  );
}

function CompanyIntelContent() {
  const { applications, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [manualLinksText, setManualLinksText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const selectedJobLabel = useMemo(() => {
    const app = applications.find((item) => item.id === selectedJobId);
    return app ? `${app.job.company} - ${app.job.title}` : "Selected role";
  }, [applications, selectedJobId]);

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(String(value || ""));
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Could not copy text.");
    }
  };

  const parseManualLinks = () =>
    String(manualLinksText || "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const result = await getCompanyIntelHistory(selectedJobId || null);
        if (!mounted) return;
        if (result.success) {
          const items = result.history || [];
          setHistory(items);
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
      const result = await generateCompanyIntel(selectedJobId, {
        links: parseManualLinks(),
      });
      if (result.success) {
        const next =
          result.historyItem || {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: new Date().toISOString(),
            jobLabel: selectedJobLabel,
            intel: result.intel,
            talkingPointsMarkdown: result.talkingPointsMarkdown,
            recentNews: result.recentNews,
            manualLinks: result.manualLinks,
          };
        setAnalysisResult(next);
        setHistory((prev) => [next, ...prev.filter((item) => item.id !== next.id)].slice(0, 50));
        toast.success("Company intel generated.");
      } else {
        toast.error(result.error || "Failed to gather company intel.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const intel = analysisResult?.intel || null;
  const riskStyle = riskTone(intel?.riskSummary?.overallLabel || "YELLOW");
  const RiskIcon = riskStyle.icon;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="rounded-sm border border-border/70 bg-muted/30 p-3">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Company Intel Scraper</h1>
          <p className="text-muted-foreground">
            Add official links to disambiguate same-name companies and generate source-cited OSINT-lite intel.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Target Company</CardTitle>
              <CardDescription>Choose job + optional manual links.</CardDescription>
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Manual Reference Links (optional)</label>
                <Textarea
                  rows={4}
                  placeholder={`One URL per line\nhttps://company.com\nhttps://www.linkedin.com/company/...`}
                  value={manualLinksText}
                  onChange={(event) => setManualLinksText(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Add official site, company LinkedIn, funding/press pages to avoid wrong-entity matching.
                </p>
              </div>

              <Button className="w-full gap-2" onClick={handleAnalyze} disabled={isAnalyzing || jobsLoading}>
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4" />}
                {isAnalyzing ? "Gathering Intel..." : "Gather Company Intel"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Run History</CardTitle>
              <CardDescription>Recent company intel runs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {historyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading history...
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No intel runs yet.</p>
              ) : (
                history.map((entry) => (
                  <button
                    key={entry.id}
                    className={`w-full rounded-sm border px-3 py-2 text-left ${
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

        <div className="min-w-0 lg:col-span-8">
          {intel ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">Entity Match & Risk Snapshot</CardTitle>
                      <CardDescription>{analysisResult.jobLabel}</CardDescription>
                    </div>
                    <Badge className={`${riskStyle.className} gap-1.5`}>
                      <RiskIcon className="h-3.5 w-3.5" />
                      {intel.riskSummary.overallLabel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="rounded-sm border border-border/70 bg-muted/20 p-3">
                    <p className="font-medium">
                      Matched entity: {intel.entityMatch.matchedCompany}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Confidence: <span className="font-semibold">{intel.entityMatch.confidence.toUpperCase()}</span>
                    </p>
                    <p className="mt-2 text-muted-foreground">{intel.entityMatch.reasoning}</p>
                    {intel.entityMatch.ambiguityWarning ? (
                      <p className="mt-2 text-amber-300">{intel.entityMatch.ambiguityWarning}</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-sm border border-emerald-600/40 bg-emerald-600/10 p-2">
                      Green: {intel.riskSummary.greenCount}
                    </div>
                    <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 p-2">
                      Yellow: {intel.riskSummary.yellowCount}
                    </div>
                    <div className="rounded-sm border border-red-600/40 bg-red-600/10 p-2">
                      Red: {intel.riskSummary.redCount}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{intel.riskSummary.note}</p>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Business Context</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{intel.bento.businessContext.summary}</p>
                    <SourcePills evidenceIds={intel.bento.businessContext.evidenceIds} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Leadership & Governance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{intel.bento.leadershipAndGovernance.summary}</p>
                    <SourcePills evidenceIds={intel.bento.leadershipAndGovernance.evidenceIds} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Hiring & People Signals</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{intel.bento.hiringAndPeopleSignals.summary}</p>
                    <SourcePills evidenceIds={intel.bento.hiringAndPeopleSignals.evidenceIds} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Interview Angles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {intel.bento.interviewAngles.map((item) => (
                      <p key={item}>- {item}</p>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Risk Alerts</CardTitle>
                  <CardDescription>OSINT-lite findings with evidence IDs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {intel.bento.riskAlerts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No explicit risk alerts from current sources.</p>
                  ) : (
                    intel.bento.riskAlerts.map((alert, index) => {
                      const tone = riskTone(alert.label);
                      return (
                        <div key={`${alert.topic}-${index}`} className="rounded-sm border border-border/70 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{alert.topic}</p>
                            <Badge className={tone.className}>{alert.label}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{alert.finding}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <SourcePills evidenceIds={alert.evidenceIds} />
                            <span className="text-[11px] text-muted-foreground">
                              Confidence: {String(alert.confidence || "").toUpperCase()}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Ask-Back Questions</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => copyText(intel.bento.askBackQuestions.join("\n"), "Questions")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {intel.bento.askBackQuestions.map((item) => (
                    <p key={item}>- {item}</p>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Source References</CardTitle>
                  <CardDescription>Verify every claim from these links.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {intel.sourceRefs.map((source) => (
                    <div key={source.id} className="min-w-0 rounded-sm border border-border/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <Badge variant="outline">{source.id}</Badge>
                          <p className="min-w-0 break-words text-sm font-medium">{source.title}</p>
                        </div>
                        <Badge variant="outline">{source.type}</Badge>
                      </div>
                      {source.meta ? (
                        <p className="mt-1 break-words text-xs text-muted-foreground">{source.meta}</p>
                      ) : null}
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block max-w-full break-all text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        <span>{source.url}</span>
                        <ExternalLink className="ml-1 inline h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="flex min-h-[420px] items-center justify-center border-dashed">
              <div className="p-6 text-center text-muted-foreground">
                <Building2 className="mx-auto mb-4 h-12 w-12 opacity-20" />
                <p>Add company links and run intel to generate source-cited bento insights.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CompanyIntelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CompanyIntelContent />
    </Suspense>
  );
}
