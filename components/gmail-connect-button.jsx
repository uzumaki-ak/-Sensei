"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Mail, Loader2 } from "lucide-react";
import { getGmailAuthUrl } from "@/actions/jobs";
import { toast } from "sonner";

export default function GmailConnectButton({ isConnected, needsReconnect = false }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const url = await getGmailAuthUrl();
      window.location.href = url;
    } catch (error) {
      toast.error("Failed to start Gmail auth");
      setIsLoading(false);
    }
  };

  if (isConnected && !needsReconnect) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Gmail Connected</span>
      </div>
    );
  }

  if (isConnected && needsReconnect) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
        onClick={handleConnect}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-70" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <Mail className="h-3.5 w-3.5" />
          </>
        )}
        {isLoading ? "Reconnecting..." : "Reconnect Gmail (Draft scope)"}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-2 px-2 text-xs text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
      onClick={handleConnect}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <>
          <span className="relative flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <Mail className="h-3.5 w-3.5" />
        </>
      )}
      {isLoading ? "Connecting..." : "Connect Gmail"}
    </Button>
  );
}
