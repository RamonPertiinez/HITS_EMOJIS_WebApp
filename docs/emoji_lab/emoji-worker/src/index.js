export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Only POST allowed", { status: 405 });
    }

    const body = await request.json();
    const { title, artist, language, mood } = body;

    if (!title) {
      return new Response(
        JSON.stringify({ error: "Missing title" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const systemMsg = `
Ets un generador d'emojis per al joc "HITS with EMOJIS".
RESPSOTA NOMÉS en emojis, entre 1 i 5.
Els emojis han d'estar RELACIONATS amb el TÍTOL de la cançó.
Cap text, cap explicació. Només emojis. 
Si el títol és massa abstracte, combina un emoji representatiu amb un emoji musical 🎵.
    `;

    const userMsg = `
Títol: ${title}
Artista: ${artist || "—"}
Idioma: ${language || "—"}
Mood: ${mood || "—"}
    `;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
        max_tokens: 20,
        temperature: 0.8,
      }),
    });

    if (!openaiRes.ok) {
      return new Response(
        JSON.stringify({ error: "OpenAI Error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await openaiRes.json();

    const raw = data.choices?.[0]?.message?.content?.trim() || "🎵";
    const emojis = raw.replace(/[a-zA-Z0-9]/g, "").trim() || "🎵";

    return new Response(JSON.stringify({ emojis }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
