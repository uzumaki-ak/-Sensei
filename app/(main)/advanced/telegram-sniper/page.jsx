"use client";

import React, { useState, useEffect } from "react";
import { connectTelegramSniper, disconnectTelegramSniper } from "@/actions/telegram-sniper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot, Send, Target, CheckCircle2, ShieldAlert } from "lucide-react";

export default function TelegramSniperPage() {
  const [chatId, setChatId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false); // ideally fetched from user profile
  
  // For simplicity in this UI, we just allow them to connect/reconnect
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
    } catch (error) {
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
        setChatId("");
      } else {
        toast.error(result.error || "Failed to disconnect.");
      }
    } catch (error) {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Telegram Job Sniper</h1>
          <p className="text-muted-foreground">Receive real-time push notifications the exact second a matching job is scraped.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 mt-6">
        {/* Connection Panel */}
        <Card className="border-primary/20 shadow-lg relative overflow-hidden">
          {isConnected && (
             <div className="absolute top-0 right-0 p-4">
                 <Badge variant="default" className="bg-green-500 hover:bg-green-600 flex items-center gap-1">
                     <CheckCircle2 className="h-3 w-3" /> Connected
                 </Badge>
             </div>
          )}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Sniper Configuration
            </CardTitle>
            <CardDescription>
              Link your Telegram account to our notification bot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Telegram Chat ID</label>
              <Input 
                placeholder="e.g. 123456789" 
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                disabled={isConnecting || isConnected}
              />
            </div>

            {isConnected ? (
                <Button 
                    variant="destructive"
                    className="w-full gap-2" 
                    onClick={handleDisconnect} 
                    disabled={isConnecting}
                >
                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                    Disconnect Sniper
                </Button>
            ) : (
                <Button 
                    className="w-full gap-2" 
                    onClick={handleConnect} 
                    disabled={isConnecting}
                >
                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isConnecting ? "Connecting..." : "Connect Telegram"}
                </Button>
            )}
          </CardContent>
        </Card>

        {/* Instructions Panel */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle>How to Connect</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 list-decimal list-inside text-sm leading-relaxed text-muted-foreground">
                <li>Open the Telegram App on your phone or desktop.</li>
                <li>Search for the bot <strong>@RawDataBot</strong> or <strong>@userinfobot</strong> and send a message.</li>
                <li>It will reply with your profile data. Look for the <code>id</code> field under the <code>chat</code> object.</li>
                <li>Copy that numeric ID.</li>
                <li>Paste it into the input box on the left and click Connect.</li>
                <li>Make sure to send at least one message (e.g., "/start") to the official Sensai Bot (if provided) so it has permission to message you.</li>
            </ol>
            
            <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
                <h4 className="font-semibold text-primary mb-1">What happens next?</h4>
                <p className="text-xs">
                    Whenever the Midnight Job Hunt crawler finds a new job that matches your profile, it will instantly push a message to your phone with the job title, salary, and application link.
                </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

