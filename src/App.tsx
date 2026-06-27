/**
 * ApplyAI — Job Application Assistant
 * Updated: CV upload feature (PDF, DOCX, TXT)
 *
 * ────────────────────────────────
 * 1. The "Your Experience" textarea is now optional — users can either
 *    upload a CV file OR paste text OR do both (upload + add extra notes)
 *
 * 2. A new CVUploader component handles file selection, parsing feedback,
 *    and the extracted text preview
 *
 * 3. The system prompts are updated to handle real CV content:
 *    CV_SYSTEM now instructs Claude to work from a full CV structure
 *    (role → company → bullets) rather than just bullet notes
 *
 * 4. The userMessage passed to Claude is assembled differently:
 *    - If CV uploaded: "Uploaded CV:\n{extracted text}\n\nExtra notes:\n{textarea}"
 *    - If no upload: "My Experience:\n{textarea text}" (original behaviour)
 */

import { useState, useRef, useCallback, useEffect } from "react"
import {
  Briefcase,
  FileText,
  Sparkles,
  RotateCcw,
  AlertCircle,
} from "lucide-react"
import { streamFromClaude } from "./lib/anthropic"
import { type ParseResult } from "./lib/fileParser"
import CVUploader from "./components/CVUploader"
import StepBadge from "./components/StepBadge"
import OutputCard from "./components/OutputCard"
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import HeroRipple from "./components/animations/HeroRipple"


// ─── Types ────────────────────────────────────────────────────────────────

type OutputSection = "cv" | "cover"
type Status = "idle" | "parsing" | "streaming-cv" | "streaming-cover" | "done" | "error"

interface Output {
  cv: string
  cover: string
}

// ─── Prompt Engineering ────────────────────────────────────────────────────
//
// CV_SYSTEM is updated to handle two input types:
//   A) Full CV text (when user uploads a file) — Claude sees role/company/bullet structure
//   B) Raw bullet notes (when user pastes manually) — original behaviour
//
// The key addition is the "PARSING INSTRUCTIONS" block which tells Claude
// how to handle real CV content — prioritise recent roles, handle both
// weak bullets (Oremei's style: task-focused) and strong bullets (Sonia's
// style: already quantified) appropriately.

const CV_SYSTEM = `You are an expert career coach and CV writer with 15 years of experience at top recruiting firms. You write powerful, ATS-optimised CV bullet points that get candidates noticed.

You will receive the candidate's experience in one of two formats:
1. A full CV (extracted from a PDF or Word file) — with role titles, companies, dates, and existing bullets
2. Freeform notes or existing bullet points pasted manually

PARSING INSTRUCTIONS (for uploaded CVs):
- Read the full CV to understand the candidate's career trajectory and strongest achievements
- Prioritise experience from the most recent and most relevant roles for this job description
- For weak bullets (task-focused, no impact metrics): rewrite using context clues to infer reasonable impact. A fintech backend developer handling "bulk transactions in a banking hall" is likely processing hundreds of transactions per day — say so.
- For strong bullets (already quantified, outcome-focused): preserve the achievement, sharpen the language, and ensure it mirrors the job description's keywords
- Extract technical skills from any dedicated skills sections and weave them into bullets where natural
- NEVER invent specific numbers you can't reasonably infer. Use ranges or qualitative impact when exact numbers aren't available.

YOUR BULLET FORMULA:
Strong action verb + specific task/technology + quantified or described impact

STRONG ACTION VERBS: Architected, Delivered, Engineered, Reduced, Increased, Led, Implemented, Designed, Migrated, Optimised, Built, Launched, Integrated, Automated, Mentored

OUTPUT FORMAT — respond exactly like this:
## Tailored CV Bullet Points

- [Bullet 1]
- [Bullet 2]
- [Bullet 3]
[6-8 bullets total, each on its own line]

No introductory text. No explanation. Just the heading and bullets.`

