"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({ error, reset }) {
  useEffect(() => {
    console.error("Workspace route failed:", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-xl rounded-sm border border-destructive/40 bg-card p-6">
      <h2 className="text-xl font-semibold">This page could not load</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The service may be temporarily unavailable. Your saved data has not been changed.
      </p>
      <Button type="button" className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
