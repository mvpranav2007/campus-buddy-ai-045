import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2, Search, Users, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createGroupConversation,
  ensureDirectConversation,
  searchProfilesByEmail,
  type ProfileRow,
} from "@/lib/messaging";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages/new")({
  head: () => ({
    meta: [
      { title: "New chat · Scholar" },
      { name: "description", content: "Start a new direct message or group chat." },
    ],
  }),
  component: NewChatPage,
});

type Profile = Pick<ProfileRow, "id" | "email" | "display_name" | "avatar_url">;

function useCurrentUserId() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);
  return uid;
}

function useProfileSearch(query: string, exclude: string[]) {
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchProfilesByEmail(query, exclude);
        if (alive) setResults(rows);
      } catch (e) {
        console.error(e);
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, exclude.join(",")]);
  return { results, loading };
}

function NewChatPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-surface">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur">
        <Button size="icon-sm" variant="ghost" asChild title="Back">
          <Link to="/messages"><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-sm font-semibold">New chat</h1>
      </header>

      <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-6">
        <Tabs defaultValue="dm">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dm"><User className="size-4" /> Direct message</TabsTrigger>
            <TabsTrigger value="group"><Users className="size-4" /> Group</TabsTrigger>
          </TabsList>
          <TabsContent value="dm" className="mt-4">
            <DirectMessageForm />
          </TabsContent>
          <TabsContent value="group" className="mt-4">
            <GroupForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DirectMessageForm() {
  const navigate = useNavigate();
  const uid = useCurrentUserId();
  const [query, setQuery] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const exclude = useMemo(() => (uid ? [uid] : []), [uid]);
  const { results, loading } = useProfileSearch(query, exclude);

  const start = async (userId: string) => {
    setStarting(userId);
    try {
      const id = await ensureDirectConversation(userId);
      navigate({ to: "/messages/$conversationId", params: { conversationId: id } });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't start conversation");
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email (min 2 characters)…"
          className="pl-9"
        />
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Searching…
        </div>
      ) : results.length === 0 && query.trim().length >= 2 ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">No users match “{query}”.</p>
      ) : (
        <ul className="space-y-1.5">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={starting === p.id}
                onClick={() => start(p.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left shadow-soft transition hover:border-primary/40 hover:shadow-glow disabled:opacity-60"
              >
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {(p.display_name || p.email || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.display_name || p.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                </div>
                {starting === p.id ? <Loader2 className="size-4 animate-spin" /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupForm() {
  const navigate = useNavigate();
  const uid = useCurrentUserId();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Profile[]>([]);
  const [creating, setCreating] = useState(false);

  const excludeIds = useMemo(
    () => [...(uid ? [uid] : []), ...selected.map((s) => s.id)],
    [uid, selected],
  );
  const { results, loading } = useProfileSearch(query, excludeIds);

  const create = async () => {
    if (!name.trim() || selected.length === 0) return;
    setCreating(true);
    try {
      const id = await createGroupConversation(name, selected.map((s) => s.id));
      navigate({ to: "/messages/$conversationId", params: { conversationId: id } });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Couldn't create group");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Group name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Study group, project-team, …" />
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected((s) => s.filter((x) => x.id !== p.id))}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-secondary-foreground hover:bg-secondary/80"
            >
              <Check className="size-3" />
              {p.display_name || p.email}
              <span className="text-muted-foreground">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add members by email…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Searching…
        </div>
      ) : results.length > 0 ? (
        <ul className="space-y-1.5">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected((s) => [...s, p]);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 text-left shadow-soft transition hover:border-primary/40"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {(p.display_name || p.email || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.display_name || p.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        className="w-full"
        disabled={!name.trim() || selected.length === 0 || creating}
        onClick={create}
      >
        {creating ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
        Create group
      </Button>
    </div>
  );
}