const COVER_SYSTEM = `You are an expert at writing compelling cover letters that get interviews. You write in a warm, confident, professional voice — never robotic or generic.

You may receive the candidate's full CV as context. Use specific details from their experience — company names, technologies, achievements — to make the letter feel personal and specific, not templated.

A great cover letter:
- Opens with a hook that shows you understand the company's challenge or mission
- Connects 2–3 SPECIFIC experiences from the CV directly to what this role needs
- Shows enthusiasm for THIS role, not any role
- Closes with confidence and a clear call to action
- Is 3 short paragraphs — recruiters spend 30 seconds reading

RULES:
- Use real details from the CV. If you see they built a RabbitMQ system or reduced load time from 7s to 2.5s — mention it specifically.
- Address as "Dear Hiring Manager," unless a name appears in the job description
- No [placeholders]. Write the complete letter.
- Do not start with "I am writing to apply for..."

FORMAT:
## Cover Letter

Dear Hiring Manager,

[Opening paragraph — hook + why this role]

[Middle paragraph — 2-3 specific experiences tied to role requirements]

[Closing paragraph — enthusiasm + call to action]

[Sign-off]`

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildUserMessage(
  jobDesc: string,
  cvParsed: ParseResult | null,
  extraNotes: string
): string {
  const parts: string[] = [`Job Description:\n${jobDesc}`]

  if (cvParsed?.text) {
    parts.push(`Uploaded CV (${cvParsed.fileName}):\n${cvParsed.text}`)
    if (extraNotes.trim()) {
      parts.push(`Additional notes from candidate:\n${extraNotes}`)
    }
  } else if (extraNotes.trim()) {
    parts.push(`My Experience:\n${extraNotes}`)
  }

  return parts.join("\n\n---\n\n")
}


// ─── Main App ──────────────────────────────────────────────────────────────

export default function App() {
  const [jobDesc, setJobDesc] = useState("")
  const [extraNotes, setExtraNotes] = useState("")
  const [cvParsed, setCvParsed] = useState<ParseResult | null>(null)
  const [parsing, setParsing] = useState(false)
  const [output, setOutput] = useState<Output>({ cv: "", cover: "" })
  const [status, setStatus] = useState<Status>("idle")
  const [activeSection, setActiveSection] = useState<OutputSection | null>(null)
  const [error, setError] = useState("")
  const stopRef = useRef<(() => void) | null>(null)
  const [isScrolled, setIsScrolled] = useState(false);
  // const location = useLocation();

  const handleScroll = useCallback(() => {
    setIsScrolled(window.scrollY > 50);
  }, []);

  useEffect(() => {
  window.addEventListener("scroll", handleScroll)
  return () => window.removeEventListener("scroll", handleScroll)
}, [handleScroll])

  const cvDone = output.cv.length > 0 && status !== "streaming-cv"
  const coverDone = output.cover.length > 0 && status !== "streaming-cover"
  const isStreaming = status === "streaming-cv" || status === "streaming-cover"

  // Has enough input to generate
  const hasExperience = !!(cvParsed?.text || extraNotes.trim().length > 30)
  const canGenerate = jobDesc.trim().length > 50 && hasExperience

  // Wrap parseCV to set parsing state
  const handleUpload = async (result: ParseResult) => {
    setParsing(false)
    setCvParsed(result)
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return
    setOutput({ cv: "", cover: "" })
    setError("")
    setStatus("streaming-cv")
    setActiveSection("cv")

    const userMessage = buildUserMessage(jobDesc, cvParsed, extraNotes)

    // Step 1: CV bullets
    const stop1 = await streamFromClaude({
      system: CV_SYSTEM,
      userMessage,
      onChunk: (token) => setOutput((prev) => ({ ...prev, cv: prev.cv + token })),
      onComplete: async () => {
        setStatus("streaming-cover")
        setActiveSection("cover")

        // Step 2: Cover letter — same userMessage so Claude has full context
        const stop2 = await streamFromClaude({
          system: COVER_SYSTEM,
          userMessage,
          onChunk: (token) =>
            setOutput((prev) => ({ ...prev, cover: prev.cover + token })),
          onComplete: () => {
            setStatus("done")
            setActiveSection(null)
          },
          onError: (msg) => {
            setError(msg)
            setStatus("error")
          },
          maxTokens: 1024,
        })
        stopRef.current = stop2
      },
      onError: (msg) => {
        setError(msg)
        setStatus("error")
      },
      maxTokens: 1500,
    })
    stopRef.current = stop1
  }, [jobDesc, cvParsed, extraNotes, canGenerate])

  const handleReset = () => {
    stopRef.current?.()
    setOutput({ cv: "", cover: "" })
    setStatus("idle")
    setActiveSection(null)
    setError("")
  }

  const handleClearCV = () => {
    setCvParsed(null)
    setParsing(false)
  }

  const hasOutput = output.cv || output.cover

  const isOverDarkHero = !isScrolled;
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  /* ============================================
   SplitLine — scroll-triggered text reveal
   ============================================ */
