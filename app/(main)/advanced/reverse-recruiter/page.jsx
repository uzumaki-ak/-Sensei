"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import {
  generateReverseRecruiterPitch,
  getReverseRecruiterHistory,
} from "@/actions/reverse-recruiter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Network, Rocket, History, Clock, Mail, UserRound, Copy } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Suspense } from "react";

function ReverseRecruiterContent() {
  const {
    applications,
    isGmailConnected,
    isGmailFullyAuthorized,
    gmailNeedsReconnect,
    loading: jobsLoading,
  } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [activeTab, setActiveTab] = useState("latest");
  const [isDrafting, setIsDrafting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [draftResult, setDraftResult] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);

  const selectedHistory = useMemo(
    () =>
      historyItems.find((item) => item.id === selectedHistoryId) ||
      historyItems[0] ||
      null,
    [historyItems, selectedHistoryId]
  );
  const canUseGmail = isGmailConnected && isGmailFullyAuthorized;

  const copyPitch = async (draft, mode = "full") => {
    if (!draft) return;
    const text =
      mode === "subject"
        ? String(draft.subject || "")
        : mode === "body"
        ? String(draft.body || "")
        : `Subject: ${draft.subject || ""}\n\n${draft.body || ""}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(mode === "full" ? "Pitch copied." : `${mode} copied.`);
    } catch {
      toast.error("Could not copy text.");
    }
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await getReverseRecruiterHistory(selectedJobId || null);
      if (result.success) {
        const items = result.history || [];
        setHistoryItems(items);
        setSelectedHistoryId((prev) => {
          if (prev && items.some((item) => item.id === prev)) return prev;
          return items[0]?.id || null;
        });
      } else {
        toast.error(result.error || "Failed to load history.");
      }
    } catch {
      toast.error("Failed to load history.");
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedJobId]);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const handleDraft = async () => {
    if (!selectedJobId) {
      toast.error("Please select a job from your pipeline.");
      return;
    }
    if (!targetName.trim()) {
      toast.error("Please enter the name of the founder or hiring manager.");
      return;
    }
    if (!canUseGmail) {
      toast.error(
        gmailNeedsReconnect
          ? "Reconnect Gmail from Dashboard and approve all requested scopes."
          : "You must connect your Gmail in the dashboard first."
      );
      return;
    }

    setIsDrafting(true);

    try {
      const result = await generateReverseRecruiterPitch(selectedJobId, targetName.trim());
      if (result.success) {
        setDraftResult(result.draft || null);
        if (result.draft) {
          setHistoryItems((prev) => [result.draft, ...prev.filter((item) => item.id !== result.draft.id)]);
          setSelectedHistoryId(result.draft.id);
        }
        setActiveTab("latest");
        toast.success(result.message);
      } else {
        toast.error(result.error || "Failed to draft pitch.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Network className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Reverse Recruiter AI</h1>
          <p className="text-muted-foreground">
            Bypass the ATS. Pitch directly to the Founder or Hiring Manager via Gmail.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 mt-2">
        <div className="lg:col-span-4">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Direct Pitch Generator
              </CardTitle>
              <CardDescription>
                Select a target role and decision-maker. The app drafts in Gmail and stores each pitch in history.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!canUseGmail && !jobsLoading && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-sm">
                  <strong>Wait!</strong> You must{" "}
                  <Link href="/dashboard" className="underline font-bold">
                    {gmailNeedsReconnect ? "reconnect Gmail and approve all scopes" : "connect your Gmail"}
                  </Link>{" "}
                  before using Reverse Recruiter.
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Target Job Role</label>
                <Select
                  value={selectedJobId}
                  onValueChange={setSelectedJobId}
                  disabled={jobsLoading || !canUseGmail}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        jobsLoading ? "Loading jobs..." : "Select a job to reverse-recruit for"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.length === 0 && !jobsLoading ? (
                      <SelectItem value="none" disabled>
                        No jobs found. Hunt first!
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
                <label className="text-sm font-medium">Target Decision Maker's Name</label>
                <Input
                  placeholder="e.g. Sam Altman"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  disabled={!canUseGmail}
                />
                <p className="text-xs text-muted-foreground">
                  Use LinkedIn to find the Founder, CEO, or Department Head.
                </p>
              </div>

              <Button
                className="w-full h-12 text-md gap-2 mt-4"
                onClick={handleDraft}
                disabled={isDrafting || jobsLoading || !canUseGmail}
              >
                {isDrafting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Network className="h-5 w-5" />
                )}
                {isDrafting ? "Drafting Pitch in Gmail..." : "Deploy Reverse Recruiter"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-[420px] grid-cols-2">
              <TabsTrigger value="latest">Latest Draft</TabsTrigger>
              <TabsTrigger value="history" className="gap-1">
                <History className="h-4 w-4" />
                History
                <Badge variant="outline">{historyItems.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="latest" className="mt-4">
              {draftResult ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Latest Drafted Pitch</CardTitle>
                    <CardDescription>
                      Saved on {new Date(draftResult.createdAt).toLocaleString()}.
                    </CardDescription>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyPitch(draftResult, "subject")}>
                        <Copy className="h-3.5 w-3.5" />
                        Subject
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyPitch(draftResult, "body")}>
                        <Copy className="h-3.5 w-3.5" />
                        Body
                      </Button>
                      <Button size="sm" className="gap-1.5" onClick={() => copyPitch(draftResult, "full")}>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Full Pitch
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{draftResult.targetName}</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{draftResult.targetEmail}</span>
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
                      <p className="text-sm">{draftResult.subject}</p>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Body</p>
                      <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                        {draftResult.body}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-[420px] flex items-center justify-center border-dashed">
                  <div className="text-center text-muted-foreground p-6">
                    <Rocket className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Draft your first reverse recruiter pitch to populate this view.</p>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <div className="grid md:grid-cols-12 gap-4">
                <div className="md:col-span-5 space-y-3">
                  {historyLoading ? (
                    <Card className="border-dashed">
                      <CardContent className="p-8 flex justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ) : historyItems.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="p-8 text-center text-muted-foreground text-sm">
                        No reverse recruiter pitches saved yet for this selection.
                      </CardContent>
                    </Card>
                  ) : (
                    historyItems.map((item) => (
                      <Card
                        key={item.id}
                        className={`cursor-pointer transition-colors ${
                          selectedHistory?.id === item.id ? "border-primary" : "hover:border-primary/40"
                        }`}
                        onClick={() => setSelectedHistoryId(item.id)}
                      >
                        <CardContent className="p-4 space-y-2">
                          <p className="text-sm font-medium line-clamp-1">{item.subject}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {item.application?.job?.company} - {item.application?.job?.title}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(item.createdAt).toLocaleString()}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>

                <div className="md:col-span-7">
                  {selectedHistory ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{selectedHistory.subject}</CardTitle>
                        <CardDescription>
                          {selectedHistory.application?.job?.company} - {selectedHistory.application?.job?.title}
                        </CardDescription>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => copyPitch(selectedHistory, "body")}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy Body
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() => copyPitch(selectedHistory, "full")}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy Full
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{selectedHistory.targetName}</span>
                          </div>
                          <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{selectedHistory.targetEmail}</span>
                          </div>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Body</p>
                          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                            {selectedHistory.body}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-dashed h-[320px] flex items-center justify-center">
                      <CardContent className="text-sm text-muted-foreground">
                        Select a history item to preview it.
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function ReverseRecruiterPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ReverseRecruiterContent />
    </Suspense>
  );
}
