"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useJobsData } from "@/hooks/use-jobs-data";
import {
  createInterviewMeetRoom,
  endInterviewMeetRoom,
  listInterviewMeetRooms,
} from "@/actions/interview-meet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Video,
  Users,
  Link2,
  Copy,
  ExternalLink,
  RefreshCw,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";

function StatusBadge({ status }) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "COMPLETED") {
    return <Badge variant="secondary">Completed</Badge>;
  }
  if (normalized === "ACTIVE") {
    return <Badge>Live</Badge>;
  }
  return <Badge variant="outline">Waiting</Badge>;
}

function InterviewRoomHostContent() {
  const { applications, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [maxQuestions, setMaxQuestions] = useState("8");
  const [creating, setCreating] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [createdRoomCode, setCreatedRoomCode] = useState("");

  const createdRoom = useMemo(
    () => rooms.find((room) => room.code === createdRoomCode) || null,
    [createdRoomCode, rooms]
  );

  const getJoinLink = useCallback((code) => {
    if (typeof window === "undefined") return `/meet/${code}`;
    return `${window.location.origin}/meet/${code}`;
  }, []);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const result = await listInterviewMeetRooms();
      if (result.success) {
        setRooms(result.rooms || []);
      } else {
        toast.error(result.error || "Failed to load interview rooms.");
      }
    } catch {
      toast.error("Failed to load interview rooms.");
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const copyJoinLink = async (code) => {
    try {
      await navigator.clipboard.writeText(getJoinLink(code));
      toast.success("Join link copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const handleCreateRoom = async () => {
    if (!selectedJobId) {
      toast.error("Please select a job role.");
      return;
    }

    setCreating(true);
    try {
      const result = await createInterviewMeetRoom(selectedJobId, {
        candidateName,
        maxQuestions: Number(maxQuestions),
      });

      if (!result.success) {
        toast.error(result.error || "Failed to create room.");
        return;
      }

      const room = result.room;
      setRooms((prev) => [room, ...prev.filter((r) => r.id !== room.id)]);
      setCreatedRoomCode(room.code);
      toast.success("Interview room created.");
    } catch {
      toast.error("Failed to create room.");
    } finally {
      setCreating(false);
    }
  };

  const handleEndRoom = async (code) => {
    try {
      const result = await endInterviewMeetRoom(code);
      if (!result.success) {
        toast.error(result.error || "Failed to end room.");
        return;
      }

      const room = result.room;
      setRooms((prev) => prev.map((item) => (item.id === room.id ? room : item)));
      toast.success("Interview room ended.");
    } catch {
      toast.error("Failed to end room.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Video className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Live Interview Rooms</h1>
          <p className="text-muted-foreground">
            Create a meet-style room, share the link, and let candidates start after adding their project and experience context.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Create Room</CardTitle>
              <CardDescription>
                Pick a target role and generate a candidate link. AI questions will be based on this selected job.
              </CardDescription>
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
                <label className="text-sm font-medium">Candidate Name (Optional)</label>
                <Input
                  placeholder="e.g. Alex Johnson"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Question Limit</label>
                <Input
                  type="number"
                  min={3}
                  max={15}
                  value={maxQuestions}
                  onChange={(e) => setMaxQuestions(e.target.value)}
                />
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleCreateRoom}
                disabled={creating || jobsLoading}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                {creating ? "Creating Room..." : "Create Interview Room"}
              </Button>
            </CardContent>
          </Card>

          {createdRoom && (
            <Card className="mt-4 border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">Latest Room</CardTitle>
                <CardDescription>Share this with the candidate.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Room Code: </span>
                  <span className="font-semibold tracking-wide">{createdRoom.code}</span>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" onClick={() => copyJoinLink(createdRoom.code)}>
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </Button>
                  <Button asChild variant="outline" className="flex-1 gap-2">
                    <Link href={`/meet/${createdRoom.code}`} target="_blank">
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-8">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Interview Rooms
                </CardTitle>
                <CardDescription>Track active and completed sessions.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={loadRooms} disabled={roomsLoading}>
                {roomsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {roomsLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : rooms.length === 0 ? (
                <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground text-sm">
                  No interview rooms yet. Create one to start.
                </div>
              ) : (
                rooms.map((room) => (
                  <div key={room.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-semibold">
                          {room.application?.job?.company} - {room.application?.job?.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Code: <span className="font-medium tracking-wide">{room.code}</span>
                        </p>
                      </div>
                      <StatusBadge status={room.status} />
                    </div>

                    <div className="text-sm text-muted-foreground flex flex-wrap gap-x-5 gap-y-1">
                      <span>Candidate: {room.candidateName || "Pending"}</span>
                      <span>
                        Progress: {room.questionCount}/{room.maxQuestions} questions
                      </span>
                      <span>Created: {new Date(room.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => copyJoinLink(room.code)}>
                        <Link2 className="h-4 w-4" />
                        Copy Link
                      </Button>
                      <Button asChild size="sm" variant="outline" className="gap-2">
                        <Link href={`/meet/${room.code}`} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                          Open Room
                        </Link>
                      </Button>
                      {String(room.status || "").toUpperCase() !== "COMPLETED" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                          onClick={() => handleEndRoom(room.code)}
                        >
                          <StopCircle className="h-4 w-4" />
                          End
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function InterviewSimulatorPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <InterviewRoomHostContent />
    </Suspense>
  );
}
