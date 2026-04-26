"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import { getPromptEvalRuns, runPromptEval } from "@/actions/prompt-eval-lab";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Loader2, Clock4 } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_VARIANTS = [
  "Write concise bullet points with concrete action verbs and measurable outcomes.",
  "Write a narrative style response with strategic framing and business impact language.",
  "Write a technical-first response with architecture terms and implementation detail.",
];

const HISTORY_ALL_KEY = "__all__";
const PROMPT_EVAL_HISTORY_CACHE = new Map();
const PROMPT_EVAL_HISTORY_PENDING = new Map();

function getHistoryKey(applicationId) {
  return applicationId || HISTORY_ALL_KEY;
}

async function loadPromptEvalHistoryCached(applicationId, force = false) {
  const key = getHistoryKey(applicationId);
  if (!force && PROMPT_EVAL_HISTORY_CACHE.has(key)) {
    return { success: true, history: PROMPT_EVAL_HISTORY_CACHE.get(key) || [] };
  }
  if (!force && PROMPT_EVAL_HISTORY_PENDING.has(key)) {
    return PROMPT_EVAL_HISTORY_PENDING.get(key);
  }

  const pending = getPromptEvalRuns(applicationId || null)
    .then((result) => {
      if (result?.success) {
        PROMPT_EVAL_HISTORY_CACHE.set(key, result.history || []);
      }
      return result;
    })
    .finally(() => {
      PROMPT_EVAL_HISTORY_PENDING.delete(key);
    });

  PROMPT_EVAL_HISTORY_PENDING.set(key, pending);
  return pending;
}

function pushPromptEvalHistoryCache(applicationId, run) {
  const scopedKey = getHistoryKey(applicationId);
  const scoped = PROMPT_EVAL_HISTORY_CACHE.get(scopedKey) || [];
  PROMPT_EVAL_HISTORY_CACHE.set(scopedKey, [run, ...scoped.filter((item) => item.id !== run.id)]);

  const all = PROMPT_EVAL_HISTORY_CACHE.get(HISTORY_ALL_KEY) || [];
  PROMPT_EVAL_HISTORY_CACHE.set(HISTORY_ALL_KEY, [run, ...all.filter((item) => item.id !== run.id)]);
}

function PromptEvalLabContent() {
  const { applications, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("__general__");
  const [task, setTask] = useState("");
  const [variants, setVariants] = useState(DEFAULT_VARIANTS);
  const [isRunning, setIsRunning] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const runLockRef = useRef(false);

  const selectedJobLabel = useMemo(() => {
    const app = applications.find((item) => item.id === selectedJobId);
    return app ? `${app.job.company} - ${app.job.title}` : "General";
  }, [applications, selectedJobId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setHistoryLoading(true);
      try {
        const result = await loadPromptEvalHistoryCached(
          selectedJobId === "__general__" ? null : selectedJobId
        );
        if (!mounted) return;
        if (!result.success) {
          toast.error(result.error || "Failed to load eval history.");
          return;
        }
        setHistory(result.history || []);
        setActiveRun((current) => {
          if (current && (result.history || []).some((item) => item.id === current.id)) return current;
          return (result.history || [])[0] || null;
        });
      } catch {
        if (mounted) toast.error("Failed to load eval history.");
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [selectedJobId]);

  const handleVariantChange = (index, value) => {
    setVariants((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const handleRun = async () => {
    if (runLockRef.current || isRunning) return;
    if (!task.trim()) {
      toast.error("Task is required.");
      return;
    }

    runLockRef.current = true;
    setIsRunning(true);
    try {
      const result = await runPromptEval(
        selectedJobId === "__general__" ? null : selectedJobId,
        task,
        variants
      );
      if (!result.success) {
        toast.error(result.error || "Prompt evaluation failed.");
        return;
      }
      const next = result.run;
      setActiveRun(next);
      setHistory((prev) => [next, ...prev.filter((item) => item.id !== next.id)]);
      pushPromptEvalHistoryCache(selectedJobId === "__general__" ? null : selectedJobId, next);
      toast.success("Prompt eval completed.");
    } catch {
      toast.error("Prompt evaluation failed.");
    } finally {
      runLockRef.current = false;
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="rounded-sm border border-border/70 bg-muted/30 p-3">
          <FlaskConical className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Prompt Eval Lab</h1>
          <p className="text-muted-foreground">
            A/B test prompt styles and auto-score output quality before using them in production.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Setup</CardTitle>
              <CardDescription>Task + prompt variants.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Job (optional)</label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={jobsLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={jobsLoading ? "Loading jobs..." : "General mode"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__general__">General mode</SelectItem>
                    {applications.map((app) => (
                      <SelectItem key={app.id} value={app.id}>
                        {app.job.company} - {app.job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Task</label>
                <Textarea
                  rows={4}
                  value={task}
                  onChange={(event) => setTask(event.target.value)}
                  placeholder="Example: Draft a recruiter outreach paragraph for a frontend-heavy fintech role."
                />
              </div>

              {variants.map((variant, index) => (
                <div key={`variant-${index}`} className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Variant {index + 1}
                  </label>
                  <Textarea
                    rows={3}
                    value={variant}
                    onChange={(event) => handleVariantChange(index, event.target.value)}
                  />
                </div>
              ))}

              <Button type="button" className="w-full gap-2" onClick={handleRun} disabled={isRunning}>
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                {isRunning ? "Evaluating..." : "Run Evaluation"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Run History</CardTitle>
              <CardDescription>Recent prompt eval runs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {historyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading history...
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No eval runs yet.</p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    className={`w-full rounded-sm border px-3 py-2 text-left ${
                      activeRun?.id === item.id ? "border-primary/60 bg-primary/10" : "hover:border-border"
                    }`}
                    onClick={() => setActiveRun(item)}
                  >
                    <p className="line-clamp-2 text-sm font-medium">{item.task}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock4 className="h-3 w-3" />
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-7">
          {activeRun ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Eval Summary</CardTitle>
                  <CardDescription>{selectedJobLabel}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="rounded-sm border border-border/70 bg-muted/20 p-3 text-sm">{activeRun.task}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Winner: Variant {(activeRun.winnerIndex ?? 0) + 1}</Badge>
                    <Badge variant="secondary">{(activeRun.scores || []).length} scored variants</Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {(activeRun.variants || []).map((variant, index) => {
                  const scoreItem = (activeRun.scores || []).find((item) => Number(item.index) === index);
                  const isWinner = index === Number(activeRun.winnerIndex);
                  return (
                    <Card key={`eval-${activeRun.id}-${index}`} className={isWinner ? "border-primary/60" : ""}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">Variant {index + 1}</CardTitle>
                          <div className="flex items-center gap-2">
                            {isWinner ? <Badge>Winner</Badge> : null}
                            <Badge variant="outline">Score: {scoreItem?.score ?? "-"}/10</Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <pre className="whitespace-pre-wrap rounded-sm border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                          {variant}
                        </pre>
                        <pre className="whitespace-pre-wrap rounded-sm border border-border/70 bg-background p-3 text-sm">
                          {(activeRun.outputs || [])[index] || "No output"}
                        </pre>
                        {scoreItem?.rationale ? (
                          <p className="text-xs text-muted-foreground">Rationale: {scoreItem.rationale}</p>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : (
            <Card className="flex min-h-[380px] items-center justify-center border-dashed">
              <div className="p-6 text-center text-muted-foreground">
                <FlaskConical className="mx-auto mb-4 h-12 w-12 opacity-20" />
                <p>Run prompt evaluation to compare variants with scoring.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PromptEvalLabPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <PromptEvalLabContent />
    </Suspense>
  );
}
