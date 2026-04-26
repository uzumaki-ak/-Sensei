"use client";

import React, { useEffect, useState } from "react";
import {
  connectTelegramSniper,
  disconnectTelegramSniper,
  getTelegramSniperStatus,
} from "@/actions/telegram-sniper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Bot,
  Send,
  Target,
  CheckCircle2,
  ShieldAlert,
  Copy,
  ExternalLink,
} from "lucide-react";

const BOT_HANDLE = "@Job_ak_bot";

export default function TelegramSniperPage() {
  const [chatId, setChatId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      setStatusLoading(true);
      try {
        const result = await getTelegramSniperStatus();
        if (result.success) {
          setIsConnected(Boolean(result.isConnected));
          setChatId(result.chatId || "");
        }
      } catch {
        // ignore load errors for status panel
      } finally {
        setStatusLoading(false);
      }
    };
    loadStatus();
  }, []);

  const copyChatId = async () => {
    if (!chatId.trim()) return;
    try {
      await navigator.clipboard.writeText(chatId.trim());
      toast.success("Chat ID copied.");
    } catch {
      toast.error("Could not copy Chat ID.");
    }
  };

  const handleConnect = async () => {
    if (!chatId.trim()) {
      toast.error("Please enter your Telegram Chat ID.");
      return;
    }

    setIsConnecting(true);
    try {
      const result = await connectTelegramSniper(chatId.trim());
      if (result.success) {
        toast.success(result.message);
        setIsConnected(true);
      } else {
        toast.error(result.error || "Failed to connect.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsConnecting(true);
    try {
      const result = await disconnectTelegramSniper();
      if (result.success) {
        toast.success("Telegram Sniper disconnected.");
        setIsConnected(false);
      } else {
        toast.error(result.error || "Failed to disconnect.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="rounded-sm border border-border/70 bg-muted/30 p-3">
          <Bot className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Telegram Job Sniper</h1>
          <p className="text-muted-foreground">
            Get instant push alerts when Midnight Job Hunt discovers new matching roles.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="relative overflow-hidden border-border/70">
          {isConnected && (
            <div className="absolute right-4 top-4">
              <Badge className="flex items-center gap-1.5 bg-emerald-600 text-white hover:bg-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </Badge>
            </div>
          )}

          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Sniper Configuration
            </CardTitle>
            <CardDescription>
              Token is server-side only. You only enter your numeric Telegram Chat ID here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Telegram Chat ID</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. 123456789"
                  value={chatId}
                  onChange={(event) => setChatId(event.target.value)}
                  disabled={isConnecting}
                />
                <Button variant="outline" size="icon" onClick={copyChatId} disabled={!chatId.trim()}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-sm border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
              <p>
                Connected bot:{" "}
                <a
                  href={`https://t.me/${BOT_HANDLE.replace("@", "")}`}
                  className="font-medium text-foreground hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {BOT_HANDLE}
                </a>
              </p>
              <p className="mt-1">Important: Bot token and Chat ID are different values.</p>
            </div>

            {isConnected ? (
              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={handleDisconnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
                Disconnect Sniper
              </Button>
            ) : (
              <Button className="w-full gap-2" onClick={handleConnect} disabled={isConnecting || statusLoading}>
                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isConnecting ? "Connecting..." : "Connect Telegram"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-muted/20">
          <CardHeader>
            <CardTitle>How to get Chat ID</CardTitle>
            <CardDescription>This is the value you paste above.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
              <li>
                Open Telegram and send <code>/start</code> to{" "}
                <a
                  className="font-medium text-foreground hover:underline"
                  href={`https://t.me/${BOT_HANDLE.replace("@", "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {BOT_HANDLE}
                </a>
                .
              </li>
              <li>
                Open <strong>@userinfobot</strong> or <strong>@RawDataBot</strong> and send any message.
              </li>
              <li>Copy the numeric <code>id</code> from bot response. That number is your Chat ID.</li>
              <li>Paste it here and connect.</li>
            </ol>

            <div className="mt-5 rounded-sm border border-border/70 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">What this feature does</p>
              <p className="mt-1">
                Midnight Job Hunt will push newly discovered matching jobs directly to your Telegram in real time.
              </p>
            </div>

            <a
              href={`https://t.me/${BOT_HANDLE.replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
            >
              Open Bot <ExternalLink className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

