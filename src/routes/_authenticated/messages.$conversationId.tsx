import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import {
  ArrowLeft,
  Loader2,
  Paperclip,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  conversationDisplayName,
  conversationInitials,
  deleteMessage,
  getConversation,
  listMessages,
  markConversationRead,
  sendTextMessage,
  uploadFileAndSend,
  type MessageRow,
  type ProfileRow,
} from "@/lib/messaging";
import {
  ACCEPT_ATTR,
  formatValidationError,
  validateFile,
  formatFileSize,
} from "@/lib/file-utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FileMessage } from "@/components/messaging/FileMessage";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Chat · Scholar" },
      { name: "description", content: "Direct message or group chat." },
    ],
  }),
  component: ThreadPage,
});

type UploadState = {
  id: string;
  fileName: string;
  fileSize: number;
  controller: AbortController;
};

function ThreadPage() {
  const { conversationId } = useParams({ from: "/_authenticated/messages/$conversationId" });
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const convoQuery = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => getConversation(conversationId),
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => listMessages(conversationId),
  });

  // Realtime updates for messages
  useEffect(() => {
    const ch = supabase
      .channel(`msg-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          qc.setQueryData<MessageRow[]>(["messages", conversationId], (prev) => {
            const list = prev ?? [];
            if (list.some((m) => m.id === row.id)) return list;
            return [...list, row];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.old as MessageRow;
          qc.setQueryData<MessageRow[]>(["messages", conversationId], (prev) =>
            (prev ?? []).filter((m) => m.id !== row.id),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, qc]);

  // Mark read on view
  useEffect(() => {
    void markConversationRead(conversationId);
  }, [conversationId, messagesQuery.data?.length]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messagesQuery.data?.length, uploads.length]);

  const profileById = useMemo(() => {
    const m = new Map<string, Pick<ProfileRow, "id" | "email" | "display_name" | "avatar_url">>();
    for (const p of convoQuery.data?.profiles ?? []) m.set(p.id, p);
    return m;
  }, [convoQuery.data]);

  const convoSummary = convoQuery.data
    ? {
        ...convoQuery.data.conversation,
        last_read_at: null,
        members: convoQuery.data.profiles,
      }
    : null;

  const title = convoSummary && uid ? conversationDisplayName(convoSummary, uid) : "Chat";
  const isGroup = convoQuery.data?.conversation.type === "group";

  const sendText = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      await sendTextMessage(conversationId, body);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to send");
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const onPickFile = () => fileInputRef.current?.click();

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      // De-dupe: same filename+size already uploading?
      if (uploads.some((u) => u.fileName === file.name && u.fileSize === file.size)) {
        toast.info("That file is already uploading.");
        return;
      }
      const err = validateFile(file);
      if (err) {
        toast.error(formatValidationError(err));
        return;
      }
      const controller = new AbortController();
      const id = crypto.randomUUID();
      setUploads((u) => [...u, { id, fileName: file.name, fileSize: file.size, controller }]);
      try {
        await uploadFileAndSend({ conversationId, file, signal: controller.signal });
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") {
          toast.info("Upload cancelled.");
        } else {
          console.error(e);
          toast.error(e instanceof Error ? e.message : "Upload failed");
        }
      } finally {
        setUploads((u) => u.filter((x) => x.id !== id));
      }
    },
    [conversationId, uploads],
  );

  const onDelete = async (id: string) => {
    try {
      await deleteMessage(id);
      qc.setQueryData<MessageRow[]>(["messages", conversationId], (prev) =>
        (prev ?? []).filter((m) => m.id !== id),
      );
    } catch (e) {
      console.error(e);
      toast.error("Couldn't delete message.");
    }
  };

  const messages = messagesQuery.data ?? [];
  const isLoading = messagesQuery.isLoading || convoQuery.isLoading;
  const isError = messagesQuery.isError || convoQuery.isError;

  return (
    <div className="flex h-screen flex-col bg-gradient-surface">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur">
        <Button size="icon-sm" variant="ghost" asChild title="Back">
          <Link to="/messages"><ArrowLeft className="size-4" /></Link>
        </Button>
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary/10 text-primary">
            {isGroup ? <Users className="size-4" /> : conversationInitials(title)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {isGroup
              ? `${convoQuery.data?.profiles.length ?? 0} members`
              : "Direct message"}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-3 sm:px-6 py-4">
          {isLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : isError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Couldn't load messages.
            </p>
          ) : messages.length === 0 ? (
            <div className="mt-8 text-center text-sm text-muted-foreground">
              No messages yet. Say hi!
            </div>
          ) : (
            <ul className="space-y-2">
              {messages.map((m) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  isMine={m.sender_id === uid}
                  senderName={
                    profileById.get(m.sender_id)?.display_name ||
                    profileById.get(m.sender_id)?.email ||
                    "Unknown"
                  }
                  showSender={isGroup === true}
                  onDelete={() => onDelete(m.id)}
                />
              ))}
            </ul>
          )}

          {uploads.map((u) => (
            <div
              key={u.id}
              className="ml-auto mt-2 flex max-w-xs items-center gap-3 rounded-lg border border-border/60 bg-secondary px-3 py-2 text-sm"
            >
              <Loader2 className="size-4 animate-spin" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{u.fileName}</div>
                <div className="text-[11px] text-muted-foreground">
                  Uploading · {formatFileSize(u.fileSize)}
                </div>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => u.controller.abort()}
                title="Cancel upload"
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/70 px-3 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onPickFile}
            title="Attach a file"
            className="shrink-0"
          >
            <Paperclip className="size-4" />
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendText();
              }
            }}
            placeholder="Type a message…"
            rows={1}
            className="min-h-[40px] max-h-40 resize-none"
          />
          <Button
            type="button"
            size="icon"
            onClick={() => void sendText()}
            disabled={sending || !text.trim()}
            title="Send"
            className="shrink-0"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-muted-foreground">
          Files up to 25 MB · pdf, doc, xls, ppt, images, txt, zip
        </p>
      </div>
    </div>
  );
}

function MessageItem({
  message,
  isMine,
  senderName,
  showSender,
  onDelete,
}: {
  message: MessageRow;
  isMine: boolean;
  senderName: string;
  showSender: boolean;
  onDelete: () => void;
}) {
  const time = new Date(message.created_at);
  return (
    <li className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div className={`group relative max-w-[85%] ${isMine ? "items-end" : "items-start"}`}>
        {showSender && !isMine && (
          <div className="mb-0.5 pl-3 text-[11px] text-muted-foreground">{senderName}</div>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm shadow-soft ${
            isMine
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-card text-foreground border border-border/60 rounded-bl-md"
          }`}
        >
          {message.message_type === "file" ? (
            <FileMessage msg={message} />
          ) : (
            <div className="whitespace-pre-wrap break-words">{message.body}</div>
          )}
        </div>
        <div
          className={`mt-0.5 flex items-center gap-2 px-2 text-[10px] text-muted-foreground ${
            isMine ? "justify-end" : "justify-start"
          }`}
        >
          <span title={format(time, "PPpp")}>
            {formatDistanceToNow(time, { addSuffix: true })}
          </span>
          {isMine && (
            <button
              type="button"
              onClick={onDelete}
              className="invisible inline-flex items-center gap-0.5 rounded hover:text-destructive group-hover:visible"
              title="Delete"
            >
              <Trash2 className="size-3" /> Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}