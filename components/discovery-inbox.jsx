"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Check, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { getPusherClient } from "@/lib/pusher";
import { updateApplicationStatus } from "@/actions/jobs";
import { isHttpUrl } from "@/lib/jobs-ingestion";

export default function DiscoveryInbox({ initialJobs = [], userId, onShortlist }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 6;

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(jobs.length / jobsPerPage));
    setCurrentPage((prev) => Math.min(prev, nextTotalPages));
  }, [jobs, jobsPerPage]);

  useEffect(() => {
    if (!userId) return;

    try {
      const pusher = getPusherClient();
      if (!pusher) {
        console.log("[DiscoveryInbox] Pusher client not available");
        return;
      }

      const channelName = `user-${userId}`;
      const channel = pusher.subscribe(channelName);
      const handler = (newJob) => {
        setJobs((prev) => [newJob, ...prev]);
        toast("New job discovered", {
          description: `${newJob.job.title} at ${newJob.job.company}`,
        });
      };

      channel.bind("job-discovered", handler);

      return () => {
        try {
          channel.unbind("job-discovered", handler);
          pusher.unsubscribe(channelName);
        } catch (cleanupError) {
          console.error("[DiscoveryInbox] Cleanup error:", cleanupError);
        }
      };
    } catch (error) {
      console.error("[DiscoveryInbox] Pusher setup error:", error);
    }
  }, [userId]);

  const handleAction = async (jobId, action) => {
    try {
      if (action === "shortlist") {
        await updateApplicationStatus(jobId, "To Apply");
        toast.success("Moved to pipeline");
        onShortlist?.();
      }

      setJobs((prev) => prev.filter((job) => job.id !== jobId));
    } catch {
      toast.error("Failed to update job");
    }
  };

  if (jobs.length === 0) return null;

  const totalPages = Math.ceil(jobs.length / jobsPerPage);
  const paginatedJobs = jobs.slice((currentPage - 1) * jobsPerPage, currentPage * jobsPerPage);

  return (
    <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-5 w-5 fill-yellow-500 text-yellow-500" />
        <h2 className="text-xl font-bold tracking-tight">Scout Inbox</h2>
        <Badge variant="secondary" className="rounded-full px-3">
          {jobs.length} New
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paginatedJobs.map((job) => (
          <Card
            key={job.id}
            className="group border-2 border-dashed bg-muted/30 transition-colors hover:border-primary/50"
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="line-clamp-1 text-sm font-bold">{job.job.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{job.job.company}</p>
                </div>
                {isHttpUrl(job.job.sourceLink) ? (
                  <a
                    href={job.job.sourceLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-0">
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  className="h-8 flex-1 gap-1 bg-green-600/90 text-[10px] font-bold hover:bg-green-600"
                  onClick={() => handleAction(job.id, "shortlist")}
                >
                  <Check className="h-3 w-3" />
                  Shortlist
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                  onClick={() => handleAction(job.id, "ignore")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * jobsPerPage + 1}-{Math.min(currentPage * jobsPerPage, jobs.length)} of{" "}
            {jobs.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentPage}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 border-b border-muted" />
    </div>
  );
}
