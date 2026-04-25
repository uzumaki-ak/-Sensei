"use client";

import React, { useState, useEffect, useRef } from "react";
import { useJobsData } from "@/hooks/use-jobs-data";
import { generateInterviewQuestions, gradeInterviewAnswers } from "@/actions/interview-simulator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mic, MicOff, MessageSquare, BrainCircuit, CheckCircle2, XCircle, History } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { Suspense } from "react";

function InterviewSimulatorContent() {
  const { applications, loading: jobsLoading } = useJobsData();
  const [selectedJobId, setSelectedJobId] = useState("");
  const [projectDetails, setProjectDetails] = useState("");
  
  // App State: 'setup' | 'generating' | 'interview' | 'grading' | 'results'
  const [phase, setPhase] = useState("setup");
  
  // Interview State
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [qaPairs, setQaPairs] = useState([]); // Array of { question, answer }
  const [gradingResults, setGradingResults] = useState([]);

  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Initialize Web Speech API if supported
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          // We append to current answer or just overwrite depending on logic.
          // For simplicity, we'll append to whatever was already typed before starting recording
          setCurrentAnswer((prev) => {
              // A bit hacky, but avoids infinite appending loop. We just set it to the full current transcript block
              // Usually interim results are messy, so we replace the whole textarea with the final transcript of this session
              // To combine typing and speaking safely, it's complex, so we'll just set it directly.
              return transcript;
          });
        };

        recognitionRef.current.onerror = (event) => {
          console.error("Speech recognition error", event.error);
          setIsRecording(false);
        };

        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
        toast.error("Your browser does not support Voice Recognition. Try Google Chrome.");
        return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      // Clear current answer so voice starts fresh for this attempt, or just append
      recognitionRef.current.start();
      setIsRecording(true);
      toast.info("Listening...");
    }
  };

  const handleStartInterview = async () => {
    if (!selectedJobId) {
      toast.error("Please select a job.");
      return;
    }
    if (!projectDetails.trim()) {
      toast.error("Please describe your project or paste your resume.");
      return;
    }

    setPhase("generating");
    try {
      const result = await generateInterviewQuestions(selectedJobId, projectDetails.trim());
      if (result.success) {
        setQuestions(result.questions);
        setPhase("interview");
        setCurrentQuestionIndex(0);
        setQaPairs([]);
        setCurrentAnswer("");
      } else {
        toast.error(result.error || "Failed to generate questions.");
        setPhase("setup");
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
      setPhase("setup");
    }
  };

  const handleNextQuestion = async () => {
    if (!currentAnswer.trim()) {
        toast.error("Please provide an answer before continuing.");
        return;
    }

    // Stop recording if active
    if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsRecording(false);
    }

    const currentQ = questions[currentQuestionIndex];
    const newQaPairs = [...qaPairs, { question: currentQ, answer: currentAnswer.trim() }];
    setQaPairs(newQaPairs);
    setCurrentAnswer("");

    if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
        // Finished interview
        setPhase("grading");
        try {
            const result = await gradeInterviewAnswers(selectedJobId, newQaPairs, projectDetails);
            if (result.success) {
                setGradingResults(result.results);
                setPhase("results");
                toast.success("Interview grading complete!");
            } else {
                toast.error(result.error || "Failed to grade interview.");
                setPhase("setup"); // Or handle error state better
            }
        } catch (error) {
            toast.error("Error during grading.");
            setPhase("setup");
        }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl">
          <BrainCircuit className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">AI Interview Simulator</h1>
          <p className="text-muted-foreground">Dynamic, scenario-based mock interviews with voice recognition and senior-level grading.</p>
        </div>
      </div>

      <Tabs defaultValue="new" className="w-full mt-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="new">New Interview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          {phase === "setup" && (
            <Card className="max-w-3xl mx-auto w-full mt-6">
              <CardHeader>
                <CardTitle>Configure Your Interview</CardTitle>
                <CardDescription>Select the target role and paste the project you want to be grilled on.</CardDescription>
              </CardHeader>
          <CardContent className="space-y-6">
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Project Context / Resume Snippet</label>
              <Textarea 
                placeholder="Describe a massive project you built, its architecture, and scale. The AI will ask you technical implementation questions based on this." 
                value={projectDetails}
                onChange={(e) => setProjectDetails(e.target.value)}
                rows={6}
              />
            </div>

            <Button className="w-full" size="lg" onClick={handleStartInterview}>
              Generate Custom Interview
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "generating" && (
        <Card className="max-w-xl mx-auto w-full mt-12 border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-xl font-bold">Designing the Gauntlet...</h3>
            <p className="text-muted-foreground mt-2">Analyzing the tech stack and generating 10 hyper-specific scenario questions.</p>
          </CardContent>
        </Card>
      )}

      {phase === "interview" && (
        <div className="max-w-4xl mx-auto w-full space-y-6">
           <div className="flex justify-between items-center">
               <Badge variant="outline" className="px-3 py-1 text-sm font-medium">
                   Question {currentQuestionIndex + 1} of {questions.length}
               </Badge>
           </div>
           
           <Card className="border-primary/20 shadow-lg">
               <CardHeader className="bg-primary/5 pb-8">
                   <CardTitle className="text-2xl leading-relaxed">
                       "{questions[currentQuestionIndex]}"
                   </CardTitle>
               </CardHeader>
               <CardContent className="pt-6 space-y-4">
                   <div className="flex justify-between items-end">
                       <label className="text-sm font-medium text-muted-foreground">Your Answer</label>
                       <Button 
                           variant={isRecording ? "destructive" : "outline"} 
                           size="sm" 
                           onClick={toggleRecording}
                           className="gap-2 rounded-full px-4"
                       >
                           {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                           {isRecording ? "Stop Recording" : "Speak Answer"}
                       </Button>
                   </div>
                   <Textarea 
                       placeholder="Type your answer here, or click 'Speak Answer' to use your microphone..." 
                       value={currentAnswer}
                       onChange={(e) => setCurrentAnswer(e.target.value)}
                       rows={8}
                       className="text-md leading-relaxed resize-none bg-background focus-visible:ring-1"
                   />
                   <div className="flex justify-end pt-4">
                       <Button size="lg" onClick={handleNextQuestion} className="px-8">
                           {currentQuestionIndex < questions.length - 1 ? "Submit & Next Question" : "Submit & Finish Interview"}
                       </Button>
                   </div>
               </CardContent>
           </Card>
        </div>
      )}

      {phase === "grading" && (
        <Card className="max-w-xl mx-auto w-full mt-12 border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <BrainCircuit className="h-12 w-12 text-primary animate-pulse mb-4" />
            <h3 className="text-xl font-bold">Grading Your Performance...</h3>
            <p className="text-muted-foreground mt-2">Comparing your answers against Senior-Level engineering standards.</p>
          </CardContent>
        </Card>
      )}

      {phase === "results" && (
        <div className="space-y-8 max-w-5xl mx-auto w-full">
            <div className="text-center space-y-2 mb-8">
                <h2 className="text-3xl font-bold">Interview Results</h2>
                <p className="text-muted-foreground">Review your scores and learn from the ideal answers.</p>
            </div>

            {gradingResults.map((result, idx) => (
                <Card key={idx} className="overflow-hidden border-muted">
                    <CardHeader className="bg-muted/30 border-b">
                        <div className="flex justify-between items-start gap-4">
                            <CardTitle className="text-lg leading-tight">
                                <span className="text-primary mr-2">Q{idx + 1}:</span>
                                {result.question}
                            </CardTitle>
                            <Badge variant={result.score >= 8 ? "default" : result.score >= 5 ? "secondary" : "destructive"} className="text-sm px-3 py-1">
                                Score: {result.score}/10
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-b">
                            <div className="p-6 space-y-2 bg-background">
                                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" /> Your Answer
                                </h4>
                                <p className="text-sm leading-relaxed">{result.userAnswer}</p>
                            </div>
                            <div className="p-6 space-y-2 bg-primary/5">
                                <h4 className="font-semibold text-sm text-primary uppercase tracking-wider flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" /> Ideal Senior Answer
                                </h4>
                                <p className="text-sm leading-relaxed">{result.idealAnswer}</p>
                            </div>
                        </div>
                        <div className="p-6 bg-muted/10">
                            <h4 className="font-semibold text-sm text-muted-foreground mb-2">Feedback</h4>
                            <p className="text-sm leading-relaxed">{result.feedback}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}

            <div className="flex justify-center pt-8 pb-12">
                <Button size="lg" onClick={() => setPhase("setup")}>Start Another Interview</Button>
            </div>
        </div>
      )}
        </TabsContent>
        <TabsContent value="history">
          <Card className="mt-6 border-dashed">
             <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <History className="h-12 w-12 mb-4 opacity-20" />
                <h3 className="text-xl font-medium mb-2">Past Interviews</h3>
                <p>All your graded interviews will be saved here automatically.</p>
                <p className="text-sm mt-4 text-primary">(Coming Soon: Historical viewing logic to be added in next commit)</p>
             </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function InterviewSimulatorPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <InterviewSimulatorContent />
    </Suspense>
  );
}
