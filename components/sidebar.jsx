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
  Upload,
} from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import GmailConnectButton from "./gmail-connect-button";

// We're converting to a sidebar that fits the "dark and white" theme aesthetic.
// It will be fixed on the left for md+ screens.

export default async function Sidebar() {
  const user = await checkUser();
  const isGmailConnected = !!user?.gmailToken;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 hidden md:flex flex-col">
      <div className="h-16 flex items-center px-6 border-b">
        <Link href="/">
          <Image
            src={"/logo.png"}
            alt="Sensai Logo"
            width={160}
            height={50}
            className="h-10 w-auto object-contain"
          />
        </Link>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <SignedIn>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">
            Overview
          </div>
          <Link href="/dashboard">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <LayoutDashboard className="h-5 w-5" />
              Industry Insights
            </Button>
          </Link>
          
          <Link href="/jobs/hunt">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <SearchCode className="h-5 w-5" />
              Midnight Job Hunt
            </Button>
          </Link>

          <Link href="/jobs/kanban">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <KanbanSquare className="h-5 w-5" />
              Job Kanban
            </Button>
          </Link>

          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-8 mb-4 px-2">
            AI Tools
          </div>
          <Link href="/resume">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <FileText className="h-5 w-5" />
              Build Resume
            </Button>
          </Link>
          <Link href="/ai-cover-letter">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <PenBox className="h-5 w-5" />
              Cover Letter
            </Button>
          </Link>
          <Link href="/interview">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <GraduationCap className="h-5 w-5" />
              Interview Prep
            </Button>
          </Link>

          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-8 mb-4 px-2">
            Advanced AI
          </div>
          <Link href="/advanced/reverse-recruiter">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <Network className="h-5 w-5" />
              Reverse Recruiter
            </Button>
          </Link>
          <Link href="/advanced/github-analyzer">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <Github className="h-5 w-5" />
              GitHub Analyzer
            </Button>
          </Link>
          <Link href="/advanced/company-intel">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <Building2 className="h-5 w-5" />
              Company Intel
            </Button>
          </Link>
          <Link href="/advanced/drip-campaigns">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <Mail className="h-5 w-5" />
              Cold Email Drip
            </Button>
          </Link>
          <Link href="/advanced/offer-copilot">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2">
              <Scale className="h-5 w-5" />
              Offer Copilot
            </Button>
          </Link>
          <Link href="/advanced/interview-simulator">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2 text-primary hover:text-primary hover:bg-primary/10">
              <MessageSquare className="h-5 w-5" />
              Interview Simulator
            </Button>
          </Link>
          <Link href="/advanced/telegram-sniper">
            <Button variant="ghost" className="w-full justify-start gap-3 px-2 text-primary hover:text-primary hover:bg-primary/10">
              <Bot className="h-5 w-5" />
              Telegram Sniper
            </Button>
          </Link>
        </SignedIn>
      </nav>

      <div className="border-t">
        <SignedIn>
          {/* Gmail Connection Status */}
          <div className="px-4 pt-3 pb-1">
            <GmailConnectButton isConnected={isGmailConnected} />
          </div>

          {/* Account */}
          <div className="p-4 pt-2 flex items-center justify-between px-6">
            <span className="text-sm font-medium">My Account</span>
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
