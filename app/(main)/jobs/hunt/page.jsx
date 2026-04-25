"use client";

import {
  runMyNightlyHunt,
  scrapeJobFromImage,
  scrapeJobUrl,
  updateApplicationStatus,
} from "@/actions/jobs";
import DiscoveryInbox from "@/components/discovery-inbox";
import PersonaManagement from "@/components/persona-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJobsData } from "@/hooks/use-jobs-data";
import { isHttpUrl } from "@/lib/jobs-ingestion";
import {
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  PlayCircle,
  PlusCircle,
  Search,
} from "lucide-react";
import { useMemo, useRef, useState, useTransition, useEffect, Suspense } from "react";
import { toast } from "sonner";

const STATUS_OPTIONS = ["All", "Discovered", "To Apply", "Applied", "Interviewing", "Offer", "Rejected"];

function JobsHuntContent() {
  const { applications, personas, userId, loading, loadJobs } = useJobsData();
  const [urlInput, setUrlInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isPending, startTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 20;
  const fileInputRef = useRef(null);

  const discoveredApplications = useMemo(
    () => applications.filter((application) => application.status === "Discovered"),
    [applications]
  );

  const filteredFeed = useMemo(() => {
    return applications.filter((application) => {
      const query = searchTerm.trim().toLowerCase();
      const matchesQuery =
        !query ||
        [application.job.title, application.job.company, application.job.sourceLink, ...(application.job.techStack || [])]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesStatus = statusFilter === "All" ? true : application.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [applications, searchTerm, statusFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredFeed.length / jobsPerPage);
  const paginatedFeed = useMemo(() => {
    const start = (currentPage - 1) * jobsPerPage;
    return filteredFeed.slice(start, start + jobsPerPage);
  }, [filteredFeed, currentPage, jobsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const stats = useMemo(
    () => ({
      total: applications.length,
      discovered: discoveredApplications.length,
      toApply: applications.filter((application) => application.status === "To Apply").length,
      applied: applications.filter((application) => application.status === "Applied").length,
    }),
    [applications, discoveredApplications.length]
  );

  const handleRunHunt = () => {
    startTransition(async () => {
      try {
        const result = await runMyNightlyHunt();
        await loadJobs(true);
        toast.success(
          `Hunt completed: ${result.createdApplications} new, ${result.refreshedApplications} refreshed, ${result.failedUrls} failed`
        );
      } catch (error) {
        toast.error(error.message || "Failed to run midnight hunt");
      }
    });
  };

  const handleScrapeJob = () => {
    if (!urlInput.trim()) {
      toast.error("Please enter a direct job URL");
      return;
    }

    startTransition(async () => {
      try {
        const result = await scrapeJobUrl(urlInput.trim());
        setUrlInput("");
        await loadJobs(true);
        toast.success(result.alreadyExists ? "Job already exists, updated details" : "Job scraped and added");
      } catch (error) {
        toast.error(error.message || "Failed to scrape job");
      }
    });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (fileEvent) => {
      const base64 = fileEvent.target?.result;
      startTransition(async () => {
        try {
          await scrapeJobFromImage(base64);
          await loadJobs(true);
          toast.success("Screenshot parsed and added");
        } catch (error) {
          toast.error(error.message || "Failed to read screenshot");
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      });
    };

    reader.readAsDataURL(file);
  };

  const handleStatusChange = async (applicationId, nextStatus) => {
    try {
      await updateApplicationStatus(applicationId, nextStatus);
      await loadJobs(true);
      toast.success("Status updated");
    } catch (error) {
      toast.error(error.message || "Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="animate-pulse text-muted-foreground">Loading jobs...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <h1 className="mb-2 text-4xl font-extrabold tracking-tight">Midnight Job Hunt</h1>
            <p className="mb-4 text-muted-foreground">
              Multi-source job discovery with scraper-first pipeline and API fallbacks.
            </p>
            <div className="flex flex-wrap gap-2">
              <PersonaManagement initialPersonas={personas} onUpdate={loadJobs} />
              <Button onClick={handleRunHunt} disabled={isPending} className="gap-2">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Run Hunt Now
              </Button>
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">Total Jobs</p>
                <p className="text-2xl font-black">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">Discovered</p>
                <p className="text-2xl font-black">{stats.discovered}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">To Apply</p>
                <p className="text-2xl font-black">{stats.toApply}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs uppercase text-muted-foreground">Applied</p>
                <p className="text-2xl font-black">{stats.applied}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card p-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Paste direct job URL (LinkedIn / Indeed / Internshala / etc)"
                    value={urlInput}
                    onChange={(event) => setUrlInput(event.target.value)}
                    className="h-11 border-none bg-background pl-9 focus-visible:ring-1"
                    onKeyDown={(event) => event.key === "Enter" && handleScrapeJob()}
                  />
                </div>
                <Button onClick={handleScrapeJob} disabled={isPending} className="h-11 rounded-xl px-5">
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Scrape
                    </span>
                  )}
                </Button>
              </div>

              <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
              />
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl border-dashed px-6 hover:bg-muted lg:w-auto"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                OCR Screenshot
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <DiscoveryInbox initialJobs={discoveredApplications} userId={userId} onShortlist={loadJobs} />

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg">All Jobs Feed</CardTitle>
          <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search role, company, stack..."
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary">{filteredFeed.length} jobs</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Stack</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeed.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No jobs match current filters.
                    </td>
                  </tr>
                 ) : (
                   paginatedFeed.map((application) => (
                    <tr key={application.id} className="border-b align-top last:border-b-0">
                      <td className="px-4 py-4">
                        <p className="font-semibold">{application.job.title}</p>
                        <p className="text-xs text-muted-foreground">{application.job.company}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(application.job.techStack || []).slice(0, 4).map((tech) => (
                            <Badge key={tech} variant="outline" className="text-[10px] uppercase">
                              {tech}
                            </Badge>
                          ))}
                          {(application.job.techStack || []).length === 0 ? (
                            <span className="text-xs text-muted-foreground">Not extracted</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Select
                          value={application.status}
                          onValueChange={(value) => handleStatusChange(application.id, value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.filter((status) => status !== "All").map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-4">
                        {isHttpUrl(application.job.sourceLink) ? (
                          <a
                            href={application.job.sourceLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Screenshot</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-muted-foreground">
                        {new Date(application.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
               </tbody>
             </table>
           </div>
           
           {/* Pagination Controls */}
           {totalPages > 1 && (
             <div className="flex items-center justify-center gap-2 p-4 border-t">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                 disabled={currentPage === 1}
               >
                 Previous
               </Button>
               <span className="text-sm text-muted-foreground">
                 Page {currentPage} of {totalPages} ({filteredFeed.length} jobs)
               </span>
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                 disabled={currentPage === totalPages}
               >
                 Next
               </Button>
             </div>
           )}

          <div className="space-y-3 p-4 md:hidden">
            {filteredFeed.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No jobs match current filters.</p>
             ) : (
               paginatedFeed.map((application) => (
                <Card key={application.id}>
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <p className="font-semibold">{application.job.title}</p>
                      <p className="text-xs text-muted-foreground">{application.job.company}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(application.job.techStack || []).slice(0, 3).map((tech) => (
                        <Badge key={tech} variant="outline" className="text-[10px] uppercase">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Select
                        value={application.status}
                        onValueChange={(value) => handleStatusChange(application.id, value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.filter((status) => status !== "All").map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isHttpUrl(application.job.sourceLink) ? (
                        <a
                          href={application.job.sourceLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Screenshot</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function JobsHuntPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <JobsHuntContent />
    </Suspense>
  );
}
