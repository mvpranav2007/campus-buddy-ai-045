import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listChatHistory,
  deleteChatHistory,
  type ChatHistoryRow,
} from "@/lib/chat-history";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageResponse } from "@/components/ai-elements/message";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";
import {
  ArrowLeft,
  LogOut,
  Moon,
  Search,
  Sun,
  Trash2,
  MessageSquareText,
  X,
} from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Chat History · Scholar" },
      { name: "description", content: "Browse and search your past Scholar conversations." },
    ],
  }),
  component: HistoryPage,
});

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function HistoryPage() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [rows, setRows] = useState<ChatHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ChatHistoryRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const { data, error } = await listChatHistory();
    if (error) {
      setError(error.message);
      setRows([]);
      return;
    }
    setRows(data ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.question.toLowerCase().includes(q));
  }, [rows, query]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await deleteChatHistory(id);
    setDeletingId(null);
    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }
    setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    setSelected((prev) => (prev?.id === id ? null : prev));
    toast.success("Conversation deleted");
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-surface">
      <header className="flex items-center justify-between border-b border-border/60 bg-background/60 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <Button size="icon-sm" variant="ghost" asChild title="Back to chat">
            <Link to="/chat"><ArrowLeft className="size-4" /></Link>
          </Button>
          <img src={logo} alt="" width={28} height={28} className="size-7" />
          <div>
            <div className="text-sm font-semibold leading-tight">Chat history</div>
            <div className="text-xs text-muted-foreground leading-tight">Your past conversations</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="icon-sm" variant="ghost" onClick={toggle} title="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onSignOut} title="Sign out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-3 sm:px-6 py-4">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your questions…"
            className="pl-9"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}{" "}
            <button type="button" className="underline" onClick={() => void load()}>
              Retry
            </button>
          </div>
        )}

        {rows === null && !error && (
          <ul className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <li
                key={i}
                className="h-16 animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </ul>
        )}

        {rows && !error && filtered.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <MessageSquareText className="size-10 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">
                {rows.length === 0 ? "No conversations yet" : "No matches"}
              </div>
              <div className="text-xs text-muted-foreground">
                {rows.length === 0
                  ? "Ask Scholar a question — it'll show up here."
                  : "Try a different search term."}
              </div>
            </div>
            {rows.length === 0 && (
              <Button asChild size="sm" className="mt-1">
                <Link to="/chat">Start chatting</Link>
              </Button>
            )}
          </div>
        )}

        {rows && filtered.length > 0 && (
          <ul className="space-y-2">
            {filtered.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-soft transition hover:border-primary/40 hover:shadow-glow"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {row.question}
                    </div>
                    <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {row.answer}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(row.created_at)}
                    </div>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Delete conversation"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this conversation?")) void handleDelete(row.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm("Delete this conversation?")) void handleDelete(row.id);
                      }
                    }}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive"
                  >
                    {deletingId === row.id ? (
                      <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">
                  {formatDate(selected.created_at)}
                </div>
                <div className="truncate text-sm font-semibold">Conversation</div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Delete"
                  onClick={() => {
                    if (confirm("Delete this conversation?")) void handleDelete(selected.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setSelected(null)}
                  title="Close"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  You
                </div>
                <div className="rounded-lg bg-secondary px-4 py-3 text-sm whitespace-pre-wrap">
                  {selected.question}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Scholar
                </div>
                <div className="text-sm">
                  <MessageResponse>{selected.answer}</MessageResponse>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}