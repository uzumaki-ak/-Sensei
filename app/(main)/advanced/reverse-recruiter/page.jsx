"use client";

import React, { useState } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import { generateReverseRecruiterPitch } from "@/actions/reverse-recruiter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Network, Rocket } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Suspense } from "react";

function ReverseRecruiterContent() {
  const { applications, isGmailConnected, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [targetName, setTargetName] = useState("");
  
  const [isDrafting, setIsDrafting] = useState(false);

  const handleDraft = async () => {
    if (!selectedJobId) {
      toast.error("Please select a job from your pipeline.");
      return;
    }
    if (!targetName.trim()) {
      toast.error("Please enter the name of the founder or hiring manager.");
      return;
    }
    if (!isGmailConnected) {
      toast.error("You must connect your Gmail in the dashboard first.");
      return;
    }

    setIsDrafting(true);

    try {
      const result = await generateReverseRecruiterPitch(selectedJobId, targetName.trim());
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.error || "Failed to draft pitch.");
      }
    } catch (error) {
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
          <p className="text-muted-foreground">Bypass the ATS. Pitch directly to the Founder or Hiring Manager via Gmail.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full mt-6">
        <Card className="border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Direct Pitch Generator
            </CardTitle>
            <CardDescription>
              Select a target role and provide the decision-maker's name. We will guess their email, write a hyper-aggressive pitch based on your profile, and draft it in your connected Gmail account automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isGmailConnected && !jobsLoading && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 text-sm">
                <strong>Wait!</strong> You must <Link href="/dashboard" className="underline font-bold">connect your Gmail</Link> before using the Reverse Recruiter.
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Target Job Role</label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId} disabled={jobsLoading || !isGmailConnected}>
                <SelectTrigger>
                  <SelectValue placeholder={jobsLoading ? "Loading jobs..." : "Select a job to reverse-recruit for"} />
                </SelectTrigger>
                <SelectContent>
                  {applications.length === 0 && !jobsLoading ? (
                    <SelectItem value="none" disabled>No jobs found. Hunt first!</SelectItem>
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
                disabled={!isGmailConnected}
              />
              <p className="text-xs text-muted-foreground">Use LinkedIn to find the Founder, CEO, or Head of Dept.</p>
            </div>

            <Button 
              className="w-full h-12 text-md gap-2 mt-4" 
              onClick={handleDraft} 
              disabled={isDrafting || jobsLoading || !isGmailConnected}
            >
              {isDrafting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Network className="h-5 w-5" />}
              {isDrafting ? "Drafting Pitch in Gmail..." : "Deploy Reverse Recruiter"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ReverseRecruiterPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ReverseRecruiterContent />
    </Suspense>
  );
}
