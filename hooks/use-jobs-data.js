"use client";

import { getJobApplications } from "@/actions/jobs";
import { getPusherClient } from "@/lib/pusher";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const FETCH_TIMEOUT_MS = 30000; // 30 second timeout
const MAX_RETRIES = 3;

export function useJobsData() {
  const [applications, setApplications] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isGmailFullyAuthorized, setIsGmailFullyAuthorized] = useState(false);
  const [gmailNeedsReconnect, setGmailNeedsReconnect] = useState(false);
  const [isTelegramConnected, setIsTelegramConnected] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const retryCountRef = useRef(0);
  const hasFetchedSuccessfullyRef = useRef(false);
  const loadJobsRef = useRef(null);

  const loadJobs = useCallback(async (force = false, options = {}) => {
    const silent =
      typeof options === "boolean"
        ? options
        : Boolean(options?.silent);

    // Prevent concurrent fetches
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    const shouldShowBlockingLoader = !hasFetchedSuccessfullyRef.current && !silent;
    if (shouldShowBlockingLoader) {
      setLoading(true);
    }

    try {
      const data = await getJobApplications();

      if (!isMountedRef.current) return;

      setApplications(data.applications || []);
      setPersonas(data.personas || []);
      setIsGmailConnected(data.isGmailConnected);
      setIsGmailFullyAuthorized(Boolean(data.isGmailFullyAuthorized));
      setGmailNeedsReconnect(Boolean(data.gmailNeedsReconnect));
      setIsTelegramConnected(Boolean(data.isTelegramConnected));
      setTelegramChatId(data.telegramChatId || null);
      setUserId(data.userId);
      hasFetchedSuccessfullyRef.current = true;
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error("Failed to load jobs");
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current && shouldShowBlockingLoader) {
        setLoading(false);
      }
    }
  }, []);

  // Store in ref to avoid dependency issues
  useEffect(() => {
    loadJobsRef.current = loadJobs;
  }, [loadJobs]);

  // Fetch on mount - only once per component instance
  useEffect(() => {
    isMountedRef.current = true;

    // Only fetch ONCE when this hook instance mounts
    if (!hasFetchedSuccessfullyRef.current) {
      loadJobs();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Setup Pusher for real-time updates
  useEffect(() => {
    if (!userId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(`user-${userId}`);

    // Listen for job status changes
    channel.bind("job-status-changed", (data) => {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === data.applicationId
            ? { ...app, status: data.status, ...data.application }
            : app
        )
      );
      toast.success(`Job moved to ${data.status}`);
    });

    // Listen for new job discoveries
    channel.bind("job-discovered", (data) => {
      // Inject new job into state for instant real-time update
      if (data.application) {
        setApplications((prev) => {
          // Prevent duplicates if already fetched
          if (prev.some(app => app.id === data.application.id)) return prev;
          return [data.application, ...prev];
        });
      }
      toast.success("New job discovered!", {
        description: data.job?.title || "A new opportunity was found",
      });
    });

    // Listen for email sent events
    channel.bind("email-sent", (data) => {
      console.log("[Pusher] Email sent:", data);
      setApplications((prev) =>
        prev.map((app) =>
          app.id === data.applicationId
            ? { ...app, emailSent: true, status: "Applied" }
            : app
        )
      );
      toast.success("Email sent successfully!");
    });

    // Listen for email drafted events
    channel.bind("email-drafted", (data) => {
      setApplications((prev) =>
        prev.map((app) =>
          app.id === data.applicationId
            ? {
                ...app,
                draftEmail: data.draftEmail ?? app.draftEmail,
                resumeId: data.resumeId ?? app.resumeId,
              }
            : app
        )
      );
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`user-${userId}`);
    };
  }, [userId]);

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "gmail_connected") {
      toast.success("Gmail connected successfully");
    }
    if (error) {
      toast.error("Authentication failed or was cancelled");
    }
  }, [searchParams]);

  return {
    applications,
    personas,
    isGmailConnected,
    isGmailFullyAuthorized,
    gmailNeedsReconnect,
    isTelegramConnected,
    telegramChatId,
    userId,
    loading,
    loadJobs,
  };
}
