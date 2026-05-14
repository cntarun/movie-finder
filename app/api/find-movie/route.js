import OpenAI from "openai";

const openai = new OpenAI();

export async function POST(request) {
  const { description } = await request.json();

  if (!description || typeof description !== "string") {
    return Response.json({ error: "Description is required" }, { status: 400 });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a movie identification expert. The user will describe a movie they vaguely remember — a scene, a vibe, a country, a plot fragment — and you must guess which movie they mean.

Rules:
- Take vague descriptions seriously
- Prioritize well-known films but allow deep cuts
- Weight heavily toward any country or era mentioned
- Never ask for clarification
- Always return exactly 3 guesses
- Return ONLY valid JSON in this shape: { "guesses": [{ "title": "...", "year": 2000, "reason": "..." }] }
- Each "reason" should be one concise sentence explaining why this movie matches the description`,
      },
      {
        role: "user",
        content: description,
      },
    ],
  });

  const guesses = JSON.parse(completion.choices[0].message.content).guesses;

  const enriched = await Promise.all(
    guesses.map(async (guess) => {
      try {
        const query = encodeURIComponent(guess.title);
        const base = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${query}`;
        let res = await fetch(`${base}&year=${guess.year}`);
        let data = await res.json();
        let movie = data.results?.[0];
        if (!movie) {
          res = await fetch(base);
          data = await res.json();
          movie = data.results?.[0];
        }

        return {
          title: guess.title,
          year: guess.year,
          reason: guess.reason,
          poster: movie?.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : null,
          overview: movie?.overview || null,
        };
      } catch {
        return {
          title: guess.title,
          year: guess.year,
          reason: guess.reason,
          poster: null,
          overview: null,
        };
      }
    })
  );

  return Response.json({ results: enriched });
}
