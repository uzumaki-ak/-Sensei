"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  generateApplicationEmail,
  getGmailAuthUrl,
  getResumeRecommendations,
  requestTelegramApproval,
  sendOutreachEmail,
  updateRecruiterEmail,
} from "@/actions/jobs";
import { toast } from "sonner";
import { isHttpUrl } from "@/lib/jobs-ingestion";
import {
  Loader2,
  Mail,
  ExternalLink,
  Copy,
  CheckCheck,
  Send,
  Edit3,
  CheckCircle2,
  Upload,
  Sparkles,
  FileText,
  RefreshCw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

const COLUMNS = ["To Apply", "Applied", "Interviewing", "Offer", "Rejected"];

export default function JobCard({ app, onStatusChange, onRefresh, isGmailConnected }) {
  const [isGenerating, startTransition] = useTransition();
  const [isSending, setIsSending] = useState(false);
  const [isRequestingTelegramApproval, setIsRequestingTelegramApproval] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recruiterEmail, setRecruiterEmail] = useState(app.job.recruiterEmail || "");
  const [emailInput, setEmailInput] = useState(app.job.recruiterEmail || "");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftEmail, setDraftEmail] = useState(app.draftEmail || "");
  const [isEmailSent, setIsEmailSent] = useState(app.emailSent);
  const [currentResumeId, setCurrentResumeId] = useState(app.resumeId || null);
  const [selectedAttachment, setSelectedAttachment] = useState(app.attachmentId || null);
  const [attachmentName, setAttachmentName] = useState(app.attachmentName || null);
  const [isUploading, setIsUploading] = useState(false);

  // Resume selection state
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(app.resumeId || null);
  const [resumeRecommendations, setResumeRecommendations] = useState(null);
  const [isLoadingResumes, setIsLoadingResumes] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const canOpenSourceLink = isHttpUrl(app.job.sourceLink);
  const hasRecruiterEmail = Boolean(recruiterEmail);
  const hasDraftEmail = Boolean(draftEmail);
  const emailSent = isEmailSent;
  const effectiveAttachmentId = selectedAttachment;
  const hasResumeAttachment = Boolean(effectiveAttachmentId);

  useEffect(() => {
    setRecruiterEmail(app.job.recruiterEmail || "");
    setDraftEmail(app.draftEmail || "");
    setIsEmailSent(app.emailSent);
    setCurrentResumeId(app.resumeId || null);
    setSelectedAttachment(app.attachmentId || null);
    setAttachmentName(app.attachmentName || null);
    if (!isEditingEmail) {
      setEmailInput(app.job.recruiterEmail || "");
    }
  }, [
    app.job.recruiterEmail,
    app.draftEmail,
    app.emailSent,
    app.resumeId,
    app.attachmentId,
    app.attachmentName,
    isEditingEmail,
  ]);

  // Load resumes and recommendations when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      loadResumeRecommendations();
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (!selectedResumeId && currentResumeId) {
      setSelectedResumeId(currentResumeId);
    }
  }, [selectedResumeId, currentResumeId]);

  const loadResumeRecommendations = async () => {
    setIsLoadingResumes(true);
    try {
      const result = await getResumeRecommendations(app.id);
      setResumeRecommendations(result);
      setResumes(result.allScores.map(s => s.resume).filter(Boolean));
      if (result.recommendedResume && !selectedResumeId && !currentResumeId) {
        setSelectedResumeId(result.recommendedResume.id);
      }
    } catch (error) {
      console.error("Failed to load resume recommendations:", error);
    } finally {
      setIsLoadingResumes(false);
    }
  };

  const handleGenerateEmail = () => {
    startTransition(async () => {
      try {
        const result = await generateApplicationEmail(app.id, selectedResumeId);
        if (!result?.success) {
          toast.error(result?.error || "Failed to draft email for this job.");
          return;
        }

        setDraftEmail(result.draftEmail || "");
        setCurrentResumeId(result.resumeUsed?.id || selectedResumeId || null);
        setDialogOpen(false);
        toast.success(`AI Draft generated using "${result.resumeUsed?.name || "your resume"}"!`);
        await onRefresh?.();
      } catch (error) {
        toast.error(error.message);
      }
    });
  };

  const handleRegenerateWithResume = async () => {
    setIsRegenerating(true);
    try {
      const result = await generateApplicationEmail(app.id, selectedResumeId);
      if (!result?.success) {
        toast.error(result?.error || "Failed to regenerate email.");
        return;
      }

      setDraftEmail(result.draftEmail || "");
      setCurrentResumeId(result.resumeUsed?.id || selectedResumeId || null);
      toast.success(`Email regenerated with "${result.resumeUsed?.name}"!`);
      await onRefresh?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      const url = await getGmailAuthUrl();
      window.location.href = url;
    } catch (error) {
      toast.error("Failed to start Gmail auth");
    }
  };

  const handleSaveEmail = async () => {
    if (!emailInput || !emailInput.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    try {
      await updateRecruiterEmail(app.job.id, emailInput);
      setRecruiterEmail(emailInput.trim());
      toast.success("Email saved!");
      setIsEditingEmail(false);
      await onRefresh?.();
    } catch (error) {
      toast.error(error.message || "Failed to save email");
    }
  };

  const handleSendEmail = async () => {
    if (!hasResumeAttachment) {
      toast.error("Attach your resume file before sending.");
      return;
    }

    setIsSending(true);
    try {
      // Use custom email if edited, otherwise use the job's email
      const emailToUse = isEditingEmail ? emailInput : recruiterEmail;
      const result = await sendOutreachEmail(
        app.id,
        emailToUse || null,
        selectedAttachment || null
      );
      if (!result?.success) {
        toast.error(result?.error || "Failed to send outreach email.");
        return;
      }
      setIsEmailSent(true);
      toast.success("Email sent to recruiter!");
      setDialogOpen(false);
      await onRefresh?.();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleRequestTelegramApproval = async () => {
    if (!hasResumeAttachment) {
      toast.error("Attach your resume file before requesting Telegram approval.");
      return;
    }

    setIsRequestingTelegramApproval(true);
    try {
      const emailToUse = isEditingEmail ? emailInput : recruiterEmail;
      const result = await requestTelegramApproval(app.id, {
        recipientEmail: emailToUse || null,
        attachmentId: selectedAttachment || null,
      });
      if (!result?.success) {
        toast.error(result?.error || "Failed to send Telegram approval request.");
        return;
      }
      toast.success("Approval request sent to Telegram.");
    } catch (error) {
      toast.error(error.message || "Failed to send Telegram approval request.");
    } finally {
      setIsRequestingTelegramApproval(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["application/pdf", "application/msword", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF/DOC/DOCX files allowed");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("applicationId", app.id);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedAttachment(data.attachmentId);
        setAttachmentName(data.fileName);
        toast.success("Resume attached!");
        await onRefresh?.();
      } else {
        throw new Error("Upload failed");
      }
    } catch (error) {
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = async () => {
    if (!selectedAttachment) {
      return;
    }
    try {
      await fetch(`/api/upload?id=${selectedAttachment}`, {
        method: "DELETE",
      });
      setSelectedAttachment(null);
      setAttachmentName(null);
      toast.success("Attachment removed");
      await onRefresh?.();
    } catch (error) {
      toast.error("Failed to remove attachment");
    }
  };

  const copyToClipboard = () => {
    if (!draftEmail) return;
    navigator.clipboard.writeText(draftEmail);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="hover:border-primary/50 transition-all shadow-sm bg-card border-muted group relative">
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-md font-bold leading-tight line-clamp-1">{app.job.title}</CardTitle>
            <p className="text-sm text-muted-foreground font-medium">{app.job.company}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        <div className="flex flex-wrap gap-1.5 mt-2">
          {app.job.techStack?.map((tech) => (
            <Badge variant="secondary" key={tech} className="text-[10px] uppercase font-bold py-0 h-5">
              {tech}
            </Badge>
          ))}
        </div>
        
        {app.job.description && (
          <p className="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed italic">
            "{app.job.description}"
          </p>
        )}
      </CardContent>

      <CardFooter className="p-4 pt-2 border-t flex flex-col gap-3 bg-muted/5">
        <div className="flex justify-between items-center w-full">
           {canOpenSourceLink ? (
             <a 
              href={app.job.sourceLink} 
              target="_blank" 
              rel="noreferrer" 
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
             >
               <ExternalLink className="h-3 w-3" />
               Verify Link
             </a>
           ) : (
             <span className="text-xs text-muted-foreground">Source: Screenshot upload</span>
           )}
           
           <Select value={app.status} onValueChange={(val) => onStatusChange(app.id, val)}>
             <SelectTrigger className="w-[110px] h-7 text-[10px] font-bold bg-background">
               <SelectValue />
             </SelectTrigger>
             <SelectContent>
               {COLUMNS.map(c => (
                 <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
               ))}
             </SelectContent>
           </Select>
        </div>

        <div className="flex gap-2 w-full">
          {hasDraftEmail ? (
             <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
               <DialogTrigger asChild>
                 <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-2">
                   <Mail className="h-3 w-3" />
                   {emailSent ? (
                     <span className="flex items-center gap-1">
                       <CheckCircle2 className="h-3 w-3 text-green-500" />
                       Email Sent
                     </span>
                   ) : (
                     "See Email"
                   )}
                 </Button>
               </DialogTrigger>
               <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
                 <DialogHeader>
                   <DialogTitle>AI Generated Cold Email</DialogTitle>
                   <DialogDescription>
                     Personalized for {app.job.company} based on selected resume profile.
                   </DialogDescription>
                 </DialogHeader>

                 {/* Resume Selection Section */}
                 {hasDraftEmail && (
                   <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg border border-primary/20">
                     <div className="flex items-center justify-between mb-3">
                       <label className="text-xs font-bold text-primary uppercase flex items-center gap-1">
                         <Sparkles className="h-3 w-3" />
                         Resume Profile Used
                       </label>
                       {isLoadingResumes && <Loader2 className="h-3 w-3 animate-spin" />}
                     </div>

                     {resumes.length > 0 ? (
                       <div className="space-y-3">
                         <Select
                           value={selectedResumeId || ""}
                           onValueChange={(val) => {
                             setSelectedResumeId(val);
                           }}
                         >
                           <SelectTrigger className="bg-background">
                             <SelectValue placeholder="Select a resume profile" />
                           </SelectTrigger>
                           <SelectContent>
                             {resumes.map((resume) => (
                               <SelectItem key={resume.id} value={resume.id}>
                                 <div className="flex items-center gap-2">
                                   <FileText className="h-3 w-3" />
                                   <span>{resume.name}</span>
                                   {resume.type && (
                                     <Badge variant="secondary" className="text-[10px]">{resume.type}</Badge>
                                   )}
                                   {resume.isDefault && (
                                     <Badge variant="outline" className="text-[10px]">Default</Badge>
                                   )}
                                 </div>
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>

                         {resumeRecommendations?.recommendedResume && (
                           <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded">
                             <span className="font-medium">AI Recommendation: </span>
                             {resumeRecommendations.message}
                           </div>
                         )}

                        {selectedResumeId && selectedResumeId !== currentResumeId && (
                           <Button
                             size="sm"
                             variant="secondary"
                             onClick={handleRegenerateWithResume}
                             disabled={isRegenerating}
                             className="w-full"
                           >
                             {isRegenerating ? (
                               <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Regenerating...</>
                             ) : (
                               <><RefreshCw className="h-3 w-3 mr-1" /> Regenerate with Selected Resume</>
                             )}
                           </Button>
                         )}
                       </div>
                     ) : (
                       <p className="text-sm text-muted-foreground">No resumes found. Create resumes in the Resume Builder.</p>
                     )}
                   </div>
                 )}

                 {/* Email Input Section */}
                 <div className="bg-muted/50 p-4 rounded-lg border">
                   <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">
                     Recipient Email
                   </label>
                   {isEditingEmail ? (
                     <div className="flex gap-2">
                       <Input
                         type="email"
                         placeholder="recruiter@company.com"
                         value={emailInput}
                         onChange={(e) => setEmailInput(e.target.value)}
                         className="flex-1"
                       />
                       <Button size="sm" onClick={handleSaveEmail}>
                         <CheckCheck className="h-4 w-4" />
                       </Button>
                     </div>
                   ) : (
                     <div className="flex items-center justify-between">
                       <span className={`text-sm ${hasRecruiterEmail ? 'text-foreground' : 'text-amber-600'}`}>
                        {hasRecruiterEmail ? recruiterEmail : "No email found - click edit to add"}
                       </span>
                       <Button
                         size="sm"
                         variant="ghost"
                         onClick={() => {
                          setEmailInput(recruiterEmail || "");
                          setIsEditingEmail(true);
                        }}
                       >
                         <Edit3 className="h-4 w-4" />
                       </Button>
                     </div>
                   )}
                 </div>

                  {/* Attachment Section */}
                  <div className="bg-muted/50 p-4 rounded-lg border mt-4">
                    <label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">
                      Attachment (Resume/CV)
                    </label>
                    
                    {attachmentName ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm flex items-center gap-2">
                          <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          {attachmentName}
                        </span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={handleRemoveAttachment}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-background hover:bg-muted/50 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-2 pb-2">
                            <svg className="w-6 h-6 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-xs text-gray-500">
                              {isUploading ? "Uploading..." : "Click to upload resume (PDF/DOCX)"}
                            </p>
                          </div>
                          <input 
                            type="file" 
                            className="hidden" 
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Regenerate Email Button */}
                  {hasDraftEmail && !emailSent && (
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegenerateWithResume}
                        disabled={isRegenerating}
                        className="w-full gap-2 border-dashed"
                      >
                        {isRegenerating ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Regenerating email...</>
                        ) : (
                          <><RefreshCw className="h-3.5 w-3.5" /> Regenerate Email{selectedResumeId ? " with Selected Resume" : ""}</>
                        )}
                      </Button>
                    </div>
                  )}

                 <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm font-mono border mt-4">
                    {draftEmail}
                  </div>
                 <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={copyToClipboard} className="gap-2">
                      {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy Content"}
                    </Button>

                    {!emailSent ? (
                      <Button
                        variant="secondary"
                        onClick={handleRequestTelegramApproval}
                        disabled={
                          isRequestingTelegramApproval ||
                          !isGmailConnected ||
                          (!hasRecruiterEmail && !emailInput) ||
                          !hasResumeAttachment
                        }
                        className="gap-2"
                      >
                        {isRequestingTelegramApproval ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Sending to Telegram...</>
                        ) : (
                          "Approve in Telegram"
                        )}
                      </Button>
                    ) : null}

                    {emailSent ? (
                      <Button disabled variant="secondary" className="gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Sent {app.emailSentAt ? `on ${new Date(app.emailSentAt).toLocaleDateString()}` : "just now"}
                      </Button>
                    ) : isGmailConnected ? (
                      <Button
                        onClick={handleSendEmail}
                        disabled={
                          isSending ||
                          (!hasRecruiterEmail && !emailInput) ||
                          !hasResumeAttachment
                        }
                        className="gap-2 bg-blue-600 hover:bg-blue-700"
                      >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Send to Recruiter
                      </Button>
                    ) : (
                      <Button onClick={handleConnectGmail} variant="secondary" className="gap-2">
                        Connect Gmail to Send
                      </Button>
                    )}
                 </div>
                 {!hasResumeAttachment ? (
                   <p className="mt-2 text-xs text-amber-600">
                     Resume profile is selected, but a PDF/DOCX file is still required to send via Gmail/Telegram approval.
                   </p>
                 ) : null}
                 {(!hasRecruiterEmail && !emailInput) ? (
                   <p className="mt-2 text-xs text-amber-600">
                     Add a recipient email above to continue.
                   </p>
                 ) : null}
               </DialogContent>
             </Dialog>
          ) : (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs gap-2"
                  disabled={isGenerating}
                >
                  {isGenerating ? <Loader2 className="animate-spin h-3 w-3" /> : <Mail className="h-3 w-3" />}
                  Draft with AI
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Generate Cold Email
                  </DialogTitle>
                  <DialogDescription>
                    AI will analyze the job and select the best matching resume profile.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="text-sm font-semibold mb-2">{app.job.title}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{app.job.company}</p>
                    <div className="flex flex-wrap gap-1">
                      {app.job.techStack?.slice(0, 5).map((tech) => (
                        <Badge key={tech} variant="secondary" className="text-[10px]">{tech}</Badge>
                      ))}
                    </div>
                  </div>

                  {isLoadingResumes ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing job requirements...
                    </div>
                  ) : resumeRecommendations && resumes.length > 0 ? (
                    <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg border border-primary/20">
                      <label className="text-xs font-bold text-primary uppercase mb-3 block">
                        Select Resume Profile
                      </label>

                      <Select
                        value={selectedResumeId || ""}
                        onValueChange={setSelectedResumeId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a resume" />
                        </SelectTrigger>
                        <SelectContent>
                          {resumes.map((resume) => {
                            const score = resumeRecommendations.allScores?.find(s => s.resumeId === resume.id);
                            return (
                              <SelectItem key={resume.id} value={resume.id}>
                                <div className="flex items-center justify-between w-full gap-4">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span>{resume.name}</span>
                                  </div>
                                  {score && (
                                    <div className="flex items-center gap-2">
                                      <Progress value={score.overallScore} className="w-16 h-1.5" />
                                      <span className="text-xs text-muted-foreground">{score.overallScore}%</span>
                                    </div>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                      {resumeRecommendations.recommendedResume && selectedResumeId === resumeRecommendations.recommendedResume.id && (
                        <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                          <CheckCheck className="h-3 w-3" />
                          AI Recommended: Best match for this role
                        </div>
                      )}

                      {resumeRecommendations.jobAnalysis && (
                        <div className="mt-3 pt-3 border-t border-primary/10">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Detected Role: </span>
                            {resumeRecommendations.jobAnalysis.roleType}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Domain: </span>
                            {resumeRecommendations.jobAnalysis.domainFocus}
                          </p>
                        </div>
                      )}

                      {/* Attachment upload within the resume section */}
                      <div className="mt-3 pt-3 border-t border-primary/10">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block">
                          Attach Resume PDF (Optional)
                        </label>
                        {attachmentName ? (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-primary">
                              <Upload className="h-3 w-3" />
                              {attachmentName}
                            </span>
                            <Button size="sm" variant="ghost" onClick={handleRemoveAttachment} className="h-6 text-[10px] text-red-500 hover:text-red-700">
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center w-full h-10 border border-dashed border-primary/30 rounded-md cursor-pointer bg-background hover:bg-muted/50 transition-colors text-xs text-muted-foreground gap-2">
                            <Upload className="h-3 w-3" />
                            {isUploading ? "Uploading..." : "Click to attach PDF/DOCX"}
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,.doc,.docx"
                              onChange={handleFileUpload}
                              disabled={isUploading}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/50 p-4 rounded-lg border border-dashed text-center space-y-3">
                      <p className="text-sm text-muted-foreground">
                        No resume profiles found. Create one in Resume Studio first so AI can personalize your email.
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Route: /resume
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 text-xs"
                          onClick={() => window.open("/resume", "_blank")}
                        >
                          <FileText className="h-3 w-3" />
                          Build Resume
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        After creating a resume profile, reopen this dialog. Resume file attachment upload appears in the email preview step.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleGenerateEmail}
                      disabled={isGenerating || !selectedResumeId}
                      className="gap-2"
                    >
                      {isGenerating ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="h-4 w-4" /> Generate Email</>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
