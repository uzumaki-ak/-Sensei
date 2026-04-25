"use client";

import React, { useState } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import { generateNegotiationScript } from "@/actions/offer-copilot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Scale, Target } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Suspense } from "react";

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
        setAnalysisResult(result);
        toast.success("Negotiation playbook generated!");
      } else {
        toast.error(result.error || "Failed to generate script.");
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
          <Scale className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Offer Negotiation Copilot</h1>
          <p className="text-muted-foreground">Maximize your compensation package with AI-generated negotiation scripts.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Input Column */}
        <div className="lg:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Offer Details</CardTitle>
              <CardDescription>Input what is on the table versus what you want.</CardDescription>
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

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Current Base ($)</label>
                      <Input placeholder="e.g. 120000" type="number" 
                        value={offerDetails.currentBase}
                        onChange={(e) => setOfferDetails(prev => ({...prev, currentBase: e.target.value}))}
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium text-primary">Target Base ($)</label>
                      <Input placeholder="e.g. 140000" type="number"
                        value={offerDetails.targetBase}
                        onChange={(e) => setOfferDetails(prev => ({...prev, targetBase: e.target.value}))}
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Current Equity ($)</label>
                      <Input placeholder="e.g. 50000" type="number" 
                        value={offerDetails.currentEquity}
                        onChange={(e) => setOfferDetails(prev => ({...prev, currentEquity: e.target.value}))}
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium text-primary">Target Equity ($)</label>
                      <Input placeholder="e.g. 70000" type="number" 
                        value={offerDetails.targetEquity}
                        onChange={(e) => setOfferDetails(prev => ({...prev, targetEquity: e.target.value}))}
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Current Bonus ($)</label>
                      <Input placeholder="e.g. 10000" type="number" 
                        value={offerDetails.currentBonus}
                        onChange={(e) => setOfferDetails(prev => ({...prev, currentBonus: e.target.value}))}
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium text-primary">Target Bonus ($)</label>
                      <Input placeholder="e.g. 20000" type="number" 
                        value={offerDetails.targetBonus}
                        onChange={(e) => setOfferDetails(prev => ({...prev, targetBonus: e.target.value}))}
                      />
                  </div>
              </div>

              <div className="space-y-2 pt-2">
                  <label className="text-sm font-medium">Your Leverage (Optional)</label>
                  <Textarea 
                    placeholder="e.g. I have competing offers, I bring 5 years of domain expertise, etc." 
                    value={offerDetails.leveragePoints}
                    onChange={(e) => setOfferDetails(prev => ({...prev, leveragePoints: e.target.value}))}
                  />
              </div>

              <Button 
                className="w-full mt-2 gap-2" 
                onClick={handleAnalyze} 
                disabled={isAnalyzing || jobsLoading}
              >
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                {isAnalyzing ? "Drafting Playbook..." : "Generate Playbook"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-7">
          {analysisResult ? (
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-xl">Your Negotiation Playbook</CardTitle>
                <CardDescription>Use this exact phrasing on your call or email.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{analysisResult.negotiationScriptMarkdown}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full min-h-[400px] flex items-center justify-center border-dashed">
              <div className="text-center text-muted-foreground p-6">
                <Scale className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Input your numbers and generate a professional negotiation script.</p>
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
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <OfferCopilotContent />
    </Suspense>
  );
}
