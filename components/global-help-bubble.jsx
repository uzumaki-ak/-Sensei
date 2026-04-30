"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircleCode, Sparkles, Send, X } from "lucide-react";
import { toast } from "sonner";
import { sendPersonalChatMessage } from "@/actions/personal-chatbot";
import ChatMarkdown from "@/components/chat-markdown";

const HELP_SUGGESTIONS = [
  "What does each advanced feature do, and what are the best use cases?",
  "Give me a recruiter demo script to showcase this platform in 3 minutes.",
  "How should I test RAG Copilot, Multi-Agent Studio, and Prompt Eval Lab end-to-end?",
  "Based on my data, what are my strongest project stories for interviews?",
];

const BUBBLE_POSITION_STORAGE_KEY = "global_help_bubble_position";
const DRAG_MARGIN_PX = 8;
const DRAG_THRESHOLD_PX = 6;

export default function GlobalHelpBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [warningText, setWarningText] = useState("");
  const [position, setPosition] = useState(null);
  const sendLockRef = useRef(false);
  const scrollContainerRef = useRef(null);
  const bubbleRootRef = useRef(null);
  const suppressClickRef = useRef(false);
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    startPointerX: 0,
    startPointerY: 0,
    startX: 0,
    startY: 0,
    width: 0,
    height: 0,
    hasMoved: false,
  });

  const resetDragState = () => {
    dragStateRef.current = {
      active: false,
      pointerId: null,
      startPointerX: 0,
      startPointerY: 0,
      startX: 0,
      startY: 0,
      width: 0,
      height: 0,
      hasMoved: false,
    };
  };

  const hideOnRoute = useMemo(() => {
    if (!pathname) return false;
    return pathname.startsWith("/advanced/personal-chatbot");
  }, [pathname]);

  useEffect(() => {
    const savedMessages = window.localStorage.getItem("global_help_chat_messages");
    const savedSessionId = window.localStorage.getItem("global_help_chat_session_id");
    const savedPosition = window.localStorage.getItem(BUBBLE_POSITION_STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed)) setMessages(parsed.slice(-30));
      } catch {
        // ignore invalid local cache
      }
    }
    if (savedSessionId) setSessionId(savedSessionId);
    if (savedPosition) {
      try {
        const parsed = JSON.parse(savedPosition);
        if (
          parsed &&
          Number.isFinite(parsed.x) &&
          Number.isFinite(parsed.y)
        ) {
          setPosition({ x: parsed.x, y: parsed.y });
        }
      } catch {
        // ignore invalid local cache
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("global_help_chat_messages", JSON.stringify(messages.slice(-30)));
  }, [messages]);

  useEffect(() => {
    if (sessionId) {
      window.localStorage.setItem("global_help_chat_session_id", sessionId);
    } else {
      window.localStorage.removeItem("global_help_chat_session_id");
    }
  }, [sessionId]);

  useEffect(() => {
    if (position) {
      window.localStorage.setItem(BUBBLE_POSITION_STORAGE_KEY, JSON.stringify(position));
    } else {
      window.localStorage.removeItem(BUBBLE_POSITION_STORAGE_KEY);
    }
  }, [position]);

  useEffect(() => {
    const endAnyActiveDrag = () => {
      if (!dragStateRef.current.active) return;
      resetDragState();
    };

    window.addEventListener("pointerup", endAnyActiveDrag);
    window.addEventListener("pointercancel", endAnyActiveDrag);
    window.addEventListener("blur", endAnyActiveDrag);

    return () => {
      window.removeEventListener("pointerup", endAnyActiveDrag);
      window.removeEventListener("pointercancel", endAnyActiveDrag);
      window.removeEventListener("blur", endAnyActiveDrag);
    };
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!position) return;
    const root = bubbleRootRef.current;
    if (!root) return;

    const clampWithinViewport = () => {
      const rect = root.getBoundingClientRect();
      const maxX = Math.max(DRAG_MARGIN_PX, window.innerWidth - rect.width - DRAG_MARGIN_PX);
      const maxY = Math.max(DRAG_MARGIN_PX, window.innerHeight - rect.height - DRAG_MARGIN_PX);
      const clampedX = Math.min(Math.max(position.x, DRAG_MARGIN_PX), maxX);
      const clampedY = Math.min(Math.max(position.y, DRAG_MARGIN_PX), maxY);
      if (clampedX !== position.x || clampedY !== position.y) {
        setPosition({ x: clampedX, y: clampedY });
      }
    };

    clampWithinViewport();
    window.addEventListener("resize", clampWithinViewport);
    return () => window.removeEventListener("resize", clampWithinViewport);
  }, [position]);

  if (hideOnRoute) return null;

  const clampPosition = (nextX, nextY, width, height) => {
    const maxX = Math.max(DRAG_MARGIN_PX, window.innerWidth - width - DRAG_MARGIN_PX);
    const maxY = Math.max(DRAG_MARGIN_PX, window.innerHeight - height - DRAG_MARGIN_PX);
    return {
      x: Math.min(Math.max(nextX, DRAG_MARGIN_PX), maxX),
      y: Math.min(Math.max(nextY, DRAG_MARGIN_PX), maxY),
    };
  };

  const beginDrag = (event) => {
    if (!event.isPrimary) return;
    const interactiveTarget =
      event.target instanceof Element
        ? event.target.closest(
            "[data-no-drag='true'],button,a,input,textarea,select"
          )
        : null;
    if (interactiveTarget) return;
    const root = bubbleRootRef.current;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    const startPosition = position ?? { x: rect.left, y: rect.top };

    if (!position) setPosition(startPosition);

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: startPosition.x,
      startY: startPosition.y,
      width: rect.width,
      height: rect.height,
      hasMoved: false,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const updateDrag = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startPointerX;
    const deltaY = event.clientY - dragState.startPointerY;

    if (!dragState.hasMoved && Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD_PX) {
      dragState.hasMoved = true;
    }

    const next = clampPosition(
      dragState.startX + deltaX,
      dragState.startY + deltaY,
      dragState.width,
      dragState.height
    );
    setPosition(next);
  };

  const endDrag = (event) => {
    const dragState = dragStateRef.current;
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;

    if (dragState.hasMoved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    resetDragState();

    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const toggleBubble = () => {
    if (suppressClickRef.current) return;
    setOpen((current) => !current);
    setHintVisible(false);
  };

  const openFromHint = () => {
    if (suppressClickRef.current) return;
    setOpen(true);
    setHintVisible(false);
  };

  const pushUserMessage = (content) => {
    const next = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, next]);
  };

  const pushAssistantMessage = (reply) => {
    const next = {
      id: reply?.id || `local-assistant-${Date.now()}`,
      role: "assistant",
      content: reply?.content || "No response generated.",
      citations: reply?.citations || [],
      createdAt: reply?.createdAt || new Date().toISOString(),
    };
    setMessages((prev) => [...prev, next]);
  };

  const handleSend = async (prefilledMessage = null) => {
    if (sendLockRef.current || isSending) return;
    const content = String(prefilledMessage ?? input).trim();
    if (!content) return;

    sendLockRef.current = true;
    setIsSending(true);
    setWarningText("");
    setInput("");
    pushUserMessage(content);

    try {
      const result = await sendPersonalChatMessage({
        sessionId: sessionId || null,
        applicationId: null,
        message: content,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to send message.");
        setMessages((prev) => prev.filter((item) => item.content !== content || item.role !== "user"));
        return;
      }

      if (result.warning) setWarningText(result.warning);
      if (result.session?.id) setSessionId(result.session.id);
      pushAssistantMessage(result.reply);
    } catch {
      toast.error("Failed to send message.");
    } finally {
      sendLockRef.current = false;
      setIsSending(false);
    }
  };

  return (
    <div
      ref={bubbleRootRef}
      className={`fixed z-[40] ${position ? "" : "bottom-3 right-2 sm:bottom-5 sm:right-5"}`}
      style={position ? { left: `${position.x}px`, top: `${position.y}px` } : undefined}
    >
      {hintVisible ? (
        <button
          type="button"
          className="mb-2 flex w-auto touch-none select-none items-center gap-2 rounded-2xl border border-border/70 bg-background/95 px-2.5 py-2 text-left shadow-lg backdrop-blur sm:gap-3 sm:px-3"
          onClick={openFromHint}
          onPointerDown={beginDrag}
          onPointerMove={updateDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Open quick help"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-muted/40">
            <MessageCircleCode className="h-5 w-5" />
          </div>
          <div className="hidden rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-medium leading-5 sm:block">
            Having trouble? Ask me anything.
          </div>
        </button>
      ) : null}

      {open ? (
        <div className="mb-2 w-[min(380px,calc(100vw-1rem))] rounded-sm border border-border/70 bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex cursor-move touch-none select-none items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              onPointerDown={beginDrag}
              onPointerMove={updateDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              aria-label="Drag help bubble"
              title="Drag"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Personal Copilot
            </button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              data-no-drag="true"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {warningText ? (
            <div className="mb-2 rounded-sm border border-destructive/40 bg-destructive/10 p-2">
              <p className="text-[11px] text-destructive">{warningText}</p>
            </div>
          ) : null}

          <div
            ref={scrollContainerRef}
            className="mb-2 max-h-[min(45vh,320px)] space-y-2 overflow-y-auto rounded-sm border border-border/70 p-2"
          >
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Ask about features, use cases, your interview prep, or testing steps.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3 py-2 ${
                      message.role === "assistant"
                        ? "border border-primary/30 bg-primary/10"
                        : "border border-border/70 bg-muted/30"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <ChatMarkdown content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-xs">{message.content}</p>
                    )}
                    {Array.isArray(message.citations) && message.citations.length > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {message.citations.slice(0, 3).map((citation) => (
                          <Badge key={`${message.id}-${citation.id}`} variant="outline" className="text-[10px]">
                            {citation.id}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mb-2 grid gap-1.5">
            {HELP_SUGGESTIONS.slice(0, 2).map((question, index) => (
              <button
                key={`global-bubble-q-${index}`}
                type="button"
                className="line-clamp-2 rounded-sm border border-border/60 px-2 py-1 text-left text-[11px] leading-5 hover:bg-muted/40"
                onClick={() => handleSend(question)}
                disabled={isSending}
              >
                {question}
              </button>
            ))}
          </div>

          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
          >
            <Textarea
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything..."
              className="text-xs"
            />
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={isSending || !input.trim()}
              >
                {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {isSending ? "Sending..." : "Send"}
              </Button>
              <Button asChild type="button" size="sm" variant="outline" className="ml-auto text-xs">
                <Link href="/advanced/personal-chatbot">Open Full Chat</Link>
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <Button
        type="button"
        size="icon"
        className="h-12 w-12 touch-none rounded-full shadow-lg"
        onClick={toggleBubble}
        onPointerDown={beginDrag}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="Toggle assistant bubble"
      >
        <MessageCircleCode className="h-5 w-5" />
      </Button>
    </div>
  );
}
