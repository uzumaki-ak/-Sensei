"use client";

import { forwardRef, useState, useRef, useEffect, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  Bot,
  User,
  ChevronRight,
  ChevronLeft,
  Download,
  RefreshCw,
  FileText,
  CheckCircle2,
  Briefcase,
  LayoutTemplate,
  Save,
  Search,
  Maximize2,
  X,
} from "lucide-react";
import {
  generateResumeQuestions,
  buildResumeFromAnswers,
  refineResume,
  saveTailoredResume,
} from "@/actions/resume-maker";
import { getJobsForTailoring } from "@/actions/resume";
import { TEMPLATES } from "./resume-templates";

const STEPS = ["select-job", "answer-questions", "review", "pick-template", "download"];

const AIResumeMaker = forwardRef(function AIResumeMaker(_props, ref) {
  const [step, setStep] = useState("select-job");
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  // Q&A state
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isGeneratingQs, setIsGeneratingQs] = useState(false);

  // Resume state
  const [resumeData, setResumeData] = useState(null);
  const [isBuildingResume, setIsBuildingResume] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState("professional");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const resumePreviewRef = useRef(null);
  const scrollRef = useRef(null);

  // Load jobs on mount
  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const result = await getJobsForTailoring();
      setJobs(result);
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  };

  const [jobSearch, setJobSearch] = useState("");
  const filteredJobs = jobs.filter(app => 
    app.job.title.toLowerCase().includes(jobSearch.toLowerCase()) || 
    app.job.company.toLowerCase().includes(jobSearch.toLowerCase())
  );

  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  // ── Step 1: Select Job ──
  const handleSelectJob = async (app) => {
    setSelectedApp(app);
    setIsGeneratingQs(true);
    setStep("answer-questions");
    try {
      const result = await generateResumeQuestions(app.id);
      setQuestions(result.questions);
      setAnswers(new Array(result.questions.length).fill(""));
      setCurrentQ(0);
    } catch (error) {
      toast.error(error.message);
      setStep("select-job");
    } finally {
      setIsGeneratingQs(false);
    }
  };

  // ── Step 2: Answer questions ──
  const handleSubmitAnswer = () => {
    if (!currentAnswer.trim()) return;
    const newAnswers = [...answers];
    newAnswers[currentQ] = currentAnswer.trim();
    setAnswers(newAnswers);
    setCurrentAnswer("");

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    }
  };

  const handleSkipQuestion = () => {
    const newAnswers = [...answers];
    newAnswers[currentQ] = "(skipped)";
    setAnswers(newAnswers);
    setCurrentAnswer("");
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    }
  };

  const handleBuildResume = async () => {
    setIsBuildingResume(true);
    setStep("review");
    try {
      const qa = questions.map((q, i) => ({ question: q, answer: answers[i] || "(not answered)" }));
      const data = await buildResumeFromAnswers({
        jobApplicationId: selectedApp.id,
        answers: qa,
      });
      setResumeData(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsBuildingResume(false);
    }
  };

  // ── Step 3: Review & refine ──
  const handleRefine = async () => {
    if (!refineFeedback.trim()) return;
    setIsRefining(true);
    try {
      const updated = await refineResume({
        currentData: resumeData,
        feedback: refineFeedback.trim(),
        jobApplicationId: selectedApp.id,
      });
      setResumeData(updated);
      setRefineFeedback("");
      toast.success("Resume updated!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsRefining(false);
    }
  };

  // ── Step 4: Template selection ──
  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default || html2pdfModule;
      
      const element = document.getElementById("pdf-resume-preview");
      if (!element) throw new Error("Preview not found");

      const opt = {
        margin: [8, 4],
        filename: `${resumeData?.name || "resume"}_${selectedTemplate}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("PDF downloaded!");
    } catch (error) {
      console.error("PDF error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveResume = async () => {
    if (!selectedApp || !resumeData) {
      toast.error("Build your AI resume first, then save it.");
      return false;
    }

    setIsSaving(true);
    try {
      await saveTailoredResume({
        resumeData,
        jobApplicationId: selectedApp.id,
      });
      toast.success("Resume saved! You can now use it for email attachments.");
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    saveFromToolbar: async () => {
      if (isSaving) {
        toast.info("Already saving AI resume...");
        return false;
      }
      return handleSaveResume();
    },
  }));

  const answeredCount = answers.filter((a) => a && a !== "").length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const SelectedTemplateComponent = TEMPLATES.find((t) => t.id === selectedTemplate)?.Component;

  // ─────────────────── RENDER ───────────────────
  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        {STEPS.map((s, i) => {
          const labels = ["Select Job", "Answer Questions", "Review Resume", "Pick Template", "Download"];
          const icons = [Briefcase, FileText, CheckCircle2, LayoutTemplate, Download];
          const Icon = icons[i];
          const isActive = s === step;
          const isPast = STEPS.indexOf(step) > i;
          return (
            <div
              key={s}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${isActive ? "text-primary" : isPast ? "text-primary/60" : "text-muted-foreground/40"}`}
            >
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? "bg-primary text-primary-foreground" : isPast ? "bg-primary/20 text-primary" : "bg-muted"}`}>
                {isPast ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
              </div>
              <span className="hidden sm:inline">{labels[i]}</span>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30 ml-1" />}
            </div>
          );
        })}
      </div>

      {/* ── Step: Select Job ── */}
      {step === "select-job" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Select a job to tailor your resume</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pick a job from your pipeline. AI will ask you targeted questions based on the job requirements.
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search jobs or companies..."
                className="pl-8 w-full sm:w-[250px]"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
              />
            </div>
          </div>

          {loadingJobs ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-xl bg-muted/10">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No jobs found. Add jobs to your pipeline first from the Kanban board.</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-xl bg-muted/10">
              <p className="text-sm">No jobs match your search.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-muted/50 uppercase border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Job Title</th>
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">Tech Stack</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((app) => (
                      <tr 
                        key={app.id} 
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => handleSelectJob(app)}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">{app.job.title}</td>
                        <td className="px-4 py-3 text-muted-foreground">{app.job.company}</td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {app.job.techStack && app.job.techStack.length > 0 ? (
                              <>
                                {app.job.techStack.slice(0, 3).map((t) => (
                                  <Badge key={t} variant="secondary" className="text-[9px] py-0">{t}</Badge>
                                ))}
                                {app.job.techStack.length > 3 && (
                                  <span className="text-[10px] text-muted-foreground">+{app.job.techStack.length - 3}</span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Not specified</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                            Select <ChevronRight className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step: Answer Questions ── */}
      {step === "answer-questions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold leading-tight">
                  {selectedApp?.job?.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{selectedApp?.job?.company}</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
                  <span className="text-primary font-medium flex items-center gap-1">
                    <Bot className="h-3 w-3" /> AI Context Active
                  </span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setStep("select-job"); setQuestions([]); setAnswers([]); }}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
          </div>

          {isGeneratingQs ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">AI is analyzing the job and preparing questions...</p>
            </div>
          ) : (
            <>
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground text-right">{answeredCount} of {questions.length} answered</p>

              {/* Chat-like Q&A */}
              <div className="border rounded-xl overflow-hidden bg-card">
                <div ref={scrollRef} className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                  {questions.slice(0, currentQ + 1).map((q, i) => (
                    <div key={i} className="space-y-2">
                      {/* Question */}
                      <div className="flex gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="bg-muted/70 border rounded-xl px-3.5 py-2.5 text-sm max-w-[85%]">{q}</div>
                      </div>
                      {/* Answer (if given) */}
                      {answers[i] && answers[i] !== "" && (
                        <div className="flex gap-2.5 justify-end">
                          <div className="bg-primary text-primary-foreground rounded-xl px-3.5 py-2.5 text-sm max-w-[85%]">
                            {answers[i]}
                          </div>
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            <User className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div className="border-t p-3 bg-muted/10">
                  <div className="flex gap-2">
                    <Textarea
                      value={currentAnswer}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmitAnswer(); } }}
                      placeholder={`Answer question ${currentQ + 1}...`}
                      className="min-h-[40px] max-h-[100px] resize-none text-sm"
                      rows={1}
                    />
                    <div className="flex flex-col gap-1">
                      <Button size="icon" onClick={handleSubmitAnswer} disabled={!currentAnswer.trim()} className="h-8 w-8">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={handleSkipQuestion} className="h-8 w-8 text-muted-foreground text-[9px]" title="Skip">
                        Skip
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Build button */}
              {answeredCount >= Math.max(3, Math.floor(questions.length * 0.5)) && (
                <Button onClick={handleBuildResume} disabled={isBuildingResume} className="w-full gap-2">
                  {isBuildingResume ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Building your resume...</>
                  ) : (
                    <><FileText className="h-4 w-4" /> Build My Resume ({answeredCount}/{questions.length} answered)</>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Step: Review ── */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Review Your Resume</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("answer-questions")}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={() => setStep("pick-template")} disabled={!resumeData} className="gap-1.5">
                Pick Template <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {isBuildingResume ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground animate-pulse">AI is crafting your resume...</p>
            </div>
          ) : resumeData ? (
            <>
              {/* Quick preview using the professional template */}
              <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="max-h-[500px] overflow-y-auto">
                  {(() => { const T = TEMPLATES.find((t) => t.id === "professional")?.Component; return T ? <T data={resumeData} /> : null; })()}
                </div>
              </div>

              {/* Refine */}
              <div className="flex gap-2">
                <Textarea
                  value={refineFeedback}
                  onChange={(e) => setRefineFeedback(e.target.value)}
                  placeholder="Ask AI to make changes... e.g. 'Add more metrics to experience', 'Make summary shorter', 'Add a Python project'"
                  className="text-sm min-h-[40px] max-h-[100px] resize-none"
                  rows={1}
                />
                <Button onClick={handleRefine} disabled={isRefining || !refineFeedback.trim()} className="shrink-0 gap-1.5">
                  {isRefining ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refine
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Step: Pick Template ── */}
      {step === "pick-template" && resumeData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Choose a Template</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("review")}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={() => setStep("download")} className="gap-1.5">
                Continue <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Template Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {TEMPLATES.map((t) => (
              <div key={t.id} className="relative group">
                <button
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`w-full relative border-2 rounded-xl p-3 text-left transition-all hover:shadow-md bg-card ${selectedTemplate === t.id ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-muted hover:border-muted-foreground/30"}`}
                >
                  {selectedTemplate === t.id && (
                    <div className="absolute top-2 right-2 z-10">
                      <CheckCircle2 className="h-5 w-5 text-primary fill-background" />
                    </div>
                  )}
                  <div className="h-[140px] border rounded-lg overflow-hidden bg-white mb-3 relative">
                    <div style={{ transform: "scale(0.35)", transformOrigin: "top left", width: "285%", height: "auto", minHeight: 400 }}>
                      <t.Component data={resumeData} />
                    </div>
                    {/* Hover Overlay for Fullscreen */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="h-8 gap-1 shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTemplate(t.id);
                          setIsFullscreenPreview(true);
                        }}
                      >
                        <Maximize2 className="h-3.5 w-3.5" /> Preview
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm font-semibold mt-1">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.description}</p>
                </button>
              </div>
            ))}
          </div>

          {/* Fullscreen Preview Modal */}
          {isFullscreenPreview && SelectedTemplateComponent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8 backdrop-blur-sm">
              <div className="bg-background rounded-xl w-full max-w-5xl h-full flex flex-col overflow-hidden shadow-2xl relative">
                <div className="flex items-center justify-between p-4 border-b">
                  <div>
                    <h3 className="font-semibold">{TEMPLATES.find(t => t.id === selectedTemplate)?.name} Template</h3>
                    <p className="text-xs text-muted-foreground">Full Preview</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setIsFullscreenPreview(false); setStep("download"); }} className="gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Select & Continue
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setIsFullscreenPreview(false)}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto bg-muted p-4 sm:p-8 flex justify-center">
                  <div className="bg-white shadow-lg shrink-0" style={{ width: 800 }}>
                    <SelectedTemplateComponent data={resumeData} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step: Download ── */}
      {step === "download" && resumeData && SelectedTemplateComponent && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Final Preview — {TEMPLATES.find((t) => t.id === selectedTemplate)?.name}</h2>
            <Button variant="ghost" size="sm" onClick={() => setStep("pick-template")}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Change Template
            </Button>
          </div>

          {/* Full Preview */}
          <div className="border rounded-xl overflow-hidden bg-white shadow-lg">
            <div id="pdf-resume-preview" className="bg-white">
              <SelectedTemplateComponent data={resumeData} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={handleDownloadPDF} disabled={isDownloading} className="flex-1 gap-2">
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </Button>
            <Button variant="outline" onClick={handleSaveResume} disabled={isSaving} className="flex-1 gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save to My Resumes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

export default AIResumeMaker;
