"use client";

import React, { useState } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import { generateDripSequence } from "@/actions/drip-campaigns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Suspense } from "react";

function DripCampaignsContent() {
  const { applications, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("");
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleAnalyze = async () => {
    if (!selectedJobId) {
      toast.error("Please select a job from your pipeline.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const result = await generateDripSequence(selectedJobId);
      if (result.success) {
        setAnalysisResult(result);
        toast.success("Drip campaign generated!");
      } else {
        toast.error(result.error || "Failed to generate sequence.");
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Cold Email Drip Campaigns</h1>
          <p className="text-muted-foreground">Generate high-converting 3-part email sequences to bypass ATS and land interviews.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Input Column */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Setup</CardTitle>
              <CardDescription>Select the job you want to target.</CardDescription>
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

              <Button 
                className="w-full mt-2 gap-2" 
                onClick={handleAnalyze} 
                disabled={isAnalyzing || jobsLoading}
              >
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isAnalyzing ? "Drafting Sequence..." : "Generate Drip Sequence"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-8">
          {analysisResult ? (
            <Card className="h-full bg-muted/20">
              <CardHeader>
                <CardTitle className="text-xl">Your 3-Part Sequence</CardTitle>
                <CardDescription>Schedule these in Gmail or copy-paste them directly to recruiters on LinkedIn.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none bg-background p-6 rounded-xl border">
                  <ReactMarkdown>{analysisResult.sequenceMarkdown}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full min-h-[400px] flex items-center justify-center border-dashed">
              <div className="text-center text-muted-foreground p-6">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Select a job and generate an automated email strategy.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DripCampaignsPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <DripCampaignsContent />
    </Suspense>
  );
}
