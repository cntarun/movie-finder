import OpenAI from "openai";

const openai = new OpenAI();

const SYSTEM_PROMPT = `You are a world-class movie identification expert with encyclopedic knowledge of cinema across all countries, languages, eras, and genres — from Hollywood blockbusters to obscure regional films.

When a user describes a movie they vaguely remember, follow this process:

1. ANALYZE the description carefully. Identify every clue: plot points, character details, settings, time period, country/language, visual style, mood, specific scenes, dialogue fragments, actor descriptions, genre signals.

2. REASON through candidates. Think about:
   - Movies that match the MOST specific details (a particular scene or character trait is more telling than a generic genre)
   - Regional and international cinema — don't default to Hollywood unless the clues point there
   - The described era: if they say "80s movie", consider what was popular/notable in that decade
   - Alternate titles: many films are known by different names in different countries
   - Consider both the original language title and the English title
   - Deep cuts and lesser-known films, not just the most popular ones
   - If a description sounds like it could be a Bollywood, Korean, Japanese, French, or other non-English film, prioritize those

3. RANK your guesses. Put the most likely match first. Your #1 guess should be your strongest match.

Rules:
- Never ask for clarification — work with what you have
- Always return exactly 3 guesses
- Each "reason" should specifically reference which details from the user's description match the film
- Return ONLY valid JSON: { "guesses": [{ "title": "...", "year": 2000, "reason": "..." }] }`;

export async function POST(request) {
  const { description, history } = await request.json();

  if (!description || typeof description !== "string") {
    return Response.json({ error: "Description is required" }, { status: 400 });
  }

  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  if (history && Array.isArray(history)) {
    for (const turn of history) {
      messages.push({ role: "user", content: turn.userMessage });
      messages.push({
        role: "assistant",
        content: JSON.stringify({ guesses: turn.guesses }),
      });
    }
  }

  messages.push({ role: "user", content: description });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages,
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
