"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getEventTimeline } from "@/actions/event-timeline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, RefreshCw, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

function EventTimelineContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");

  const loadEvents = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const result = await getEventTimeline(120);
      if (!result.success) {
        toast.error(result.error || "Failed to load timeline.");
        return;
      }
      setEvents(result.events || []);
    } catch {
      toast.error("Failed to load timeline.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadEvents(false);
  }, []);

  const eventTypes = useMemo(() => {
    const types = Array.from(new Set(events.map((item) => item.type))).sort();
    return types;
  }, [events]);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((item) => item.type === filter);
  }, [events, filter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="rounded-sm border border-border/70 bg-muted/30 p-3">
          <History className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Event Timeline</h1>
          <p className="text-muted-foreground">
            Unified activity feed across your advanced tools, interview rooms, and new AI labs.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Timeline Feed</CardTitle>
              <CardDescription>Cross-tool activity ordered by latest timestamp.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Filter event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {eventTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => loadEvents(true)}
                disabled={isRefreshing}
              >
                {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading timeline...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No events found for current filter.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((event) => (
                <div key={event.id} className="rounded-sm border border-border/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.subtitle}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{event.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="gap-1">
                      <Link href={event.href}>
                        Open
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function EventTimelinePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <EventTimelineContent />
    </Suspense>
  );
}
