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
          if (data.text) setDescription((prev) => (prev ? prev + " " + data.text : data.text));
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

    try {
      const res = await fetch("/api/find-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      if (!res.ok) throw new Error("Something went wrong");

      const data = await res.json();
      setResults(data.results);
    } catch {
      setError("Failed to find movies. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-2xl text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
          Movie Finder
        </h1>
        <p className="text-zinc-400 text-lg">
          Describe a movie you vaguely remember and we&apos;ll find it for you.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-12">
        <div className="relative">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={'e.g. "A French film where a guy delivers packages on a bicycle and there\'s a quirky love story..."'}
            rows={4}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 pr-14 text-base text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing || loading}
            className={`absolute right-3 top-3 p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              recording
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
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
        </div>
        {(recording || transcribing) && (
          <p className="mt-2 text-sm text-center text-zinc-400">
            {recording && (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Recording... click the stop button when done
              </span>
            )}
            {transcribing && "Transcribing your audio..."}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !description.trim()}
          className="mt-3 w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Searching..." : "Find My Movie"}
        </button>
      </form>

      {loading && (
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
          <p>Thinking about what movie that could be...</p>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-center">{error}</p>
      )}

      {!loading && !results && !error && (
        <p className="text-zinc-600 text-center">
          Your results will appear here.
        </p>
      )}

      {results && (
        <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-6">
          {results.map((movie, i) => (
            <div
              key={i}
              className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex flex-col"
            >
              {movie.poster ? (
                <Image
                  src={movie.poster}
                  alt={movie.title}
                  width={500}
                  height={750}
                  className="w-full aspect-[2/3] object-cover"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-zinc-800 flex items-center justify-center text-zinc-600">
                  No poster
                </div>
              )}
              <div className="p-4 flex-1 flex flex-col gap-2">
                <h2 className="text-lg font-semibold leading-snug">
                  {movie.title}{" "}
                  <span className="text-zinc-500 font-normal">
                    ({movie.year})
                  </span>
                </h2>
                <p className="text-sm text-blue-400">{movie.reason}</p>
                {movie.overview && (
                  <p className="text-sm text-zinc-400 mt-1 line-clamp-3">
                    {movie.overview}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
