"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import { generateNegotiationScript, getOfferCopilotHistory } from "@/actions/offer-copilot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Scale, Target, Copy, ArrowRight, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

function formatMoney(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function GapBar({ label, current, target }) {
  const max = Math.max(current || 0, target || 0, 1);
  const currentPct = Math.max(0, Math.min(100, Math.round(((current || 0) / max) * 100)));
  const targetPct = Math.max(0, Math.min(100, Math.round(((target || 0) / max) * 100)));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>
          {formatMoney(current)} <ArrowRight className="mx-1 inline h-3 w-3" /> {formatMoney(target)}
        </span>
      </div>
      <div className="space-y-1">
        <div className="h-1.5 w-full bg-muted">
          <div className="h-full bg-foreground/55" style={{ width: `${currentPct}%` }} />
        </div>
        <div className="h-1.5 w-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${targetPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function OfferCopilotContent() {
  const { applications, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [offerDetails, setOfferDetails] = useState({
    currentBase: "",
    currentBonus: "",
    currentEquity: "",
    targetBase: "",
    targetBonus: "",
    targetEquity: "",
    leveragePoints: "",
  });
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

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const result = await getOfferCopilotHistory(selectedJobId || null);
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
      const result = await generateNegotiationScript(selectedJobId, offerDetails);
      if (result.success) {
        const next =
          result.historyItem || {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            createdAt: new Date().toISOString(),
            jobLabel: selectedJobLabel,
            playbook: result.playbook,
            compensation: result.compensation,
            negotiationScriptMarkdown: result.negotiationScriptMarkdown,
          };
        setAnalysisResult(next);
        setHistory((prev) => [next, ...prev.filter((item) => item.id !== next.id)].slice(0, 50));
        toast.success("Negotiation playbook generated.");
      } else {
        toast.error(result.error || "Failed to generate script.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const playbook = analysisResult?.playbook;
  const compensation = analysisResult?.compensation;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="rounded-sm border border-border/70 bg-muted/30 p-3">
          <Scale className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Offer Negotiation Copilot</h1>
          <p className="text-muted-foreground">
            Structured playbook with compensation delta visuals, scripts, and fallback plan.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Offer Details</CardTitle>
              <CardDescription>Input current package and your target package.</CardDescription>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Current Base ($)</label>
                  <Input
                    placeholder="120000"
                    type="number"
                    value={offerDetails.currentBase}
                    onChange={(e) => setOfferDetails((prev) => ({ ...prev, currentBase: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">Target Base ($)</label>
                  <Input
                    placeholder="140000"
                    type="number"
                    value={offerDetails.targetBase}
                    onChange={(e) => setOfferDetails((prev) => ({ ...prev, targetBase: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Current Equity ($)</label>
                  <Input
                    placeholder="50000"
                    type="number"
                    value={offerDetails.currentEquity}
                    onChange={(e) => setOfferDetails((prev) => ({ ...prev, currentEquity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">Target Equity ($)</label>
                  <Input
                    placeholder="70000"
                    type="number"
                    value={offerDetails.targetEquity}
                    onChange={(e) => setOfferDetails((prev) => ({ ...prev, targetEquity: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Current Bonus ($)</label>
                  <Input
                    placeholder="10000"
                    type="number"
                    value={offerDetails.currentBonus}
                    onChange={(e) => setOfferDetails((prev) => ({ ...prev, currentBonus: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-primary">Target Bonus ($)</label>
                  <Input
                    placeholder="20000"
                    type="number"
                    value={offerDetails.targetBonus}
                    onChange={(e) => setOfferDetails((prev) => ({ ...prev, targetBonus: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Leverage points</label>
                <Textarea
                  placeholder="Competing offers, domain depth, measurable impact, unique skills..."
                  value={offerDetails.leveragePoints}
                  onChange={(e) => setOfferDetails((prev) => ({ ...prev, leveragePoints: e.target.value }))}
                />
              </div>

              <Button className="w-full gap-2" onClick={handleAnalyze} disabled={isAnalyzing || jobsLoading}>
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                {isAnalyzing ? "Building playbook..." : "Generate Playbook"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Run History</CardTitle>
              <CardDescription>Recent negotiation playbooks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {historyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading history...
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history yet.</p>
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
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7">
          {analysisResult && playbook && compensation ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">Negotiation Playbook</CardTitle>
                      <CardDescription>{analysisResult.jobLabel}</CardDescription>
                    </div>
                    <Badge variant="outline">
                      Total delta: ${formatMoney(compensation.delta.total)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="rounded-sm border border-border/70 bg-muted/20 p-3 text-sm leading-relaxed">
                    {playbook.summary}
                  </p>

                  <div className="space-y-3 rounded-sm border border-border/70 p-3">
                    <h3 className="text-sm font-semibold">Compensation Gap Diagram</h3>
                    <GapBar label="Base" current={compensation.current.base} target={compensation.target.base} />
                    <GapBar label="Bonus" current={compensation.current.bonus} target={compensation.target.bonus} />
                    <GapBar label="Equity" current={compensation.current.equity} target={compensation.target.equity} />
                    <GapBar label="Total" current={compensation.current.total} target={compensation.target.total} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-sm border border-border/70 p-3">
                      <h3 className="text-sm font-semibold">Priority Asks</h3>
                      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                        {playbook.priorityAsks.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <CircleCheck className="mt-0.5 h-3.5 w-3.5 text-primary" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-sm border border-border/70 p-3">
                      <h3 className="text-sm font-semibold">Fallback Asks</h3>
                      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                        {playbook.fallbackAsks.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <CircleCheck className="mt-0.5 h-3.5 w-3.5 text-primary" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-lg">Email Script</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        copyText(
                          `Subject: ${playbook.emailDraft.subject}\n\n${playbook.emailDraft.body}`,
                          "Email draft"
                        )
                      }
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className="font-medium">Subject:</span> {playbook.emailDraft.subject}
                  </p>
                  <pre className="whitespace-pre-wrap rounded-sm border border-border/70 bg-background p-3 font-ui text-sm leading-relaxed">
                    {playbook.emailDraft.body}
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Call Strategy</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-sm border border-border/70 p-3">
                    <h3 className="text-sm font-semibold">Phone Script Steps</h3>
                    <ol className="mt-2 space-y-1.5 pl-4 text-sm text-muted-foreground">
                      {playbook.phoneScriptSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <div className="rounded-sm border border-border/70 p-3">
                    <h3 className="text-sm font-semibold">Risk Matrix</h3>
                    <div className="mt-2 space-y-2">
                      {playbook.riskMatrix.map((risk) => (
                        <div key={risk.risk} className="rounded-sm border border-border/60 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{risk.risk}</p>
                            <Badge variant="outline">{risk.probability}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{risk.mitigation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Execution Guardrails</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-sm border border-border/70 p-3">
                    <h3 className="text-sm font-semibold">Do Not Say</h3>
                    <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      {playbook.doNotSay.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-sm border border-border/70 p-3">
                    <h3 className="text-sm font-semibold">Close Plan</h3>
                    <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      {playbook.closePlan.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="flex min-h-[420px] items-center justify-center border-dashed">
              <div className="p-6 text-center text-muted-foreground">
                <Scale className="mx-auto mb-4 h-12 w-12 opacity-20" />
                <p>Generate a structured negotiation playbook with visuals and scripts.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OfferCopilotPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <OfferCopilotContent />
    </Suspense>
  );
}
