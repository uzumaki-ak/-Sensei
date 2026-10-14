"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, PenBox, GraduationCap, SearchCode, KanbanSquare,
  Network, Github, Building2, Mail, Scale, MessageSquare, Bot, Database,
  Workflow, FlaskConical, History, MessageCircleCode,
} from "lucide-react";

const SECTIONS = [
  { title: "Overview", items: [
    ["/dashboard", "Industry Insights", LayoutDashboard],
    ["/jobs/hunt", "Midnight Job Hunt", SearchCode],
    ["/jobs/kanban", "Job Kanban", KanbanSquare],
  ] },
  { title: "AI Tools", items: [
    ["/resume", "Build Resume", FileText],
    ["/ai-cover-letter", "Cover Letter", PenBox],
    ["/interview", "Interview Prep", GraduationCap],
  ] },
  { title: "Advanced AI", items: [
    ["/advanced/reverse-recruiter", "Reverse Recruiter", Network],
    ["/advanced/github-analyzer", "GitHub Analyzer", Github],
    ["/advanced/company-intel", "Company Intel", Building2],
    ["/advanced/drip-campaigns", "Cold Email Drip", Mail],
    ["/advanced/offer-copilot", "Offer Copilot", Scale],
    ["/advanced/interview-simulator", "Interview Simulator", MessageSquare],
    ["/advanced/telegram-sniper", "Telegram Sniper", Bot],
  ] },
  { title: "Platform Labs", items: [
    ["/advanced/rag-copilot", "RAG Copilot", Database],
    ["/advanced/multi-agent-studio", "Multi-Agent Studio", Workflow],
    ["/advanced/prompt-eval-lab", "Prompt Eval Lab", FlaskConical],
    ["/advanced/event-timeline", "Event Timeline", History],
    ["/advanced/personal-chatbot", "Personal Chatbot", MessageCircleCode],
  ] },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return SECTIONS.map((section, index) => (
    <div key={section.title}>
      <div className={`${index === 0 ? "mb-3" : "mb-3 mt-7"} px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground`}>
        {section.title}
      </div>
      <div className="space-y-1">
        {section.items.map(([href, label, Icon]) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-9 w-full items-center gap-3 rounded-sm border px-2.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-foreground/60 bg-foreground/10 text-foreground"
                  : "border-transparent text-foreground/80 hover:border-border hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  ));
}
