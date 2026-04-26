"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useJobsData } from "@/hooks/use-jobs-data";
import { getMultiAgentRuns, runMultiAgentStudio } from "@/actions/multi-agent-studio";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Workflow, Clock4 } from "lucide-react";
import { toast } from "sonner";

const HISTORY_ALL_KEY = "__all__";
const MULTI_AGENT_HISTORY_CACHE = new Map();
const MULTI_AGENT_HISTORY_PENDING = new Map();

function getHistoryKey(applicationId) {
  return applicationId || HISTORY_ALL_KEY;
}

async function loadRunsCached(applicationId, force = false) {
  const key = getHistoryKey(applicationId);
  if (!force && MULTI_AGENT_HISTORY_CACHE.has(key)) {
    return { success: true, history: MULTI_AGENT_HISTORY_CACHE.get(key) || [] };
  }
  if (!force && MULTI_AGENT_HISTORY_PENDING.has(key)) {
    return MULTI_AGENT_HISTORY_PENDING.get(key);
  }

  const pending = getMultiAgentRuns(applicationId || null)
    .then((result) => {
      if (result?.success) {
        MULTI_AGENT_HISTORY_CACHE.set(key, result.history || []);
      }
      return result;
    })
    .finally(() => {
      MULTI_AGENT_HISTORY_PENDING.delete(key);
    });

  MULTI_AGENT_HISTORY_PENDING.set(key, pending);
  return pending;
}

function pushRunCache(applicationId, run) {
  const scopedKey = getHistoryKey(applicationId);
  const scoped = MULTI_AGENT_HISTORY_CACHE.get(scopedKey) || [];
  MULTI_AGENT_HISTORY_CACHE.set(scopedKey, [run, ...scoped.filter((item) => item.id !== run.id)]);

  const all = MULTI_AGENT_HISTORY_CACHE.get(HISTORY_ALL_KEY) || [];
  MULTI_AGENT_HISTORY_CACHE.set(HISTORY_ALL_KEY, [run, ...all.filter((item) => item.id !== run.id)]);
}

function MarkdownPanel({ content, className = "text-sm" }) {
  return (
    <div className={`rounded-sm border border-border/70 bg-muted/20 p-3 ${className}`}>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "No content"}</ReactMarkdown>
      </div>
    </div>
  );
}

function MultiAgentStudioContent() {
  const { applications, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [goal, setGoal] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const runLockRef = useRef(false);

  const selectedJobLabel = useMemo(() => {
    const app = applications.find((item) => item.id === selectedJobId);
    return app ? `${app.job.company} - ${app.job.title}` : "Selected role";
  }, [applications, selectedJobId]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      setHistoryLoading(true);
      try {
        const result = await loadRunsCached(selectedJobId || null, false);
        if (!mounted) return;
        if (!result.success) {
          toast.error(result.error || "Failed to load multi-agent history.");
          return;
        }
        setHistory(result.history || []);
        setActiveRun((current) => {
          if (current && (result.history || []).some((item) => item.id === current.id)) return current;
          return (result.history || [])[0] || null;
        });
      } catch {
        if (mounted) toast.error("Failed to load multi-agent history.");
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [selectedJobId]);

  useEffect(() => {
    if (!isRunning) {
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning]);

  const handleRun = async () => {
    if (runLockRef.current || isRunning) return;
    if (!selectedJobId) {
      toast.error("Select a job first.");
      return;
    }

    const cleanGoal = goal.trim();
    if (!cleanGoal) {
      toast.error("Add a goal first.");
      return;
    }

    runLockRef.current = true;
    setIsRunning(true);
    toast.loading("Running agents. Usually 30-90 seconds; can take longer if fallback providers are used.", {
      id: "multi-agent-running",
    });

    try {
      const result = await runMultiAgentStudio(selectedJobId, cleanGoal);
      if (!result.success) {
        toast.error(result.error || "Failed to run multi-agent studio.", { id: "multi-agent-running" });
        return;
      }

      const nextRun = result.run;
      setGoal("");
      setActiveRun(nextRun);
      setHistory((prev) => [nextRun, ...prev.filter((item) => item.id !== nextRun.id)]);
      pushRunCache(selectedJobId, nextRun);

      const durationSec = Number.isFinite(nextRun?.elapsedMs)
        ? Math.max(1, Math.round(nextRun.elapsedMs / 1000))
        : elapsedSeconds;
      toast.success(`Multi-agent run complete in ~${durationSec}s.`, { id: "multi-agent-running" });
    } catch {
      toast.error("Failed to run multi-agent studio.", { id: "multi-agent-running" });
    } finally {
      runLockRef.current = false;
      setIsRunning(false);
    }
  };

  const runDisabled = !selectedJobId || !goal.trim() || isRunning || jobsLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="rounded-sm border border-border/70 bg-muted/30 p-3">
          <Workflow className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Multi-Agent Studio</h1>
          <p className="text-muted-foreground">
            Researcher + Planner + Reviewer orchestration for role-specific interview prep.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Run Setup</CardTitle>
              <CardDescription>Define your target and prep objective.</CardDescription>
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
                <label className="text-sm font-medium">Goal</label>
                <Textarea
                  rows={6}
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault();
                      handleRun();
                    }
                  }}
                  placeholder="Example: Build a 3-day prep plan focused on frontend architecture stories and likely system design follow-ups."
                />
                <p className="text-xs text-muted-foreground">Tip: press Ctrl+Enter to run.</p>
              </div>

              <Button type="button" className="w-full gap-2" onClick={handleRun} disabled={runDisabled}>
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Workflow className="h-4 w-4" />}
                {isRunning ? `Running agents... ${elapsedSeconds}s` : "Run Multi-Agent"}
              </Button>
              {isRunning ? (
                <p className="text-xs text-muted-foreground">
                  Run is in progress. Keep this tab open; you will get a toast when it finishes.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Run History</CardTitle>
              <CardDescription>Recent orchestrations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {historyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading history...
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs yet.</p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    className={`w-full rounded-sm border px-3 py-2 text-left ${
                      activeRun?.id === item.id ? "border-primary/60 bg-primary/10" : "hover:border-border"
                    }`}
                    onClick={() => setActiveRun(item)}
                  >
                    <p className="line-clamp-2 text-sm font-medium">{item.goal}</p>
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

        <div className="space-y-4 lg:col-span-8">
          {activeRun ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Final Execution Brief</CardTitle>
                  <CardDescription>{selectedJobLabel}</CardDescription>
                </CardHeader>
                <CardContent>
                  <MarkdownPanel content={activeRun.finalOutput} />
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Researcher</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarkdownPanel content={activeRun.researcherOutput} className="text-xs" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Planner</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarkdownPanel content={activeRun.plannerOutput} className="text-xs" />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Reviewer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarkdownPanel content={activeRun.reviewerOutput} className="text-xs" />
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="flex min-h-[380px] items-center justify-center border-dashed">
              <div className="p-6 text-center text-muted-foreground">
                <Workflow className="mx-auto mb-4 h-12 w-12 opacity-20" />
                <p>Run a multi-agent session to generate role-specific prep strategy.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MultiAgentStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <MultiAgentStudioContent />
    </Suspense>
  );
}
