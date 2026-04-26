"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  endInterviewMeetRoom,
  evaluateInterviewMeetRoom,
  getInterviewMeetRoomByCode,
  joinInterviewMeetRoom,
  startInterviewMeetRoom,
  submitInterviewMeetAnswer,
} from "@/actions/interview-meet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Video,
  Bot,
  UserCircle2,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  StopCircle,
  Sparkles,
  Award,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function getStatusLabel(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "ACTIVE") return "Live";
  if (normalized === "COMPLETED") return "Completed";
  return "Waiting";
}

function getStatusVariant(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "ACTIVE") return "default";
  if (normalized === "COMPLETED") return "secondary";
  return "outline";
}

export default function MeetRoomPage() {
  const params = useParams();
  const roomCode = normalizeCode(params?.code);

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [answer, setAnswer] = useState("");

  const [candidateName, setCandidateName] = useState("");
  const [candidateExperience, setCandidateExperience] = useState("");
  const [candidateProjects, setCandidateProjects] = useState("");
  const [candidateTechStack, setCandidateTechStack] = useState("");
  const [candidateCompanyContext, setCandidateCompanyContext] = useState("");

  const [speechSupported, setSpeechSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const keepListeningRef = useRef(false);
  const manualStopRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const finalTranscriptRef = useRef("");

  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const lastSpokenTurnIdRef = useRef("");

  const latestAiTurn = useMemo(() => {
    if (!room?.turns?.length) return null;
    return [...room.turns].reverse().find((turn) => turn.role === "ai") || null;
  }, [room]);

  const transcriptTurns = useMemo(() => room?.turns || [], [room]);
  const scorecard = useMemo(() => room?.evaluation || null, [room]);
  const intelSourceStatus = useMemo(() => {
    const meta = room?.jobContext?.sourceMeta || {};
    const attempted = Array.isArray(meta.attemptedUrls) ? meta.attemptedUrls : [];
    const scraped = Array.isArray(meta.scrapedUrls) ? meta.scrapedUrls : [];
    const failed = Array.isArray(meta.failedUrls) ? meta.failedUrls : [];
    const domains = attempted
      .map((url) => {
        try {
          return new URL(url).hostname.replace(/^www\./i, "");
        } catch {
          return "";
        }
      })
      .filter(Boolean)
      .slice(0, 5);
    return { attempted, scraped, failed, domains };
  }, [room]);

  const candidateContext = useMemo(() => {
    const blocks = [];
    if (candidateExperience.trim()) blocks.push(`Experience: ${candidateExperience.trim()}`);
    if (candidateProjects.trim()) blocks.push(`Projects: ${candidateProjects.trim()}`);
    if (candidateTechStack.trim()) blocks.push(`Tech Stack: ${candidateTechStack.trim()}`);
    if (candidateCompanyContext.trim()) {
      blocks.push(`Company Details Shared By Candidate: ${candidateCompanyContext.trim()}`);
    }
    return blocks.join("\n");
  }, [candidateCompanyContext, candidateExperience, candidateProjects, candidateTechStack]);

  const loadRoom = useCallback(
    async (asRefresh = false) => {
      if (!roomCode) return;
      if (asRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const result = await getInterviewMeetRoomByCode(roomCode);
        if (!result.success) {
          toast.error(result.error || "Room not found.");
          return;
        }

        setRoom(result.room);
        if (!candidateName && result.room.candidateName) {
          setCandidateName(result.room.candidateName);
        }
      } catch {
        toast.error("Failed to load room.");
      } finally {
        if (asRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [candidateName, roomCode]
  );

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!roomCode) return;
    const interval = setInterval(() => {
      loadRoom(true);
    }, 8000);
    return () => clearInterval(interval);
  }, [loadRoom, roomCode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    setSpeechSupported(true);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalChunk = finalTranscriptRef.current;
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = String(event.results[i][0]?.transcript || "").trim();
        if (!piece) continue;
        if (event.results[i].isFinal) {
          finalChunk = `${finalChunk} ${piece}`.trim();
        } else {
          interimChunk = `${interimChunk} ${piece}`.trim();
        }
      }
      finalTranscriptRef.current = finalChunk;
      setAnswer(`${finalChunk} ${interimChunk}`.trim());
    };

    recognition.onerror = (event) => {
      const code = String(event?.error || "");
      const hardFailure =
        code === "not-allowed" ||
        code === "service-not-allowed" ||
        code === "audio-capture";

      if (hardFailure) {
        keepListeningRef.current = false;
        manualStopRef.current = true;
        setIsRecording(false);
        toast.error("Microphone permission is blocked. Allow mic access and try again.");
        return;
      }
    };

    recognition.onend = () => {
      if (keepListeningRef.current && !manualStopRef.current) {
        if (restartTimeoutRef.current) {
          clearTimeout(restartTimeoutRef.current);
        }
        restartTimeoutRef.current = setTimeout(() => {
          try {
            recognition.start();
          } catch {
            setIsRecording(false);
          }
        }, 150);
        return;
      }
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      keepListeningRef.current = false;
      manualStopRef.current = true;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      try {
        recognition.stop();
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (keepListeningRef.current || isRecording) {
      manualStopRef.current = true;
      keepListeningRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    manualStopRef.current = false;
    keepListeningRef.current = true;
    finalTranscriptRef.current = String(answer || "").trim();

    try {
      recognitionRef.current.start();
      setIsRecording(true);
    } catch {
      keepListeningRef.current = false;
      setIsRecording(false);
      toast.error("Could not start microphone. Please retry.");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const enableCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCameraError("Camera preview unavailable. You can continue without video.");
      }
    };

    enableCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!latestAiTurn?.id) return;
    if (lastSpokenTurnIdRef.current === latestAiTurn.id) return;

    lastSpokenTurnIdRef.current = latestAiTurn.id;
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(latestAiTurn.content);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }, [latestAiTurn]);

  const handleStartInterview = async () => {
    if (!candidateName.trim()) {
      toast.error("Please enter candidate name.");
      return;
    }
    if (!candidateContext.trim()) {
      toast.error("Please provide project/experience context so AI can personalize questions.");
      return;
    }

    setStarting(true);
    try {
      const joined = await joinInterviewMeetRoom(roomCode, candidateName.trim());
      if (!joined.success) {
        toast.error(joined.error || "Failed to join room.");
        return;
      }

      const result = await startInterviewMeetRoom(roomCode, {
        candidateName: candidateName.trim(),
        candidateContext,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to start interview.");
        return;
      }

      setRoom(result.room);
      toast.success("Interview started.");
    } catch {
      toast.error("Failed to start interview.");
    } finally {
      setStarting(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) {
      toast.error("Please provide an answer.");
      return;
    }

    if (keepListeningRef.current || isRecording) {
      manualStopRef.current = true;
      keepListeningRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    }

    setSubmitting(true);
    try {
      const result = await submitInterviewMeetAnswer(roomCode, answer.trim(), {
        candidateName: candidateName.trim(),
        candidateContext,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to submit answer.");
        return;
      }

      setRoom(result.room);
      setAnswer("");
      finalTranscriptRef.current = "";
      toast.success("Answer submitted.");
    } catch {
      toast.error("Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnd = async () => {
    setEnding(true);
    try {
      const result = await endInterviewMeetRoom(roomCode);
      if (!result.success) {
        toast.error(result.error || "Failed to end interview.");
        return;
      }
      setRoom(result.room);
      toast.success("Interview ended.");
    } catch {
      toast.error("Failed to end interview.");
    } finally {
      setEnding(false);
    }
  };

  const handleGenerateScorecard = async () => {
    setEvaluating(true);
    try {
      const result = await evaluateInterviewMeetRoom(roomCode);
      if (!result.success) {
        toast.error(result.error || "Failed to generate scorecard.");
        return;
      }
      setRoom(result.room);
      toast.success("Scorecard generated.");
    } catch {
      toast.error("Failed to generate scorecard.");
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-lg border-destructive/30">
          <CardHeader>
            <CardTitle>Room Not Found</CardTitle>
            <CardDescription>
              This room code is invalid or no longer available.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const status = String(room.status || "").toUpperCase();
  const isWaiting = status === "WAITING";
  const isActive = status === "ACTIVE";
  const isCompleted = status === "COMPLETED";
  const needsCompanyDetails = Boolean(room.jobContext?.needsCompanyDetails);

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <Card className="border-primary/20">
          <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {room.application?.job?.title} at {room.application?.job?.company}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Room Code: <span className="font-semibold tracking-wide">{room.code}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusVariant(room.status)}>{getStatusLabel(room.status)}</Badge>
              <Badge variant="outline">
                Q {room.questionCount}/{room.maxQuestions}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => loadRoom(true)} disabled={refreshing}>
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              {!isCompleted && (
                <Button size="sm" variant="destructive" className="gap-2" onClick={handleEnd} disabled={ending}>
                  {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
                  End
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 space-y-4">
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Meeting Stage</CardTitle>
                <CardDescription>
                  AI interviewer uses selected job requirements + company context + your profile context.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {intelSourceStatus.attempted.length > 0 && (
                  <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                    <p>
                      Intel links scanned:{" "}
                      <span className="font-medium text-foreground">
                        {intelSourceStatus.scraped.length}/{intelSourceStatus.attempted.length}
                      </span>
                      {intelSourceStatus.failed.length > 0
                        ? ` (${intelSourceStatus.failed.length} blocked/unreachable)`
                        : ""}
                    </p>
                    {intelSourceStatus.domains.length > 0 && (
                      <p className="mt-1 truncate">
                        Sources: {intelSourceStatus.domains.join(", ")}
                      </p>
                    )}
                  </div>
                )}
                {needsCompanyDetails && (
                  <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    AI context confidence is low for this company. Share website/LinkedIn/product details so questions stay accurate.
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="relative rounded-xl border bg-muted/20 p-4 min-h-[220px] flex flex-col">
                    <div className="flex items-center gap-2 text-sm font-medium mb-3">
                      <Bot className="h-4 w-4 text-primary" />
                      AI Interviewer
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <div className="relative">
                        <div className="h-24 w-24 rounded-full bg-primary/20 animate-pulse" />
                        <div className="absolute inset-3 h-18 w-18 rounded-full bg-primary/40 blur-md" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      {latestAiTurn?.content || "AI will ask the first question once the interview starts."}
                    </p>
                  </div>

                  <div className="relative rounded-xl border bg-muted/20 p-4 min-h-[220px] flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 text-sm font-medium mb-3 z-10">
                      <UserCircle2 className="h-4 w-4 text-primary" />
                      Candidate
                    </div>
                    {cameraError ? (
                      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                        {cameraError}
                      </div>
                    ) : (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full rounded-lg object-cover border"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {isWaiting && (
              <Card>
                <CardHeader>
                  <CardTitle>Before Meeting Starts</CardTitle>
                  <CardDescription>
                    Fill this once so AI can generate role-specific and project-specific questions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Your full name"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                  />
                  <Textarea
                    rows={3}
                    placeholder="Years of experience, current role, domain experience"
                    value={candidateExperience}
                    onChange={(e) => setCandidateExperience(e.target.value)}
                  />
                  <Textarea
                    rows={3}
                    placeholder="Key projects you built (architecture, scale, impact)"
                    value={candidateProjects}
                    onChange={(e) => setCandidateProjects(e.target.value)}
                  />
                  <Textarea
                    rows={2}
                    placeholder="Your strongest tech stack"
                    value={candidateTechStack}
                    onChange={(e) => setCandidateTechStack(e.target.value)}
                  />
                  <Textarea
                    rows={3}
                    placeholder="Company details (website, LinkedIn, what they build) if you know them"
                    value={candidateCompanyContext}
                    onChange={(e) => setCandidateCompanyContext(e.target.value)}
                  />
                  <Button className="w-full gap-2" onClick={handleStartInterview} disabled={starting}>
                    {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {starting ? "Preparing Interview..." : "Start Meet Interview"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {isActive && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Answer</CardTitle>
                  <CardDescription>Respond to the latest AI question and submit to continue.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {needsCompanyDetails && (
                    <Textarea
                      rows={3}
                      placeholder="If asked, add company details here (website/LinkedIn/what they build)"
                      value={candidateCompanyContext}
                      onChange={(e) => setCandidateCompanyContext(e.target.value)}
                    />
                  )}
                  <Textarea
                    rows={6}
                    placeholder="Type your answer or use speech input..."
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2 justify-between">
                    <Button
                      variant={isRecording ? "destructive" : "outline"}
                      className="gap-2"
                      onClick={toggleRecording}
                      disabled={!speechSupported}
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {isRecording ? "Stop Speaking" : "Speak Answer"}
                    </Button>
                    <Button className="gap-2" onClick={handleSubmitAnswer} disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Submit Answer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isCompleted && (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle>Interview Completed</CardTitle>
                  <CardDescription>
                    This room is closed. Transcript remains available on the right panel.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!scorecard ? (
                    <Button className="gap-2" onClick={handleGenerateScorecard} disabled={evaluating}>
                      {evaluating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                      Generate Scorecard
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Scorecard ready. Review below for strengths, mistakes, and improvement plan.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {scorecard && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Interview Scorecard
                  </CardTitle>
                  <CardDescription>
                    Overall score: <span className="font-semibold">{scorecard.overallScore}/100</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {scorecard.summary && (
                    <div className="text-sm text-muted-foreground rounded-md border bg-muted/20 p-3">
                      {scorecard.summary}
                    </div>
                  )}

                  <div className="grid md:grid-cols-3 gap-3">
                    {[
                      ["Technical Depth", scorecard.dimensions?.technicalDepth],
                      ["Ownership", scorecard.dimensions?.ownership],
                      ["Communication", scorecard.dimensions?.communication],
                    ].map(([label, data]) => (
                      <div key={label} className="rounded-lg border p-3 space-y-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="text-2xl font-bold">{data?.score ?? 0}/10</p>
                        <p className="text-xs text-muted-foreground">{data?.feedback || "No feedback."}</p>
                      </div>
                    ))}
                  </div>

                  {Array.isArray(scorecard.strengths) && scorecard.strengths.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        What You Did Right
                      </p>
                      <div className="space-y-2">
                        {scorecard.strengths.map((item, idx) => (
                          <div key={idx} className="text-sm rounded-md border border-green-500/20 bg-green-500/5 p-3">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(scorecard.mistakes) && scorecard.mistakes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Mistakes And Better Answers
                      </p>
                      <div className="space-y-2">
                        {scorecard.mistakes.map((item, idx) => (
                          <div key={idx} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                            <p className="text-sm font-medium">{item.issue}</p>
                            <p className="text-xs text-muted-foreground">{item.why}</p>
                            <p className="text-xs">
                              <span className="font-semibold">Better approach:</span> {item.betterApproach}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(scorecard.nextSteps) && scorecard.nextSteps.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Improvement Plan
                      </p>
                      <div className="space-y-2">
                        {scorecard.nextSteps.map((item, idx) => (
                          <div key={idx} className="text-sm rounded-md border bg-muted/20 p-3">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-4">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Live Transcript</CardTitle>
                <CardDescription>Chronological interview conversation.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  {transcriptTurns.length === 0 ? (
                    <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">
                      Transcript will appear once the interview starts.
                    </div>
                  ) : (
                    transcriptTurns.map((turn) => (
                      <div
                        key={turn.id}
                        className={`rounded-lg border p-3 text-sm ${
                          turn.role === "ai"
                            ? "bg-primary/5 border-primary/20"
                            : "bg-muted/20 border-muted"
                        }`}
                      >
                        <p className="text-xs font-semibold mb-1 uppercase tracking-wide text-muted-foreground">
                          {turn.role === "ai" ? "AI Interviewer" : "Candidate"}
                        </p>
                        <p className="whitespace-pre-wrap leading-relaxed">{turn.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
