export async function POST(request) {
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!audio) {
    return Response.json({ error: "Audio file is required" }, { status: 400 });
  }

  const uploadForm = new FormData();
  uploadForm.append("audio", audio, "recording.webm");

  const uploadRes = await fetch("https://api.gladia.io/v2/upload", {
    method: "POST",
    headers: { "x-gladia-key": process.env.GLADIA_API_KEY },
    body: uploadForm,
  });

  if (!uploadRes.ok) {
    return Response.json({ error: "Failed to upload audio" }, { status: 500 });
  }

  const { audio_url } = await uploadRes.json();

  const transcriptionRes = await fetch(
    "https://api.gladia.io/v2/transcription",
    {
      method: "POST",
      headers: {
        "x-gladia-key": process.env.GLADIA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio_url }),
    }
  );

  if (!transcriptionRes.ok) {
    return Response.json(
      { error: "Failed to start transcription" },
      { status: 500 }
    );
  }

  const { result_url } = await transcriptionRes.json();

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));

    const pollRes = await fetch(result_url, {
      headers: { "x-gladia-key": process.env.GLADIA_API_KEY },
    });

    const pollData = await pollRes.json();

    if (pollData.status === "done") {
      const text = pollData.result?.transcription?.full_transcript || "";
      return Response.json({ text });
    }

    if (pollData.status === "error") {
      return Response.json(
        { error: "Transcription failed" },
        { status: 500 }
      );
    }
  }

  return Response.json({ error: "Transcription timed out" }, { status: 504 });
}
