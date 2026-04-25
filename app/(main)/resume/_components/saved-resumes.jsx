"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, FileText, CheckCircle2 } from "lucide-react";
import { getAllResumes, deleteResume } from "@/actions/resume-maker";

export default function SavedResumes() {
  const [resumes, setResumes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadResumes();
  }, []);

  const loadResumes = async () => {
    setIsLoading(true);
    try {
      const data = await getAllResumes();
      setResumes(data);
    } catch (error) {
      toast.error("Failed to load saved resumes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this resume?")) return;
    
    setDeletingId(id);
    try {
      await deleteResume(id);
      setResumes(resumes.filter(r => r.id !== id));
      toast.success("Resume deleted");
    } catch (error) {
      toast.error("Failed to delete resume");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Loading saved resumes...</p>
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No saved resumes found.</p>
        <p className="text-xs mt-1">Use the AI Resume Maker to generate and save tailored resumes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">My Resumes</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your saved tailored resumes here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resumes.map((resume) => (
          <Card key={resume.id} className="relative group overflow-hidden">
            {resume.isDefault && (
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                DEFAULT
              </div>
            )}
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2">{resume.name}</h3>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(resume.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex gap-1 flex-wrap">
                {resume.type && (
                  <Badge variant="secondary" className="text-[9px] py-0">{resume.type}</Badge>
                )}
                {resume.atsScore && (
                  <Badge variant="outline" className="text-[9px] py-0 border-green-500 text-green-600">
                    ATS: {Math.round(resume.atsScore)}%
                  </Badge>
                )}
              </div>

              <div className="mt-auto pt-4 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => {
                  toast.info("This will be viewable in the form tab if you select it in the future.");
                }}>
                  View Raw
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(resume.id)}
                  disabled={deletingId === resume.id}
                >
                  {deletingId === resume.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
