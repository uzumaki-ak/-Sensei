"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PanelLeftClose,
  PanelLeftOpen,
  MoonStar,
  SunMedium,
  LayoutDashboard,
  SearchCode,
  KanbanSquare,
  FileText,
  PenBox,
  GraduationCap,
  Network,
  Github,
  Building2,
  Mail,
  Scale,
  MessageSquare,
  Bot,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";

const SIDEBAR_COLLAPSE_KEY = "career_coach_sidebar_collapsed";

const PAGE_LABELS = {
  "/dashboard": "Industry Insights",
  "/jobs/hunt": "Midnight Job Hunt",
  "/jobs/kanban": "Job Kanban",
  "/resume": "Resume Studio",
  "/ai-cover-letter": "Cover Letter",
  "/interview": "Interview Prep",
  "/advanced/reverse-recruiter": "Reverse Recruiter",
  "/advanced/github-analyzer": "GitHub Analyzer",
  "/advanced/company-intel": "Company Intel",
  "/advanced/drip-campaigns": "Cold Email Drip",
  "/advanced/offer-copilot": "Offer Copilot",
  "/advanced/interview-simulator": "Interview Simulator",
  "/advanced/telegram-sniper": "Telegram Sniper",
  "/meet": "Join Interview Room",
};

const MOBILE_NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Industry Insights", icon: LayoutDashboard },
      { href: "/jobs/hunt", label: "Midnight Job Hunt", icon: SearchCode },
      { href: "/jobs/kanban", label: "Job Kanban", icon: KanbanSquare },
    ],
  },
  {
    label: "AI Tools",
    items: [
      { href: "/resume", label: "Build Resume", icon: FileText },
      { href: "/ai-cover-letter", label: "Cover Letter", icon: PenBox },
      { href: "/interview", label: "Interview Prep", icon: GraduationCap },
    ],
  },
  {
    label: "Advanced AI",
    items: [
      { href: "/advanced/reverse-recruiter", label: "Reverse Recruiter", icon: Network },
      { href: "/advanced/github-analyzer", label: "GitHub Analyzer", icon: Github },
      { href: "/advanced/company-intel", label: "Company Intel", icon: Building2 },
      { href: "/advanced/drip-campaigns", label: "Cold Email Drip", icon: Mail },
      { href: "/advanced/offer-copilot", label: "Offer Copilot", icon: Scale },
      { href: "/advanced/interview-simulator", label: "Interview Simulator", icon: MessageSquare },
      { href: "/advanced/telegram-sniper", label: "Telegram Sniper", icon: Bot },
    ],
  },
];

function getRouteKey(pathname) {
  if (!pathname) return "workspace";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/jobs/hunt")) return "jobs-hunt";
  if (pathname.startsWith("/jobs/kanban")) return "jobs-kanban";
  if (pathname.startsWith("/resume")) return "resume";
  if (pathname.startsWith("/ai-cover-letter")) return "cover-letter";
  if (pathname.startsWith("/interview")) return "interview";
  if (pathname.startsWith("/advanced/reverse-recruiter")) return "advanced-reverse-recruiter";
  if (pathname.startsWith("/advanced/github-analyzer")) return "advanced-github-analyzer";
  if (pathname.startsWith("/advanced/company-intel")) return "advanced-company-intel";
  if (pathname.startsWith("/advanced/drip-campaigns")) return "advanced-drip-campaigns";
  if (pathname.startsWith("/advanced/offer-copilot")) return "advanced-offer-copilot";
  if (pathname.startsWith("/advanced/interview-simulator")) return "advanced-interview-simulator";
  if (pathname.startsWith("/advanced/telegram-sniper")) return "advanced-telegram-sniper";
  if (pathname.startsWith("/meet")) return "meet";
  return "workspace";
}

function formatPathLabel(pathname) {
  if (!pathname) return "Workspace";
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .slice(-2)
    .map((segment) =>
      segment
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    );
  return segments.join(" / ") || "Workspace";
}

export default function AppTopbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const pageTitle = useMemo(() => formatPathLabel(pathname), [pathname]);
  const routeKey = useMemo(() => getRouteKey(pathname), [pathname]);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY)
        : null;
    const nextCollapsed = stored === "1";
    setCollapsed(nextCollapsed);
    document.documentElement.classList.toggle("sidebar-collapsed", nextCollapsed);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const key = String(event.key || "").toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [collapsed]);

  useEffect(() => {
    document.documentElement.setAttribute("data-route-key", routeKey);
    return () => {
      if (document.documentElement.getAttribute("data-route-key") === routeKey) {
        document.documentElement.removeAttribute("data-route-key");
      }
    };
  }, [routeKey]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.classList.toggle("sidebar-collapsed", next);
    window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <>
      <header className="app-topbar sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              title="Open navigation menu"
            >
              <PanelLeftOpen />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden md:inline-flex"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar (Ctrl+B)"
              title="Toggle sidebar (Ctrl+B)"
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:inline-flex">
                Workspace
              </Badge>
              <h1 className="text-sm font-semibold tracking-wide md:text-base">{pageTitle}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={toggleTheme}>
              {theme === "light" ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
              <span className="hidden sm:inline">{theme === "light" ? "Matte" : "Bone"}</span>
            </Button>
          </div>
        </div>
      </header>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />

          <aside className="relative h-full w-[86%] max-w-[320px] border-r border-border/70 bg-background p-4">
            <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
              <p className="text-sm font-semibold tracking-wide">Navigation</p>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <nav className="h-[calc(100%-56px)] space-y-5 overflow-y-auto pr-1">
              {MOBILE_NAV_SECTIONS.map((section) => (
                <div key={section.label} className="space-y-2">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {section.label}
                  </p>

                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive =
                        pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileNavOpen(false)}
                          className={`flex items-center gap-2 rounded-sm border px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? "border-primary/40 bg-primary/10 text-foreground"
                              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
