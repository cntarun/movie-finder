"use client";

import { useState, useRef } from "react";
import Image from "next/image";

export default function Home() {
  const [description, setDescription] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [history, setHistory] = useState([]);
  const [refinement, setRefinement] = useState("");
  const [showRefine, setShowRefine] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);

        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) throw new Error("Transcription failed");

          const data = await res.json();
          if (data.text) {
            if (showRefine) {
              setRefinement((prev) => (prev ? prev + " " + data.text : data.text));
            } else {
              setDescription((prev) => (prev ? prev + " " + data.text : data.text));
            }
          }
        } catch {
          setError("Failed to transcribe audio. Please try again.");
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setError("Could not access microphone.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setShowRefine(false);
    setHistory([]);

    try {
      const res = await fetch("/api/find-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      if (!res.ok) throw new Error("Something went wrong");

      const data = await res.json();
      setResults(data.results);
      setHistory([{
        userMessage: description,
        guesses: data.results.map((r) => ({ title: r.title, year: r.year, reason: r.reason })),
      }]);
      setShowRefine(true);
    } catch {
      setError("Failed to find movies. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine(e) {
    e.preventDefault();
    if (!refinement.trim()) return;

    setLoading(true);
    setError(null);

    const message = `The user said none of those were right. Here's more context: "${refinement}". Try 3 different movies that better match the original description combined with this new information. Do NOT repeat any previous guesses.`;

    try {
      const res = await fetch("/api/find-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: message, history }),
      });

      if (!res.ok) throw new Error("Something went wrong");

      const data = await res.json();
      setResults(data.results);
      setHistory((prev) => [
        ...prev,
        {
          userMessage: message,
          guesses: data.results.map((r) => ({ title: r.title, year: r.year, reason: r.reason })),
        },
      ]);
      setRefinement("");
    } catch {
      setError("Failed to refine results. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleStartOver() {
    setDescription("");
    setResults(null);
    setHistory([]);
    setRefinement("");
    setShowRefine(false);
    setError(null);
  }

  const MicButton = ({ inRefine = false }) => (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      disabled={transcribing || loading}
      className={`absolute right-3 top-3 p-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        recording
          ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 ring-2 ring-red-500/40"
          : "bg-white/5 text-zinc-400 hover:bg-amber-500/10 hover:text-amber-400 backdrop-blur"
      }`}
      title={recording ? "Stop recording" : "Voice input"}
    >
      {transcribing ? (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : recording ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a4 4 0 00-4 4v7a4 4 0 008 0V5a4 4 0 00-4-4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
        </svg>
      )}
    </button>
  );

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-16 sm:py-24">
      <div className="w-full max-w-3xl text-center mb-12">
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-300/80 text-xs tracking-[0.2em] uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          Now Showing
        </div>
        <h1 className="font-display text-6xl sm:text-7xl md:text-8xl font-black mb-5 leading-[0.95]">
          <span className="text-gradient-gold">Cinephile</span>
        </h1>
        <p className="text-zinc-400 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
          That movie on the tip of your tongue?{" "}
          <span className="text-amber-200/90 italic font-display">We&apos;ll find it.</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-10">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/40 via-red-500/30 to-amber-500/40 rounded-2xl blur-md opacity-40 group-focus-within:opacity-80 transition-opacity" />
          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={'"A French film where a guy delivers packages on a bicycle and there\'s a quirky love story..."'}
              rows={4}
              disabled={showRefine}
              className="w-full rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 px-5 py-4 pr-16 text-base text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 resize-none disabled:opacity-60 italic font-display"
            />
            {!showRefine && <MicButton />}
          </div>
        </div>
        {(recording || transcribing) && !showRefine && (
          <p className="mt-3 text-sm text-center text-zinc-400">
            {recording && (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Listening... tap stop when done
              </span>
            )}
            {transcribing && (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Transcribing your audio...
              </span>
            )}
          </p>
        )}
        {!showRefine && (
          <button
            type="submit"
            disabled={loading || !description.trim()}
            className="btn-primary mt-4 w-full rounded-2xl px-6 py-4 text-base font-semibold text-black tracking-wide disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 uppercase"
          >
            {loading ? "Searching the archive..." : "Find My Movie"}
          </button>
        )}
      </form>

      {loading && (
        <div className="flex flex-col items-center gap-4 text-zinc-400 mb-12 fade-in-up">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-zinc-800 border-t-amber-400" />
            <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full border border-amber-400/30" />
          </div>
          <p className="font-display italic text-lg">Searching the archive...</p>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-center mb-8 fade-in-up">{error}</p>
      )}

      {!loading && !results && !error && (
        <div className="text-center fade-in-up mt-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-900/50 border border-zinc-800 mb-4">
            <svg className="w-7 h-7 text-zinc-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <p className="text-zinc-600 font-display italic">Your reel awaits...</p>
        </div>
      )}

      {results && (
        <>
          <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 fade-in-up">
            {results.map((movie, i) => (
              <div
                key={`${movie.title}-${i}`}
                className="card-hover relative rounded-2xl bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 backdrop-blur border border-zinc-800/80 overflow-hidden flex flex-col fade-in-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {i === 0 && (
                  <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-amber-400/95 text-black text-[10px] font-bold tracking-widest uppercase shadow-lg">
                    Top Pick
                  </div>
                )}
                <div className="relative w-full aspect-[2/3] overflow-hidden bg-zinc-900">
                  {movie.poster ? (
                    <Image
                      src={movie.poster}
                      alt={movie.title}
                      width={500}
                      height={750}
                      className="poster-img w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                      <svg className="w-12 h-12 opacity-40" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs uppercase tracking-widest">No poster</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                </div>
                <div className="p-5 flex-1 flex flex-col gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold leading-tight text-white">
                      {movie.title}
                    </h2>
                    <p className="text-xs tracking-[0.2em] uppercase text-amber-400/80 mt-1">
                      {movie.year}
                    </p>
                  </div>
                  <div className="h-px bg-gradient-to-r from-amber-500/30 via-zinc-700/50 to-transparent" />
                  <p className="text-sm text-amber-100/80 leading-relaxed italic font-display">
                    {movie.reason}
                  </p>
                  {movie.overview && (
                    <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3 mt-auto pt-2">
                      {movie.overview}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {showRefine && (
            <div className="w-full max-w-2xl mt-14 fade-in-up">
              <div className="relative rounded-2xl p-6 border border-amber-500/15 bg-gradient-to-br from-zinc-950/80 to-zinc-900/40 backdrop-blur">
                <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs tracking-[0.2em] uppercase">
                  Not quite?
                </div>
                <p className="text-zinc-300 text-sm mb-4 mt-2">
                  Add more details and we&apos;ll try again with fresh picks.
                </p>
                <form onSubmit={handleRefine}>
                  <div className="relative">
                    <textarea
                      value={refinement}
                      onChange={(e) => setRefinement(e.target.value)}
                      placeholder={'"The main character was a woman, and there was a twist at the end..."'}
                      rows={2}
                      className="w-full rounded-xl bg-zinc-950/80 border border-zinc-800 px-4 py-3 pr-14 text-base text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40 resize-none italic font-display"
                    />
                    <MicButton inRefine />
                  </div>
                  {(recording || transcribing) && (
                    <p className="mt-2 text-sm text-center text-zinc-400">
                      {recording && (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                          Listening...
                        </span>
                      )}
                      {transcribing && (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                          Transcribing...
                        </span>
                      )}
                    </p>
                  )}
                  <div className="flex gap-3 mt-4">
                    <button
                      type="submit"
                      disabled={loading || !refinement.trim()}
                      className="btn-primary flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-black uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    >
                      {loading ? "Refining..." : "Try Again"}
                    </button>
                    <button
                      type="button"
                      onClick={handleStartOver}
                      className="rounded-xl border border-zinc-700/80 px-5 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white hover:border-zinc-600 uppercase tracking-wide"
                    >
                      Start Over
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
