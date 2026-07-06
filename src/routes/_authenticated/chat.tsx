import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Moon, Sun, Trash2, MessageCircle } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { loadMessages, saveMessages, clearMessages } from "@/lib/chat-storage";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat · Scholar" },
      { name: "description", content: "Chat with Scholar, your AI student assistant." },
    ],
  }),
  component: ChatPage,
});

const SUGGESTIONS = [
  { icon: "📚", text: "Explain the syllabus for Data Structures this semester." },
  { icon: "🗓️", text: "How is my attendance calculated and what's the minimum?" },
  { icon: "💰", text: "What scholarships can a second-year student apply for?" },
  { icon: "🎓", text: "How do I prepare for on-campus placements?" },
  { icon: "🏠", text: "What are the hostel curfew rules and mess timings?" },
  { icon: "📖", text: "How do I renew a library book online?" },
];

function ChatPage() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [email, setEmail] = useState<string>("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setInitial(loadMessages());
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, []);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  if (initial === null) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <ChatInner
      initialMessages={initial}
      transport={transport}
      email={email}
      theme={theme}
      onToggleTheme={toggle}
      onSignOut={async () => {
        await supabase.auth.signOut();
        navigate({ to: "/auth" });
      }}
      onClear={() => {
        clearMessages();
        window.location.reload();
      }}
      inputRef={inputRef}
    />
  );
}

function ChatInner({
  initialMessages,
  transport,
  email,
  theme,
  onToggleTheme,
  onSignOut,
  onClear,
  inputRef,
}: {
  initialMessages: UIMessage[];
  transport: DefaultChatTransport<UIMessage>;
  email: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onSignOut: () => void;
  onClear: () => void;
  inputRef: React.MutableRefObject<HTMLTextAreaElement | null>;
}) {
  const { messages, sendMessage, status } = useChat({
    id: "scholar-single",
    messages: initialMessages,
    transport,
    onError: (err) => {
      toast.error(err.message || "Something went wrong");
    },
  });

  // Persist to localStorage as messages evolve.
  useEffect(() => {
    if (status === "streaming" || status === "submitted") return;
    saveMessages(messages);
  }, [messages, status]);

  // Keep composer focused
  useEffect(() => {
    inputRef.current?.focus();
  }, [status, inputRef]);

  const isBusy = status === "submitted" || status === "streaming";
  const empty = messages.length === 0;

  return (
    <div className="flex h-screen flex-col bg-gradient-surface">
      <header className="flex items-center justify-between border-b border-border/60 bg-background/60 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="" width={32} height={32} className="size-8" />
          <div>
            <div className="text-sm font-semibold leading-tight">Scholar</div>
            <div className="text-xs text-muted-foreground leading-tight">Student assistance chat</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline text-xs text-muted-foreground mr-2 truncate max-w-[14rem]">{email}</span>
          <Button size="icon-sm" variant="ghost" onClick={onClear} title="Clear conversation">
            <Trash2 className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onToggleTheme} title="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onSignOut} title="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col mx-auto w-full max-w-3xl px-3 sm:px-6">
        <Conversation className="flex-1">
          <ConversationContent className="pb-2">
            {empty ? (
              <ConversationEmptyState
                className="mt-6"
                title=""
                description=""
              >
                <div className="flex flex-col items-center gap-6 text-center">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-gradient-hero blur-2xl opacity-30" />
                    <img
                      src={logo}
                      alt="Scholar logo"
                      width={80}
                      height={80}
                      className="relative size-20 animate-float"
                    />
                  </div>
                  <div className="space-y-2 max-w-lg">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      Hi{email ? `, ${email.split("@")[0]}` : ""} 👋
                    </h2>
                    <p className="text-muted-foreground">
                      I'm Scholar — ask me anything about your courses, exams,
                      attendance, fees, scholarships, placements, library or hostel.
                    </p>
                  </div>
                  <div className="grid w-full sm:grid-cols-2 gap-2 pt-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.text}
                        type="button"
                        onClick={() => sendMessage({ text: s.text })}
                        className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm shadow-soft transition hover:border-primary/40 hover:shadow-glow"
                      >
                        <span className="text-lg leading-none pt-0.5">{s.icon}</span>
                        <span className="text-foreground/90 group-hover:text-foreground">
                          {s.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </ConversationEmptyState>
            ) : (
              messages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {message.parts.map((part, i) => {
                      if (part.type === "text") {
                        return message.role === "assistant" ? (
                          <MessageResponse key={i}>{part.text}</MessageResponse>
                        ) : (
                          <div key={i} className="whitespace-pre-wrap">{part.text}</div>
                        );
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))
            )}
            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer className="text-sm">Scholar is thinking…</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="pb-4 pt-2">
          <PromptInput
            onSubmit={async (message) => {
              const text = message.text.trim();
              if (!text || isBusy) return;
              await sendMessage({ text });
            }}
            className="shadow-soft"
          >
            <PromptInputTextarea
              ref={inputRef}
              placeholder="Ask about courses, attendance, exams, fees…"
              autoFocus
            />
            <PromptInputFooter className="justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-1">
                <MessageCircle className="size-3.5" />
                Saved in this browser
              </div>
              <PromptInputSubmit status={status} disabled={isBusy} />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Scholar can make mistakes. Verify important academic info with your institution.
          </p>
        </div>
      </div>
    </div>
  );
}