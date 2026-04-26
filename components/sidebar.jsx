import React from "react";
import Link from "next/link";
import Image from "next/image";
import { checkUser } from "@/lib/checkUser";
import { Button } from "./ui/button";
import {
  LayoutDashboard,
  FileText,
  PenBox,
  GraduationCap,
  SearchCode,
  KanbanSquare,
  Network,
  Github,
  Building2,
  Mail,
  Scale,
  MessageSquare,
  Bot,
  Circle,
  Database,
  Workflow,
  FlaskConical,
  History,
  MessageCircleCode,
} from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import GmailConnectButton from "./gmail-connect-button";
import { hasGmailDraftScope } from "@/lib/gmail-scopes";

// We're converting to a sidebar that fits the "dark and white" theme aesthetic.
// It will be fixed on the left for md+ screens.

export default async function Sidebar() {
  const user = await checkUser();
  const isGmailConnected = !!user?.gmailToken;
  const needsGmailReconnect = isGmailConnected && !hasGmailDraftScope(user?.gmailToken);

  return (
    <aside className="app-sidebar fixed left-0 top-0 z-50 hidden h-screen w-72 flex-col border-r border-border/60 bg-card/95 backdrop-blur-md md:flex">
      <div className="flex h-16 items-center justify-between border-b border-border/60 px-6">
        <Link href="/" className="transition-opacity hover:opacity-80">
          <Image
            src={"/logo.png"}
            alt="Sensai Logo"
            width={140}
            height={42}
            className="h-9 w-auto object-contain"
          />
        </Link>
        <Circle className="h-3.5 w-3.5 fill-foreground/30 text-foreground/30" />
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
        <SignedIn>
          <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Overview
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <LayoutDashboard className="h-4.5 w-4.5" />
              Industry Insights
            </Button>
          </Link>
          
          <Link href="/jobs/hunt">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <SearchCode className="h-4.5 w-4.5" />
              Midnight Job Hunt
            </Button>
          </Link>

          <Link href="/jobs/kanban">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <KanbanSquare className="h-4.5 w-4.5" />
              Job Kanban
            </Button>
          </Link>

          <div className="mb-3 mt-7 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            AI Tools
          </div>
          <Link href="/resume">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <FileText className="h-4.5 w-4.5" />
              Build Resume
            </Button>
          </Link>
          <Link href="/ai-cover-letter">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <PenBox className="h-4.5 w-4.5" />
              Cover Letter
            </Button>
          </Link>
          <Link href="/interview">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <GraduationCap className="h-4.5 w-4.5" />
              Interview Prep
            </Button>
          </Link>

          <div className="mb-3 mt-7 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Advanced AI
          </div>
          <Link href="/advanced/reverse-recruiter">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <Network className="h-4.5 w-4.5" />
              Reverse Recruiter
            </Button>
          </Link>
          <Link href="/advanced/github-analyzer">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <Github className="h-4.5 w-4.5" />
              GitHub Analyzer
            </Button>
          </Link>
          <Link href="/advanced/company-intel">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <Building2 className="h-4.5 w-4.5" />
              Company Intel
            </Button>
          </Link>
          <Link href="/advanced/drip-campaigns">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <Mail className="h-4.5 w-4.5" />
              Cold Email Drip
            </Button>
          </Link>
          <Link href="/advanced/offer-copilot">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <Scale className="h-4.5 w-4.5" />
              Offer Copilot
            </Button>
          </Link>
          <Link href="/advanced/interview-simulator">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <MessageSquare className="h-4.5 w-4.5" />
              Interview Simulator
            </Button>
          </Link>
          <Link href="/advanced/telegram-sniper">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <Bot className="h-4.5 w-4.5" />
              Telegram Sniper
            </Button>
          </Link>

          <div className="mb-3 mt-7 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Platform Labs
          </div>
          <Link href="/advanced/rag-copilot">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <Database className="h-4.5 w-4.5" />
              RAG Copilot
            </Button>
          </Link>
          <Link href="/advanced/multi-agent-studio">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <Workflow className="h-4.5 w-4.5" />
              Multi-Agent Studio
            </Button>
          </Link>
          <Link href="/advanced/prompt-eval-lab">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <FlaskConical className="h-4.5 w-4.5" />
              Prompt Eval Lab
            </Button>
          </Link>
          <Link href="/advanced/event-timeline">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <History className="h-4.5 w-4.5" />
              Event Timeline
            </Button>
          </Link>
          <Link href="/advanced/personal-chatbot">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2.5">
              <MessageCircleCode className="h-4.5 w-4.5" />
              Personal Chatbot
            </Button>
          </Link>
        </SignedIn>
      </nav>

      <div className="border-t border-border/60">
        <SignedIn>
          {/* Gmail Connection Status */}
          <div className="px-4 pt-3 pb-1">
            <GmailConnectButton
              isConnected={isGmailConnected}
              needsReconnect={needsGmailReconnect}
            />
          </div>

          {/* Account */}
          <div className="flex items-center justify-between p-4 px-6 pt-2">
            <span className="text-sm font-medium">Account</span>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                  userButtonPopoverCard: "shadow-xl",
                  userPreviewMainIdentifier: "font-semibold",
                },
              }}
              afterSignOutUrl="/"
            />
          </div>
        </SignedIn>
        <SignedOut>
          <div className="p-4">
            <SignInButton>
              <Button variant="outline" className="w-full">Sign In</Button>
            </SignInButton>
          </div>
        </SignedOut>
      </div>
    </aside>
  );
}
