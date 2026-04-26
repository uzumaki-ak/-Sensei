"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import {
  askRagQuestion,
  getRagQueryHistory,
  ingestRagContext,
} from "@/actions/rag-copilot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, Search, Clock4 } from "lucide-react";
import { toast } from "sonner";

const HISTORY_ALL_KEY = "__all__";
const RAG_HISTORY_CACHE = new Map();
const RAG_HISTORY_PENDING = new Map();

function getHistoryKey(applicationId) {
  return applicationId || HISTORY_ALL_KEY;
}

async function loadRagHistoryCached(applicationId, force = false) {
  const key = getHistoryKey(applicationId);
  if (!force && RAG_HISTORY_CACHE.has(key)) {
    return { success: true, history: RAG_HISTORY_CACHE.get(key) || [] };
  }
  if (!force && RAG_HISTORY_PENDING.has(key)) {
    return RAG_HISTORY_PENDING.get(key);
  }

  const pending = getRagQueryHistory(applicationId || null)
    .then((result) => {
      if (result?.success) {
        RAG_HISTORY_CACHE.set(key, result.history || []);
      }
      return result;
    })
    .finally(() => {
      RAG_HISTORY_PENDING.delete(key);
    });

  RAG_HISTORY_PENDING.set(key, pending);
  return pending;
}

function pushHistoryCache(applicationId, item) {
  const key = getHistoryKey(applicationId);
  const scoped = RAG_HISTORY_CACHE.get(key) || [];
  RAG_HISTORY_CACHE.set(key, [item, ...scoped.filter((entry) => entry.id !== item.id)]);

  const all = RAG_HISTORY_CACHE.get(HISTORY_ALL_KEY) || [];
  RAG_HISTORY_CACHE.set(HISTORY_ALL_KEY, [item, ...all.filter((entry) => entry.id !== item.id)]);
}

