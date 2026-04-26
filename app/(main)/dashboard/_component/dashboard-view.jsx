"use client";

import React from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BriefcaseIcon,
  LineChart,
  TrendingUp,
  TrendingDown,
  Brain,
  Rocket,
  Target,
  Trophy,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const DashboardView = ({ insights, activity }) => {
  // Transform salary data for the chart
  const salaryData = insights.salaryRanges.map((range) => ({
    name: range.role,
    min: range.min / 1000,
    max: range.max / 1000,
    median: range.median / 1000,
  }));

  const getDemandLevelColor = (level) => {
    switch (level.toLowerCase()) {
      case "high":
        return "bg-green-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getMarketOutlookInfo = (outlook) => {
    switch (outlook.toLowerCase()) {
      case "positive":
        return { icon: TrendingUp, color: "text-green-500" };
      case "neutral":
        return { icon: LineChart, color: "text-yellow-500" };
      case "negative":
        return { icon: TrendingDown, color: "text-red-500" };
      default:
        return { icon: LineChart, color: "text-gray-500" };
    }
  };

  const OutlookIcon = getMarketOutlookInfo(insights.marketOutlook).icon;
  const outlookColor = getMarketOutlookInfo(insights.marketOutlook).color;

  // Format dates using date-fns
  const lastUpdatedDate = format(new Date(insights.lastUpdated), "dd/MM/yyyy");
  const nextUpdateDistance = formatDistanceToNow(
    new Date(insights.nextUpdate),
    { addSuffix: true }
  );

  const totals = activity?.totals || {};
  const recentScorecards = activity?.recentScorecards || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Badge variant="outline">Last updated: {lastUpdatedDate}</Badge>
      </div>

      {/* Activity Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Jobs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.pipelineCount || 0}</div>
            <p className="text-xs text-muted-foreground">Tracked applications in your board</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Advanced Tool Runs</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(totals.reverseRecruiterCount || 0) +
                (totals.githubAnalysisCount || 0) +
                (totals.companyIntelCount || 0) +
                (totals.dripCampaignCount || 0) +
                (totals.offerCopilotCount || 0) +
                (totals.ragQueryCount || 0) +
                (totals.multiAgentRunCount || 0) +
                (totals.promptEvalRunCount || 0) +
                (totals.personalChatSessionCount || 0) +
                (totals.coverLetterCount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Intel, drip, offer, RAG, multi-agent, eval, personal chat, recruiter, GitHub, cover letters
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meet Interviews</CardTitle>
            <BriefcaseIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.meetCompletedCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              {totals.meetRoomCount || 0} total rooms created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scorecards Generated</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.meetEvaluatedCount || 0}</div>
            <p className="text-xs text-muted-foreground">Post-interview AI feedback reports</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Route History */}
      <Card>
        <CardHeader>
          <CardTitle>Tool History Hub</CardTitle>
          <CardDescription>Navigate quickly to the routes where your history is saved.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { href: "/advanced/interview-simulator", label: "Live Interview Rooms", value: totals.meetRoomCount || 0 },
            { href: "/advanced/reverse-recruiter", label: "Reverse Recruiter", value: totals.reverseRecruiterCount || 0 },
            { href: "/advanced/github-analyzer", label: "GitHub Analyzer", value: totals.githubAnalysisCount || 0 },
            { href: "/advanced/company-intel", label: "Company Intel", value: totals.companyIntelCount || 0 },
            { href: "/advanced/drip-campaigns", label: "Drip Campaigns", value: totals.dripCampaignCount || 0 },
            { href: "/advanced/offer-copilot", label: "Offer Copilot", value: totals.offerCopilotCount || 0 },
            { href: "/advanced/rag-copilot", label: "RAG Copilot", value: totals.ragQueryCount || 0 },
            { href: "/advanced/multi-agent-studio", label: "Multi-Agent Studio", value: totals.multiAgentRunCount || 0 },
            { href: "/advanced/prompt-eval-lab", label: "Prompt Eval Lab", value: totals.promptEvalRunCount || 0 },
            { href: "/advanced/personal-chatbot", label: "Personal Chatbot", value: totals.personalChatSessionCount || 0 },
            { href: "/advanced/event-timeline", label: "Event Timeline", value: (totals.pipelineCount || 0) + (totals.meetRoomCount || 0) },
            { href: "/interview", label: "Interview Prep Quizzes", value: totals.interviewPracticeCount || 0 },
            { href: "/ai-cover-letter", label: "Cover Letters", value: totals.coverLetterCount || 0 },
            { href: "/resume", label: "Resumes", value: totals.resumeCount || 0 },
            { href: "/jobs/kanban", label: "Job Pipeline", value: totals.pipelineCount || 0 },
          ].map((item) => (
            <div key={item.href} className="rounded-lg border p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.value} records</p>
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link href={item.href}>
                  Open
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Interview Scorecards */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Interview Scorecards</CardTitle>
          <CardDescription>Latest meet-room evaluations and scores.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentScorecards.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">
              No scorecards yet. Complete a live interview and generate scorecard to see results here.
            </div>
          ) : (
            recentScorecards.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {item.company} - {item.role}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Room {item.code} - {item.status} - {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.overallScore ? "default" : "outline"}>
                    {item.overallScore ? `${item.overallScore}/100` : "Pending"}
                  </Badge>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/meet/${item.code}`}>View</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Market Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Market Outlook
            </CardTitle>
            <OutlookIcon className={`h-4 w-4 ${outlookColor}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.marketOutlook}</div>
            <p className="text-xs text-muted-foreground">
              Next update {nextUpdateDistance}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Industry Growth
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights.growthRate.toFixed(1)}%
            </div>
            <Progress value={insights.growthRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Demand Level</CardTitle>
            <BriefcaseIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.demandLevel}</div>
            <div
              className={`h-2 w-full rounded-full mt-2 ${getDemandLevelColor(
                insights.demandLevel
              )}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Skills</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {insights.topSkills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Salary Ranges Chart */}
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Salary Ranges by Role</CardTitle>
          <CardDescription>
            Displaying minimum, median, and maximum salaries (in thousands)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salaryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-md">
                          <p className="font-medium">{label}</p>
                          {payload.map((item) => (
                            <p key={item.name} className="text-sm">
                              {item.name}: ${item.value}K
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="min" fill="#94a3b8" name="Min Salary (K)" />
                <Bar dataKey="median" fill="#64748b" name="Median Salary (K)" />
                <Bar dataKey="max" fill="#475569" name="Max Salary (K)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Industry Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Key Industry Trends</CardTitle>
            <CardDescription>
              Current trends shaping the industry
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {insights.keyTrends.map((trend, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <div className="h-2 w-2 mt-2 rounded-full bg-primary" />
                  <span>{trend}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommended Skills</CardTitle>
            <CardDescription>Skills to consider developing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {insights.recommendedSkills.map((skill) => (
                <Badge key={skill} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardView;
