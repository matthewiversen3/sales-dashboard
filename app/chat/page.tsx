"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Send, Bot, User, Loader2, CheckCircle2, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
}

export default function ChatPage() {
  const { settings, loaded } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (loaded) inputRef.current?.focus();
  }, [loaded]);

  if (!loaded) return <div className="animate-pulse h-96" />;

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          apiKey: settings.anthropicApiKey || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: data.error || "Something went wrong.",
            actions: [],
          },
        ]);
      } else {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: data.message,
            actions: data.actions || [],
          },
        ]);
      }
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Network error. Check your connection.",
          actions: [],
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] md:h-[calc(100vh-3rem)] max-w-3xl mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight mb-2">
              AppRabbit AI Assistant
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Tell me about your sales and I&apos;ll update the dashboard.
              Try: &quot;I just closed a $10K DFY deal with Rivera
              Fitness&quot;
            </p>
            <div className="flex flex-wrap gap-2 mt-6 justify-center">
              {[
                "I sold a 5K DFY app to Jorge today",
                "Show me a pipeline summary",
                "Mark Rivera Fitness deposit as paid",
                "Add a new rep named Sarah",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-3",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-border/40 space-y-1">
                  {msg.actions.map((action, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                      {action}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-4 w-4 text-background" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me about a sale, ask about the pipeline..."
              rows={1}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/60"
              style={{ minHeight: "48px", maxHeight: "120px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "48px";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
            />
          </div>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="h-[48px] w-[48px] rounded-xl shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {!settings.anthropicApiKey && !process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY && (
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Add your Anthropic API key in{" "}
            <a href="/settings" className="underline">
              Settings
            </a>{" "}
            to enable AI chat
          </p>
        )}
      </div>
    </div>
  );
}
