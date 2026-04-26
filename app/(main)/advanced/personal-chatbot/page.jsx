"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useJobsData } from "@/hooks/use-jobs-data";
import {
  getPersonalChatMessages,
  getPersonalChatSessions,
  sendPersonalChatMessage,
} from "@/actions/personal-chatbot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircleCode, Clock4, Plus } from "lucide-react";
import { toast } from "sonner";

const HELP_SUGGESTIONS = [
  "What does each advanced feature do, and what are the best use cases?",
  "Give me a recruiter demo script to showcase this platform in 3 minutes.",
  "How should I test RAG Copilot, Multi-Agent Studio, and Prompt Eval Lab end-to-end?",
  "Based on my data, what are my strongest project stories for interviews?",
  "What should I improve next week to become more interview-ready?",
];

function PersonalChatbotContent() {
  const { applications, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("__general__");
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [helpOpen, setHelpOpen] = useState(true);
  const sendLockRef = useRef(false);

  const selectedJobLabel = useMemo(() => {
    if (selectedJobId === "__general__") return "General personal context";
    const app = applications.find((item) => item.id === selectedJobId);
    return app ? `${app.job.company} - ${app.job.title}` : "General personal context";
  }, [applications, selectedJobId]);

  const loadSessions = async (jobId, preferredSessionId = null) => {
    setSessionsLoading(true);
    try {
      const result = await getPersonalChatSessions(jobId === "__general__" ? null : jobId);
      if (!result.success) {
        toast.error(result.error || "Failed to load chat sessions.");
        return;
      }

      const nextSessions = result.sessions || [];
      setSessions(nextSessions);

      if (preferredSessionId) {
        setActiveSessionId(preferredSessionId);
      } else if (!nextSessions.some((session) => session.id === activeSessionId)) {
        setActiveSessionId(nextSessions[0]?.id || null);
      }
    } catch {
      toast.error("Failed to load chat sessions.");
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadMessages = async (sessionId) => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    try {
      const result = await getPersonalChatMessages(sessionId);
      if (!result.success) {
        toast.error(result.error || "Failed to load chat messages.");
        return;
      }
      setMessages(result.messages || []);
    } catch {
      toast.error("Failed to load chat messages.");
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    loadSessions(selectedJobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId]);

  useEffect(() => {
    loadMessages(activeSessionId);
  }, [activeSessionId]);

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
  };

  const handleSend = async () => {
    if (sendLockRef.current || isSending) return;
    const cleanMessage = input.trim();
    if (!cleanMessage) {
      toast.error("Type a message first.");
      return;
    }

    const tempUserMessage = {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content: cleanMessage,
      citations: [],
      createdAt: new Date().toISOString(),
    };

    sendLockRef.current = true;
    setIsSending(true);
    setInput("");
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const result = await sendPersonalChatMessage({
        sessionId: activeSessionId || null,
        applicationId: selectedJobId === "__general__" ? null : selectedJobId,
        message: cleanMessage,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to send message.");
        setMessages((prev) => prev.filter((item) => item.id !== tempUserMessage.id));
        return;
      }

      const nextSessionId = result.session?.id;
      if (nextSessionId) {
        setActiveSessionId(nextSessionId);
        await loadSessions(selectedJobId, nextSessionId);
        await loadMessages(nextSessionId);
      }
      toast.success("Response ready.");
    } catch {
      toast.error("Failed to send message.");
      setMessages((prev) => prev.filter((item) => item.id !== tempUserMessage.id));
    } finally {
      sendLockRef.current = false;
      setIsSending(false);
    }
  };

  const sendDisabled = isSending || !input.trim();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="rounded-sm border border-border/70 bg-muted/30 p-3">
          <MessageCircleCode className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Personal DB Chatbot</h1>
          <p className="text-muted-foreground">
            Ask anything about your own profile, jobs, resumes, and AI tool outputs. Data stays scoped to your account.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Context Scope</CardTitle>
              <CardDescription>Pick a target role or use general personal context.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Job Role</label>
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

              <Button type="button" variant="outline" className="w-full gap-2" onClick={handleNewChat}>
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Chat History</CardTitle>
              <CardDescription>Recent personal sessions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading sessions...
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No chat sessions yet.</p>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    className={`w-full rounded-sm border px-3 py-2 text-left ${
                      activeSessionId === session.id ? "border-primary/60 bg-primary/10" : "hover:border-border"
                    }`}
                    onClick={() => setActiveSessionId(session.id)}
                  >
                    <p className="line-clamp-1 text-sm font-medium">{session.title}</p>
                    <p className="line-clamp-2 mt-1 text-xs text-muted-foreground">{session.preview || "No preview"}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock4 className="h-3 w-3" />
                      {new Date(session.updatedAt).toLocaleString()}
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
              <CardTitle>Personal Copilot Chat</CardTitle>
              <CardDescription>{selectedJobLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[540px] space-y-3 overflow-y-auto rounded-sm border border-border/70 p-3">
                {messagesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading conversation...
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ask things like: "Which project story best matches this job?" or "Where are my biggest skill gaps from past runs?"
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                          message.role === "assistant"
                            ? "border border-primary/30 bg-primary/10"
                            : "border border-border/70 bg-muted/30"
                        }`}
                      >
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {message.role === "assistant" ? "Copilot" : "You"}
                        </p>
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                        )}

                        {Array.isArray(message.citations) && message.citations.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Citations</p>
                            {message.citations.map((citation) => (
                              <div key={`${message.id}-${citation.id}`} className="rounded-sm border border-border/60 p-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{citation.id}</Badge>
                                  <span className="text-xs text-muted-foreground">{citation.type}</span>
                                </div>
                                <p className="mt-1 text-xs font-medium">{citation.label}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{citation.preview}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSend();
                }}
              >
                <Textarea
                  rows={4}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Ask about your profile, project stories, job fit, prep strategy, or gaps..."
                />
                <Button type="submit" className="gap-2" disabled={sendDisabled}>
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircleCode className="h-4 w-4" />}
                  {isSending ? "Thinking..." : "Send"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-5 right-5 z-50">
        {helpOpen ? (
          <div className="mb-2 w-[300px] rounded-sm border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Having trouble? Ask me anything.
            </p>
            <div className="mt-2 space-y-1.5">
              {HELP_SUGGESTIONS.map((question, index) => (
                <button
                  key={`help-${index}`}
                  type="button"
                  className="w-full rounded-sm border border-border/60 px-2 py-1.5 text-left text-xs hover:bg-muted/40"
                  onClick={() => {
                    setInput(question);
                    setHelpOpen(false);
                  }}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={() => setHelpOpen((current) => !current)}
          title="Toggle quick help"
        >
          <MessageCircleCode className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

export default function PersonalChatbotPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <PersonalChatbotContent />
    </Suspense>
  );
}
