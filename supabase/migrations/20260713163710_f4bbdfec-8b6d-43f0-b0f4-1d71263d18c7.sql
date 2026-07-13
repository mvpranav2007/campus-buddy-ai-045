
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;
REVOKE ALL ON FUNCTION private.is_conversation_member(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.is_conversation_member(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.shares_conversation(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members cm1
    JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
    WHERE cm1.user_id = _a AND cm2.user_id = _b
  );
$$;
REVOKE ALL ON FUNCTION private.shares_conversation(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.shares_conversation(uuid, uuid) TO authenticated, service_role;

-- Rewire public.* policies
DROP POLICY IF EXISTS "members can view conversation" ON public.conversations;
CREATE POLICY "members can view conversation" ON public.conversations
FOR SELECT TO authenticated
USING (private.is_conversation_member(id, auth.uid()));

DROP POLICY IF EXISTS "members view membership rows" ON public.conversation_members;
CREATE POLICY "members view membership rows" ON public.conversation_members
FOR SELECT TO authenticated
USING (private.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "members read messages" ON public.messages;
CREATE POLICY "members read messages" ON public.messages
FOR SELECT TO authenticated
USING (private.is_conversation_member(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "members send messages" ON public.messages;
CREATE POLICY "members send messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND private.is_conversation_member(conversation_id, auth.uid())
);

-- Rewire storage.objects policy
DROP POLICY IF EXISTS "chat-files read as conversation member" ON storage.objects;
CREATE POLICY "chat-files read as conversation member" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-files'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.file_path = storage.objects.name
      AND private.is_conversation_member(m.conversation_id, auth.uid())
  )
);

DROP FUNCTION IF EXISTS public.is_conversation_member(uuid, uuid);

-- Restrict profiles reads
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "read own or shared-conversation profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR private.shares_conversation(auth.uid(), id)
);

-- Email-hiding user search RPC
CREATE OR REPLACE FUNCTION public.search_users_by_email(q text)
RETURNS TABLE (id uuid, display_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE length(trim(q)) >= 3
    AND lower(p.email) = lower(trim(q))
    AND p.id <> auth.uid()
  LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.search_users_by_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.search_users_by_email(text) TO authenticated;
