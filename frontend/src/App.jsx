
import { useState } from "react";
import axios from "axios";
import {
  Activity,
  ArrowUpRight,
  Check,
  Clipboard,
  Cpu,
  Database,
  LoaderCircle,
  MessageSquareText,
  Play,
  Sparkles,
  Zap,
  CircleAlert,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const SAMPLE_PROMPT =
  "Suggest one useful AI application idea for Pakistan. Explain the problem, target users, and one practical MVP feature.";

export default function App() {
  const [prompt, setPrompt] = useState(SAMPLE_PROMPT);
  const [result, setResult] = useState("");
  const [model, setModel] = useState("");
  const [recordId, setRecordId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generateResponse() {
    if (!prompt.trim()) {
      setError("Please enter a prompt first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");
    setModel("");
    setRecordId("");

    try {
      const response = await axios.post(
        `${API_URL}/api/test/full`,
        { prompt: prompt.trim() }
      );

      const payload = response.data;
      const aiText = payload?.data?.response;

      if (!payload?.success || !aiText) {
        throw new Error(
          payload?.message || "The AI returned an empty response."
        );
      }

      setResult(aiText);
      setModel(payload.model || "AI model");
      setRecordId(payload.data?._id || "");
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Something went wrong.";

      setError(
        `${message} Check that your backend is running at ${API_URL}.`
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyResponse() {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Unable to copy the response. Please copy it manually.");
    }
  }

  return (
    <div className="min-h-screen text-slate-100">
      <header className="border-b border-white/10 bg-[#080d19]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-indigo-200">
              <Sparkles size={20} />
            </div>

            <div>
              <p className="text-sm font-semibold text-white">
                WTQ AI Studio
              </p>
              <p className="text-xs text-slate-500">
                Hackathon starter workspace
              </p>
            </div>
          </div>

          <span className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Starter ready
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="mb-10 max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1.5 text-xs text-indigo-200">
            <Zap size={14} />
            React · Vite · Tailwind CSS
          </div>

          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            Turn your prompt into
            <span className="block bg-gradient-to-r from-indigo-300 via-sky-300 to-teal-200 bg-clip-text text-transparent">
              something useful.
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">
            Your reusable AI workspace. Test prompts, inspect responses,
            and customize the interface for your hackathon challenge.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          {/* Prompt panel */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/10 text-sky-200">
                <MessageSquareText size={19} />
              </div>

              <div>
                <h2 className="font-semibold text-white">
                  Prompt workspace
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Describe what you want the AI to do
                </p>
              </div>
            </div>

            <label
              htmlFor="prompt"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Your prompt
            </label>

            <textarea
              id="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Write your question here..."
              rows={9}
              className="w-full resize-y rounded-xl border border-white/10 bg-[#080d19] px-4 py-4 text-sm leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-400/10"
            />

            <div className="mt-3 flex justify-between text-xs text-slate-500">
              <span>{prompt.length} characters</span>

              <button
                type="button"
                onClick={() => setPrompt(SAMPLE_PROMPT)}
                className="text-slate-400 hover:text-white"
              >
                Use sample prompt
              </button>
            </div>

            <button
              type="button"
              onClick={generateResponse}
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-400 px-5 py-3.5 text-sm font-semibold text-[#090d1a] transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}

              {loading ? "Generating response..." : "Generate response"}

              {!loading && <ArrowUpRight size={16} />}
            </button>

            <p className="mt-3 break-all text-center text-xs text-slate-500">
              API: {API_URL}
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 flex gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm leading-6 text-rose-200"
              >
                <CircleAlert size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Response panel */}
          <div className="flex min-h-[430px] flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-7">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400/10 text-teal-200">
                  <Sparkles size={19} />
                </div>

                <div>
                  <h2 className="font-semibold text-white">
                    AI response
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Your generated output
                  </p>
                </div>
              </div>

              {result && (
                <button
                  type="button"
                  onClick={copyResponse}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/10"
                >
                  {copied ? <Check size={14} /> : <Clipboard size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>

            {!result && !loading && (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-500">
                  <Cpu size={24} />
                </div>

                <p className="font-medium text-slate-300">
                  Your response will appear here
                </p>
                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  Enter a prompt and generate your first AI response.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <LoaderCircle
                  size={28}
                  className="animate-spin text-indigo-300"
                />
                <p className="mt-4 font-medium text-slate-200">
                  Working on your response
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  This may take a few seconds.
                </p>
              </div>
            )}

            {result && !loading && (
              <div className="flex-1">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
                    <Check size={12} />
                    Success
                  </span>

                  <span className="rounded-full border border-indigo-300/20 bg-indigo-300/10 px-2.5 py-1 text-xs text-indigo-200">
                    {model}
                  </span>
                </div>

                <div className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
                  {result}
                </div>

                {recordId && (
                  <p className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-500">
                    <Database size={13} className="mr-1.5 inline-block" />
                    Saved to MongoDB · Record {recordId}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Activity,
              title: "Model fallback",
              desc: "Uses the fallback logic configured in your backend.",
            },
            {
              icon: Database,
              title: "MongoDB saving",
              desc: "Successful full tests are saved by the backend.",
            },
            {
              icon: Cpu,
              title: "Ready to customize",
              desc: "Adapt the prompt and interface to the challenge.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"
            >
              <Icon size={18} className="mb-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {desc}
              </p>
            </div>
          ))}
        </section>

        <footer className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-slate-600 sm:flex-row sm:justify-between">
          <span>WTQ AI Studio · Starter boilerplate</span>
          <span>Keep API keys on the backend only.</span>
        </footer>
      </main>
    </div>
  );
}