function RagCopilotContent() {
  const { applications, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [notes, setNotes] = useState("");
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [activeResult, setActiveResult] = useState(null);
  const [lastIngestKey, setLastIngestKey] = useState("");
  const ingestLockRef = useRef(false);
  const askLockRef = useRef(false);

  const selectedJobLabel = useMemo(() => {
    const app = applications.find((item) => item.id === selectedJobId);
    return app ? `${app.job.company} - ${app.job.title}` : "Selected role";
  }, [applications, selectedJobId]);

  const ingestSnapshotKey = useMemo(() => {
    if (!selectedJobId) return "";
    return `${selectedJobId}::${notes.trim()}`;
  }, [selectedJobId, notes]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      setHistoryLoading(true);
      try {
        const result = await loadRagHistoryCached(selectedJobId || null, false);
        if (!mounted) return;
        if (!result.success) {
          toast.error(result.error || "Failed to load RAG history.");
          return;
        }
        setHistory(result.history || []);
        setActiveResult((current) => {
          if (current && result.history?.some((item) => item.id === current.id)) {
            return current;
          }
          return (result.history || [])[0] || null;
        });
      } catch {
        if (mounted) toast.error("Failed to load RAG history.");
      } finally {
        if (mounted) setHistoryLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [selectedJobId]);

  const handleIngest = async () => {
    if (ingestLockRef.current || isIngesting) return;
    if (!selectedJobId) {
      toast.error("Select a job first.");
      return;
    }
    if (ingestSnapshotKey && ingestSnapshotKey === lastIngestKey) {
      toast.message("Context already up to date for this role.");
      return;
    }

    ingestLockRef.current = true;
    setIsIngesting(true);
    try {
      const result = await ingestRagContext(selectedJobId, {
        includeJob: true,
        includeResume: true,
        customNotes: notes,
      });
      if (!result.success) {
        toast.error(result.error || "Failed to ingest context.");
        return;
      }
      setLastIngestKey(ingestSnapshotKey);
      toast.success(`RAG context indexed (${result.chunksCreated} chunks).`);
    } catch {
      toast.error("Failed to ingest context.");
    } finally {
      ingestLockRef.current = false;
      setIsIngesting(false);
    }
  };

  const handleAsk = async () => {
    if (askLockRef.current || isAsking) return;
    if (!selectedJobId) {
      toast.error("Select a job first.");
      return;
    }
    if (!question.trim()) {
      toast.error("Ask a question first.");
      return;
    }

    askLockRef.current = true;
    setIsAsking(true);
    try {
      const result = await askRagQuestion(selectedJobId, question);
      if (!result.success) {
        toast.error(result.error || "Failed to answer question.");
        return;
      }

      setQuestion("");
      const next = result.result;
      setActiveResult(next);
      setHistory((prev) => [next, ...prev.filter((item) => item.id !== next.id)]);
      pushHistoryCache(selectedJobId, next);
      toast.success("RAG answer generated.");
    } catch {
      toast.error("Failed to answer question.");
    } finally {
      askLockRef.current = false;
      setIsAsking(false);
    }
  };

  const isIngestUpToDate =
    Boolean(ingestSnapshotKey) && ingestSnapshotKey === lastIngestKey;
  const ingestDisabled = !selectedJobId || jobsLoading || isIngesting || isIngestUpToDate;
  const askDisabled = !selectedJobId || jobsLoading || isAsking || !question.trim();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="rounded-sm border border-border/70 bg-muted/30 p-3">
          <Database className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">RAG Copilot</h1>
          <p className="text-muted-foreground">
            Embed job + resume context and ask targeted interview prep questions with citations.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Context Ingestion</CardTitle>
              <CardDescription>Build searchable context for this role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Job Role</label>
                <Select
                  value={selectedJobId}
                  onValueChange={(value) => {
                    setSelectedJobId(value);
                    setQuestion("");
                  }}
                  disabled={jobsLoading}
                >
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
                <label className="text-sm font-medium">Extra Notes (optional)</label>
                <Textarea
                  rows={5}
                  placeholder="Add recruiter notes, company specifics, or role hints."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <Button
                type="button"
                className="w-full gap-2"
                onClick={handleIngest}
                disabled={ingestDisabled}
              >
                {isIngesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {isIngesting
                  ? "Embedding Context..."
                  : isIngestUpToDate
                    ? "Context Up To Date"
                    : "Ingest Context"}
              </Button>
              {isIngestUpToDate ? (
                <p className="text-xs text-muted-foreground">
                  Context already indexed for this job. Edit notes or switch role to re-ingest.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Q/A History</CardTitle>
              <CardDescription>Recent RAG answers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {historyLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading history...
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No RAG answers yet.</p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    className={`w-full rounded-sm border px-3 py-2 text-left ${
                      activeResult?.id === item.id ? "border-primary/60 bg-primary/10" : "hover:border-border"
                    }`}
                    onClick={() => setActiveResult(item)}
                  >
                    <p className="line-clamp-2 text-sm font-medium">{item.question}</p>
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
          <Card>
            <CardHeader>
              <CardTitle>Ask RAG Copilot</CardTitle>
              <CardDescription>{selectedJobLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleAsk();
                }}
              >
                <Input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask: What project story should I use for this role's frontend requirements?"
                />
                <Button type="submit" className="gap-2" disabled={askDisabled}>
                  {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {isAsking ? "Generating..." : "Ask"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {activeResult ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Answer</CardTitle>
                <CardDescription>{activeResult.question}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <pre className="whitespace-pre-wrap rounded-sm border border-border/70 bg-muted/20 p-3 text-sm leading-relaxed">
                  {activeResult.answer}
                </pre>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Citations</h3>
                  {Array.isArray(activeResult.citations) && activeResult.citations.length > 0 ? (
                    activeResult.citations.map((item) => (
                      <div key={item.id} className="rounded-sm border border-border/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline">{item.id}</Badge>
                          <span className="text-xs text-muted-foreground">{item.sourceType}</span>
                        </div>
                        <p className="mt-1 text-sm font-medium">{item.sourceLabel}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.preview}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No explicit citations detected.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="flex min-h-[320px] items-center justify-center border-dashed">
              <div className="p-6 text-center text-muted-foreground">
                <Database className="mx-auto mb-4 h-12 w-12 opacity-20" />
                <p>Ingest context and ask your first question.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RagCopilotPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <RagCopilotContent />
    </Suspense>
  );
}
