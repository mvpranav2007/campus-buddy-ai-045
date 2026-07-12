## Goal

Add a real user-to-user messaging system (1:1 DMs + group chats) to Scholar, then layer file sharing on top. The existing AI chat (`/chat`), `chat_history` table, and auth stay untouched.

## New surfaces

- `/messages` — list of the user's conversations (DMs + groups), newest activity first, unread count, search by name.
- `/messages/new` — start a DM (search users by email) or create a group (name + pick members).
- `/messages/$conversationId` — message thread: bubbles, composer, paperclip attachment, realtime updates.
- Header link "Messages" added to the existing chat header (does not remove any existing controls).

All new routes live under `src/routes/_authenticated/messages.*.tsx` so the existing auth gate protects them.

## Data model (new tables only — nothing existing is altered)

```text
profiles(id=auth.uid PK, email, display_name, avatar_url, created_at)
conversations(id, type: 'dm' | 'group', name nullable, created_by, created_at, last_message_at)
conversation_members(conversation_id, user_id, joined_at, last_read_at, PK(conversation_id,user_id))
messages(id, conversation_id, sender_id, message_type: 'text' | 'file',
         body nullable,
         file_name, file_size, file_type, file_path, file_url nullable,
         created_at)
```

- 1:1 vs group is distinguished by `conversations.type`; both use the same `messages` table via `conversation_id`. No `receiver_id` / `group_id` split — cleaner and lets RLS use a single membership check.
- `profiles` auto-created by trigger on `auth.users` insert so users are searchable.
- Realtime enabled on `messages` and `conversations`.

## Storage

- Private bucket `chat-files` (not public).
- Path: `{sender_id}/{conversation_id}/{timestamp}-{sanitized_filename}` — sender-id prefix satisfies the "own folder" storage RLS; conversation folder groups files; timestamp prevents collisions.
- Access via short-lived signed URLs generated on demand (never public URLs).
- 25 MB limit + MIME allowlist enforced at bucket, client, and RLS.

Allowed MIME types: pdf, msword, wordprocessingml, ms-excel, spreadsheetml, ms-powerpoint, presentationml, jpeg, png, gif, webp, plain, zip.

## RLS

**messages / conversations / conversation_members** — a `SECURITY DEFINER` helper `is_conversation_member(conv_id, user_id)` avoids recursion. Policies:
- SELECT: user must be a member of the conversation.
- INSERT message: sender_id = auth.uid() AND is_conversation_member.
- DELETE message: sender_id = auth.uid() (own messages only).
- conversation_members SELECT: rows where you are a member.
- conversations INSERT: created_by = auth.uid().

**storage.objects on bucket `chat-files`**:
- INSERT: authenticated AND `(storage.foldername(name))[1] = auth.uid()::text`.
- SELECT: authenticated AND EXISTS a message with `file_path = name` whose conversation the user is a member of.
- DELETE: authenticated AND `(storage.foldername(name))[1] = auth.uid()::text`.

**profiles**: SELECT to authenticated (needed to search users), UPDATE only own row.

## Upload flow

1. Paperclip button → hidden `<input type=file>` with `accept` allowlist.
2. Client validates extension, MIME, size (≤25 MB), non-empty. Show inline error on reject — never start upload.
3. Sanitize filename (`[^a-zA-Z0-9._-]` → `_`, collapse dashes, strip leading dots).
4. Guard: if a file with same name is already uploading in this conversation, ignore the second selection.
5. `supabase.storage.from('chat-files').upload(path, file, { upsert: false })` with an `AbortController` + progress via XHR fallback in a small `uploadFile` helper (Supabase JS ships XHR progress).
6. Insert a `messages` row with `message_type='file'`, `file_path`, `file_name`, `file_size`, `file_type`. Realtime broadcasts to other members.
7. Recipient renders bubble: image preview for image mimes (signed URL, lazy), otherwise icon by type (PDF/Word/Excel/PPT/ZIP/generic) + filename + size + sender + time; download and open-in-new-tab actions request a fresh signed URL (60s TTL) on click so expired URLs never break the UX.

## UI

Reuses shadcn primitives already in the project (`Button`, `Input`, `Card`, `toast` via `sonner`, lucide icons). File bubble is the same rounded surface as text bubbles with an attachment block inside — visually consistent, no new tokens.

Mobile: list ↔ thread is a stacked layout under `md`, split-pane above.

## Existing app — untouched

- `/chat`, `/history`, `chat_history`, `auth`, `reset-password`, `Scholar` AI flow: no code changes.
- Only additive edit to `chat.tsx` header: one new `<Link to="/messages">` button next to the existing icons.

## Deliverables after implementation

1. File list (created/modified).
2. The SQL migrations (tables, indexes, realtime publication, RLS, triggers).
3. Storage bucket config (name `chat-files`, private, 25 MB, MIME allowlist).
4. Every RLS policy on messages / conversations / conversation_members / profiles / storage.objects.
5. Confirmation that no env vars are needed and no existing chat code was altered beyond one additive header link.

## Confirm before I build

This is ~10 new files, 2 migrations, 1 bucket, and ~15 RLS policies. Reply "go" and I'll implement it in one pass. If you'd rather scope down (e.g. DMs only, no groups; or files only without realtime), tell me and I'll trim.