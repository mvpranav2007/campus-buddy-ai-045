import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, CalendarClock, GraduationCap, Home, LibraryBig, MessageSquare, Sparkles, Wallet } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scholar — AI Student Assistance Chatbot" },
      {
        name: "description",
        content:
          "Scholar is an AI chatbot that helps students with courses, exams, attendance, fees, scholarships, placements, library and hostel questions — 24/7.",
      },
      { property: "og:title", content: "Scholar — AI Student Assistance Chatbot" },
      { property: "og:description", content: "Instant, friendly answers for every student question — 24/7." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: BookOpen, title: "Courses & syllabus", body: "Explain topics, break down units and suggest study paths." },
  { icon: CalendarClock, title: "Timetable & attendance", body: "Understand schedules and attendance rules at a glance." },
  { icon: Sparkles, title: "Exams & results", body: "Prep strategies, grading queries and revaluation help." },
  { icon: Wallet, title: "Fees & scholarships", body: "Find deadlines, eligibility and financial aid options." },
  { icon: LibraryBig, title: "Library & resources", body: "Renewals, e-books, journals and quiet-hour tips." },
  { icon: Home, title: "Hostel & campus life", body: "Mess menus, curfews, clubs and everyday campus queries." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-surface text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <img src={logo} alt="" width={32} height={32} className="size-8" />
          <span>Scholar</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/auth" className="text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-glow hover:opacity-95"
          >
            Get started <ArrowRight className="size-3.5" />
          </Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-24 md:pt-20 md:pb-32 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground shadow-soft">
              <GraduationCap className="size-3.5 text-accent" />
              Built for students
            </div>
            <h1 className="mt-5 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              Every campus question,{" "}
              <span className="bg-gradient-hero bg-clip-text text-transparent">answered.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-lg">
              Meet Scholar — a friendly AI chatbot that helps you navigate courses,
              exams, fees, hostel life and everything in between.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground font-medium shadow-glow hover:opacity-95"
              >
                Start chatting <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 font-medium hover:bg-accent/10"
              >
                <MessageSquare className="size-4" /> Try a demo question
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-hero opacity-20 blur-3xl rounded-3xl" />
            <div className="relative rounded-3xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <img src={logo} alt="" width={28} height={28} className="size-7" />
                <div className="text-sm font-medium">Scholar</div>
                <div className="ml-auto flex gap-1">
                  <span className="size-2 rounded-full bg-destructive/60" />
                  <span className="size-2 rounded-full bg-accent" />
                  <span className="size-2 rounded-full bg-primary/60" />
                </div>
              </div>
              <div className="space-y-3 pt-4 text-sm">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-secondary px-4 py-2.5">
                  What's the minimum attendance to appear for exams?
                </div>
                <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">
                  Most programs need <b>75%</b> attendance in each subject. If you're
                  below, you'll need a medical/duty exemption or condonation from the
                  Dean. Want me to draft a request?
                </div>
                <div className="ml-auto max-w-[70%] rounded-2xl rounded-br-sm bg-secondary px-4 py-2.5">
                  Yes please 🙏
                </div>
                <div className="max-w-[60%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-muted-foreground">
                  <span className="inline-block size-2 rounded-full bg-primary animate-pulse mr-1" />
                  typing…
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6 shadow-soft transition hover:shadow-glow">
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Scholar. Made for curious students.
      </footer>
    </div>
  );
}
