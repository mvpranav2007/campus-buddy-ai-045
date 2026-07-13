import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { buildStoragePath } from "./file-utils";

export type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
export type ConversationMemberRow =
  Database["public"]["Tables"]["conversation_members"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type ConversationSummary = ConversationRow & {
  members: Array<Pick<ProfileRow, "id" | "email" | "display_name" | "avatar_url">>;
  last_read_at: string | null;
};

const BUCKET = "chat-files";

export async function listConversations(): Promise<ConversationSummary[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const { data: memberships, error: mErr } = await supabase
    .from("conversation_members")
    .select("conversation_id, last_read_at")
    .eq("user_id", uid);
  if (mErr) throw mErr;
  if (!memberships || memberships.length === 0) return [];

  const ids = memberships.map((m) => m.conversation_id);
  const readMap = new Map(memberships.map((m) => [m.conversation_id, m.last_read_at]));

  const { data: convos, error: cErr } = await supabase
    .from("conversations")
    .select("*")
    .in("id", ids)
    .order("last_message_at", { ascending: false });
  if (cErr) throw cErr;

  const { data: allMembers, error: memErr } = await supabase
    .from("conversation_members")
    .select("conversation_id, user_id")
    .in("conversation_id", ids);
  if (memErr) throw memErr;

  const userIds = Array.from(new Set(allMembers?.map((m) => m.user_id) ?? []));
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .in("id", userIds);
  if (pErr) throw pErr;
  const pById = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  return (convos ?? []).map((c) => ({
    ...c,
    last_read_at: readMap.get(c.id) ?? null,
    members: (allMembers ?? [])
      .filter((m) => m.conversation_id === c.id)
      .map((m) => pById.get(m.user_id))
      .filter((p): p is ProfileRow => !!p),
  }));
}

export async function getConversation(id: string) {
  const { data: convo, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!convo) return null;

  const { data: members, error: mErr } = await supabase
    .from("conversation_members")
    .select("user_id, joined_at, last_read_at")
    .eq("conversation_id", id);
  if (mErr) throw mErr;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url")
    .in("id", (members ?? []).map((m) => m.user_id));

  return {
    conversation: convo,
    members: members ?? [],
    profiles: profiles ?? [],
  };
}

export async function listMessages(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function sendTextMessage(conversationId: string, body: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: uid,
      message_type: "text",
      body,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMessage(id: string) {
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}

export async function markConversationRead(conversationId: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;
  await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", uid);
}

// Signed URL cache (short-lived, in-memory)
const signedCache = new Map<string, { url: string; exp: number }>();

export async function getSignedFileUrl(path: string, expiresIn = 60): Promise<string> {
  const now = Date.now();
  const cached = signedCache.get(path);
  if (cached && cached.exp - now > 5_000) return cached.url;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw error ?? new Error("Failed to sign URL");
  signedCache.set(path, { url: data.signedUrl, exp: now + expiresIn * 1000 });
  return data.signedUrl;
}

export async function getSignedDownloadUrl(path: string, filename: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60, { download: filename });
  if (error || !data?.signedUrl) throw error ?? new Error("Failed to sign URL");
  return data.signedUrl;
}

export type UploadResult = {
  path: string;
  file_name: string;
  file_size: number;
  file_type: string;
};

/** Uploads file to storage and inserts a `messages` row of type 'file'. */
export async function uploadFileAndSend(params: {
  conversationId: string;
  file: File;
  signal?: AbortSignal;
}): Promise<MessageRow> {
  const { conversationId, file, signal } = params;
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");

  const path = buildStoragePath(uid, conversationId, file.name);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
  if (upErr) throw upErr;

  if (signal?.aborted) {
    // clean up the orphaned upload
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw new DOMException("Aborted", "AbortError");
  }

  const { data: msg, error: mErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: uid,
      message_type: "file",
      file_name: file.name,
      file_size: file.size,
      file_type: file.type || "application/octet-stream",
      file_path: path,
    })
    .select("*")
    .single();
  if (mErr) {
    // rollback the file so we don't leak orphans
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw mErr;
  }
  return msg;
}

export async function searchProfilesByEmail(query: string, excludeIds: string[] = []) {
  const q = query.trim();
  if (q.length < 3) return [];
  // Delegates to a server function using the admin client so we can find a
  // user by exact email without exposing the profiles.email column via RLS.
  // Returns id/display_name/avatar_url only — never email.
  const { searchUsersByEmail } = await import("./user-search.functions");
  const data = await searchUsersByEmail({ data: { email: q } });
  return (data ?? [])
    .filter((p) => !excludeIds.includes(p.id))
    .map((p) => ({
      id: p.id,
      email: null as string | null,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
    }));
}

/** Ensure or create a DM between the current user and another user id. */
export async function ensureDirectConversation(otherUserId: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  if (otherUserId === uid) throw new Error("Cannot DM yourself");

  // Look up existing DMs both users share
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", uid);
  const myIds = mine?.map((m) => m.conversation_id) ?? [];
  if (myIds.length > 0) {
    const { data: theirs } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", myIds);
    const sharedIds = theirs?.map((m) => m.conversation_id) ?? [];
    if (sharedIds.length > 0) {
      const { data: dms } = await supabase
        .from("conversations")
        .select("id")
        .eq("type", "dm")
        .in("id", sharedIds)
        .limit(1);
      if (dms && dms[0]) return dms[0].id;
    }
  }

  const { data: convo, error } = await supabase
    .from("conversations")
    .insert({ type: "dm", created_by: uid })
    .select("id")
    .single();
  if (error || !convo) throw error ?? new Error("Failed to create conversation");

  const { error: memErr } = await supabase.from("conversation_members").insert([
    { conversation_id: convo.id, user_id: uid },
    { conversation_id: convo.id, user_id: otherUserId },
  ]);
  if (memErr) throw memErr;
  return convo.id;
}

export async function createGroupConversation(name: string, memberIds: string[]): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const clean = name.trim();
  if (!clean) throw new Error("Group name required");

  const { data: convo, error } = await supabase
    .from("conversations")
    .insert({ type: "group", name: clean, created_by: uid })
    .select("id")
    .single();
  if (error || !convo) throw error ?? new Error("Failed to create group");

  const uniqueIds = Array.from(new Set([uid, ...memberIds]));
  const { error: memErr } = await supabase.from("conversation_members").insert(
    uniqueIds.map((user_id) => ({ conversation_id: convo.id, user_id })),
  );
  if (memErr) throw memErr;
  return convo.id;
}

export function conversationDisplayName(
  c: ConversationSummary,
  currentUserId: string,
): string {
  if (c.type === "group") return c.name ?? "Group";
  const other = c.members.find((m) => m.id !== currentUserId);
  return other?.display_name || other?.email || "Direct message";
}

export function conversationInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase() || "?";
}