function SplitLine({
  children,
  delay = 0,
}: {
  children: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <span ref={ref} className="block overflow-hidden">
      <motion.span
        className="block"
        initial={{ y: "110%", rotate: 3 }}
        animate={isInView ? { y: "0%", rotate: 0 } : { y: "110%", rotate: 3 }}
        transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

  return (
    <div className="min-h-screen bg-slate-25">
      {/* Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 2.5, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
          isScrolled
            ? "bg-brand-dark/90 backdrop-blur-xl border-b border-brand-navy/[0.06] shadow-sm"
            : "bg-transparent"
        }`}
      >
        <nav className="max-w-[1400px] mx-auto px-6 lg:px-16 flex items-center justify-between h-24">
          {/* Logo */}
          <a
            href="/"
            className="relative z-50"
            aria-label="Job Apply"
          >
            <div className="flex items-center gap-2.5">
            <div className="w-12 h-12 bg-brand-blue rounded-lg flex items-center justify-center">
              <Briefcase size={24} className="text-white" />
            </div>
            <span
            className={isOverDarkHero ? "font-bold text-white text-2xl" : "font-bold text-slate-900 text-2xl"}
            style={{ fontFamily: "'Transforma Mix', 'Playfair Display', Georgia, serif" }}>JobAssist</span>
          </div>
          </a>

          {/* CTA Button */}
          <a
            href="#main"
            className={`hidden lg:flex items-center gap-2 px-6 py-2.5 border text-[13px] font-medium tracking-wider uppercase rounded-full transition-all duration-300 ${
              isOverDarkHero
                ? "border-white/25 text-white/80 hover:border-white/50 hover:text-white hover:bg-white/5"
                : "border-brand-navy/15 text-brand-navy/70 hover:border-brand-blue hover:text-brand-blue hover:bg-brand-blue/5"
            }`}
          >
            <span>Let&apos;s Begin</span>
            <svg
              className="w-3.5 h-3.5 -rotate-45"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </a>
        </nav>
      </motion.header>

      {/* Hero */}
      <section
        ref={heroRef}
        className="relative min-h-[75vh] flex items-end pb-20 md:pb-24 pt-40 overflow-hidden"
      >
        <HeroRipple />

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative w-full"
        >
          <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex gap-3 font-display text-brand-secondary text-xs font-semibold uppercase tracking-[0.25em] mb-6"
            >
              <Sparkles size={12} />
              AI-powered in seconds
            </motion.span>

            <h1
              className="font-bold text-white leading-[0.95]"
              style={{ fontFamily: "'Transforma Mix', 'Playfair Display', Georgia, serif", fontSize: "clamp(1.5rem, 5vw, 6rem)" }}
            >
              <SplitLine delay={0.4}>Get a tailored application</SplitLine>
              {/* <SplitLine delay={0.5}>{"application"}</SplitLine> */}
              <SplitLine delay={0.6}>{"for any job."}</SplitLine>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="mt-8 text-white/70 text-base md:text-lg leading-relaxed max-w-3xl"
            >
              Upload your CV or paste your experience. Add the job description. <span style={{ fontFamily: "'Transforma Mix', 'Playfair Display', Georgia, serif"}}>JobAssist</span> writes
              ATS-optimised bullet points and a cover letter matched precisely to the role.
            </motion.p>
          </div>
        </motion.div>
      </section>

      {/* Main */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8" id="main">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left — Inputs */}
          <div className="space-y-5">

            {/* Job Description */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                <label className="block text-lg font-semibold text-slate-800 mb-0.5"
                style={{ fontFamily: "'Transforma Mix', 'Playfair Display', Georgia, serif" }}>
                  Job Description
                </label>
                <p className="text-sm text-slate-400">Paste the full job posting</p>
              </div>
              <textarea
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                placeholder="We're looking for a Senior Software Engineer to join our platform team. You'll be responsible for designing scalable APIs, mentoring junior engineers…"
                className="w-full px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none resize-none min-h-[160px]"
                disabled={isStreaming}
              />
            </div>

            {/* CV Upload */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                <label className="block text-lg font-semibold text-slate-800 mb-0.5"
                style={{ fontFamily: "'Transforma Mix', 'Playfair Display', Georgia, serif" }}>
                  Your CV
                </label>
                <p className="text-sm text-slate-400">
                  Upload a file — or paste notes below if you don't have a CV file
                </p>
              </div>
              <div className="p-4 space-y-3">
                <CVUploader
                  parsed={cvParsed}
                  parsing={parsing}
                  onParsed={handleUpload}
                  onClear={handleClearCV}
                  disabled={isStreaming}
                />

                {/* Extra notes — always visible, labelled differently based on upload state */}
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1.5">
                    {cvParsed?.text
                      ? "Additional context (optional)"
                      : "Or paste your experience here"}
                  </label>
                  <textarea
                    value={extraNotes}
                    onChange={(e) => setExtraNotes(e.target.value)}
                    placeholder={
                      cvParsed?.text
                        ? "Add anything not in your CV — recent projects, specific achievements, skills you want to highlight…"
                        : "- Led a team of 4 engineers to rebuild the payment gateway, reducing latency by 40%\n- Built REST APIs serving 2M daily requests using Node.js and PostgreSQL\n- Mentored 3 junior developers through weekly code reviews"
                    }
                    className="w-full px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none resize-none border border-slate-200 rounded-lg min-h-[100px] focus:border-slate-300 transition-colors"
                    disabled={isStreaming}
                  />
                </div>
              </div>
            </div>

            {/* Step indicator */}
            {(isStreaming || hasOutput) && (
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-4 animate-fade-in">
                <StepBadge
                  step={1}
                  label="CV Bullets"
                  active={status === "streaming-cv"}
                  done={cvDone}
                />
                <StepBadge
                  step={2}
                  label="Cover Letter"
                  active={status === "streaming-cover"}
                  done={coverDone}
                />
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 animate-fade-in">
                <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || isStreaming}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-navy hover:bg-brand-blue disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl px-5 py-3 transition-all active:scale-[0.98]"
              >
                <Sparkles size={15} />
                {isStreaming
                  ? "Generating…"
                  : status === "done"
                  ? "Regenerate"
                  : "Generate Application"}
              </button>
              {hasOutput && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-3 transition-all"
                >
                  <RotateCcw size={14} />
                  Reset
                </button>
              )}
            </div>

            {!canGenerate && !isStreaming && (
              <p className="text-xs text-slate-500 text-center">
                {jobDesc.trim().length < 50
                  ? "Add at least 50 characters of job description"
                  : "Upload your CV or add at least 30 characters of experience"}
              </p>
            )}
          </div>

          {/* Right — Output */}
          <div className="space-y-5">
            <OutputCard
              title="CV Bullet Points"
              content={output.cv}
              isStreaming={activeSection === "cv"}
              icon={<FileText size={15} />}
            />
            <OutputCard
              title="Cover Letter"
              content={output.cover}
              isStreaming={activeSection === "cover"}
              icon={<Briefcase size={15} />}
            />

            {status === "done" && (
              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-2 animate-slide-up">
                <span className="text-green-500 text-sm">✓</span>
                <p className="text-sm text-green-700 font-medium">
                  Your tailored application is ready. Review, personalise, and send!
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
