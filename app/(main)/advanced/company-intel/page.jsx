"use client";

import React, { useState } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import { generateCompanyIntel } from "@/actions/company-intel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2, Newspaper, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Suspense } from "react";

function CompanyIntelContent() {
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
      const result = await generateCompanyIntel(selectedJobId);
      if (result.success) {
        setAnalysisResult(result);
        toast.success("Intel gathered successfully!");
      } else {
        toast.error(result.error || "Failed to gather company intel.");
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
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Company Intel Scraper</h1>
          <p className="text-muted-foreground">Scrape recent news and generate strategic talking points for your interviews.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Input Column */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Target Company</CardTitle>
              <CardDescription>Choose a job you are applying to.</CardDescription>
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
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4" />}
                {isAnalyzing ? "Scraping News & Analyzing..." : "Gather Company Intel"}
              </Button>
            </CardContent>
          </Card>

          {analysisResult && analysisResult.recentNews && analysisResult.recentNews.length > 0 && (
             <Card>
               <CardHeader className="pb-3">
                 <CardTitle className="text-lg">Recent Scraped News</CardTitle>
               </CardHeader>
               <CardContent>
                 <ul className="space-y-4">
                   {analysisResult.recentNews.map((news, idx) => (
                     <li key={idx} className="border-l-2 border-primary/20 pl-3">
                       <a href={news.link} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline flex items-start gap-1">
                         {news.title}
                         <ExternalLink className="h-3 w-3 mt-1 opacity-50 shrink-0" />
                       </a>
                       <p className="text-xs text-muted-foreground mt-1">{news.time}</p>
                     </li>
                   ))}
                 </ul>
               </CardContent>
             </Card>
          )}
        </div>

        {/* Results Column */}
        <div className="lg:col-span-8">
          {analysisResult ? (
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-xl">Interview Talking Points</CardTitle>
                <CardDescription>Bring these up during the "Do you have any questions for us?" segment.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{analysisResult.talkingPointsMarkdown}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full min-h-[400px] flex items-center justify-center border-dashed">
              <div className="text-center text-muted-foreground p-6">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Run the scraper to gather news and generate strategic questions.</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CompanyIntelPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <CompanyIntelContent />
    </Suspense>
  );
}
