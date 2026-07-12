import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, MessageSquarePlus, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  conversationDisplayName,
  conversationInitials,
  listConversations,
  type ConversationSummary,
} from "@/lib/messaging";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({
    meta: [
      { title: "Messages · Scholar" },
      { name: "description", content: "Your direct messages and group chats." },
    ],
  }),
  component: MessagesIndex,
});

function MessagesIndex() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["conversations"],
    queryFn: listConversations,
  });

  // Realtime: refetch on any conversation activity
  useEffect(() => {
    const ch = supabase
      .channel("conversations-index")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refetch())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members" },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetch]);

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q || !uid) return list;
    return list.filter((c) =>
      conversationDisplayName(c, uid).toLowerCase().includes(q),
    );
  }, [data, query, uid]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-surface">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button size="icon-sm" variant="ghost" asChild title="Back">
            <Link to="/chat"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Messages</h1>
            <p className="text-xs text-muted-foreground leading-tight">Direct messages and groups</p>
          </div>
        </div>
        <Button size="sm" onClick={() => navigate({ to: "/messages/new" })}>
          <MessageSquarePlus className="size-4" />
          <span className="hidden sm:inline">New chat</span>
        </Button>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-3 py-4 sm:px-6">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Couldn't load conversations. Try refreshing.
          </p>
        ) : filtered.length === 0 ? (
          <EmptyState hasAny={(data?.length ?? 0) > 0} />
        ) : (
          <ul className="space-y-1.5">
            {filtered.map((c) => (
              <ConversationRow key={c.id} conversation={c} currentUserId={uid ?? ""} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  currentUserId,
}: {
  conversation: ConversationSummary;
  currentUserId: string;
}) {
  const name = conversationDisplayName(conversation, currentUserId);
  const isGroup = conversation.type === "group";
  return (
    <li>
      <Link
        to="/messages/$conversationId"
        params={{ conversationId: conversation.id }}
        className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-soft transition hover:border-primary/40 hover:shadow-glow"
      >
        <Avatar className="size-10">
          <AvatarFallback className="bg-primary/10 text-primary">
            {isGroup ? <Users className="size-4" /> : conversationInitials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
            </span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {isGroup ? `${conversation.members.length} members` : "Direct message"}
          </div>
        </div>
      </Link>
    </li>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="mt-12 flex flex-col items-center gap-3 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        <MessageSquarePlus className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">
        {hasAny ? "No matches" : "No conversations yet"}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {hasAny
          ? "Try a different search term."
          : "Start a direct message or create a group to share files and chat with classmates."}
      </p>
      {!hasAny && (
        <Button asChild className="mt-2">
          <Link to="/messages/new">
            <MessageSquarePlus className="size-4" /> Start a new chat
          </Link>
        </Button>
      )}
    </div>
  );
}