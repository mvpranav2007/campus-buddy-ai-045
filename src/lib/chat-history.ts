import { supabase } from "@/integrations/supabase/client";

export type ChatHistoryRow = {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  created_at: string;
};

export async function saveChatTurn(question: string, answer: string) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { error: new Error("Not signed in") };
  const { error } = await supabase.from("chat_history").insert({
    user_id: user.id,
    question,
    answer,
  });
  return { error };
}

export async function listChatHistory() {
  return supabase
    .from("chat_history")
    .select("id,user_id,question,answer,created_at")
    .order("created_at", { ascending: false });
}

export async function deleteChatHistory(id: string) {
  return supabase.from("chat_history").delete().eq("id", id);
}