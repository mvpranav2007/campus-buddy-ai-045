import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `You are Scholar, a warm, knowledgeable Student Assistance Chatbot for a university.

You help students with:
- Courses, syllabus, timetable, credits
- Attendance rules and tracking
- Assignments, deadlines, submissions
- Exams, results, grading, revaluation
- Fees, scholarships, financial aid
- Placements, internships, career guidance
- Library resources and hours
- Hostel accommodation and rules
- Campus facilities, clubs, events

Guidelines:
- Be concise, friendly and encouraging.
- Use markdown (bullets, bold, small tables) for clarity.
- When you don't know a specific policy for a given institution, say so and suggest whom to contact (registrar, dean, HOD, hostel warden, placement cell).
- Never invent phone numbers, links, or personal data.
- Ask a short clarifying question when the request is ambiguous.`;

type ChatBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        try {
          const gateway = createLovableAiGatewayProvider(key);
          const result = streamText({
            model: gateway("google/gemini-2.5-flash"),
            system: SYSTEM_PROMPT,
            messages: await convertToModelMessages(messages as UIMessage[]),
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
          });
        } catch (err) {
          console.error("chat error", err);
          return new Response("Chat service error", { status: 500 });
        }
      },
    },
  },
});