// =========================
// 1) CONFIG BÀSICA
// =========================

// IMPORTANT: ha de coincidir EXACTAMENT amb el Redirect URI del dashboard de Spotify
const REDIRECT_URI = "https://ramonpertiinez.github.io/HITS_EMOJIS_WebApp/";

// El teu Client ID (NO el secret)
const clientId = "ebaa4a1061024cd7a18aa6dca3ab3e6b";

// Scopes mínims
const scopes = ["user-read-email"];

// Endpoint on tu muntaràs la IA (Cloudflare Worker, n8n, backend propi...)
// Ha de retornar un JSON del tipus:
// { artists: [...], genres: [...], year_from: 2000, year_to: 2020, energy: "high", danceability: "medium" }
const AI_ENDPOINT = "https://TU_BACKEND_DE_IA/interpret"; // ← CANVIA AIXÒ QUAN EL TINGUIS

const tokenInput = document.getElementById("tokenInput");
const aiStatus = document.getElementById("aiStatus");

const DECADES = {
  "2000s": { from: 2000, to: 2009 },
  "2010s": { from: 2010, to: 2019 },
  "2020s": { from: 2020, to: 2029 }
};

// =========================
// 2) TOKEN DESPRÉS DEL LOGIN
// =========================
(function initTokenFromHash() {
  const hash = window.location.hash.substring(1);
  if (!hash) return;

  const params = new URLSearchParams(hash);
  const tokenFromSpotify = params.get("access_token");

  if (tokenFromSpotify && tokenInput) {
    tokenInput.value = tokenFromSpotify;

    // Netegem l'URL
    window.history.replaceState({}, document.title, REDIRECT_URI);

    // Carreguem la llista de gèneres de Spotify
    loadGenres(tokenFromSpotify).catch(console.error);
  }
})();

// =========================
// 3) LOGIN AMB SPOTIFY
// =========================
document.getElementById("loginBtn").addEventListener("click", () => {
  const authUrl =
    "https://accounts.spotify.com/authorize" +
    "?response_type=token" +
    "&client_id=" + encodeURIComponent(clientId) +
    "&redirect_uri=" + encodeURIComponent(REDIRECT_URI) +
    "&scope=" + encodeURIComponent(scopes.join(" "));

  window.location.href = authUrl;
});

// =========================
// 4) CARREGAR GÈNERES DE SPOTIFY
// =========================
async function loadGenres(token) {
  const res = await fetch(
    "https://api.spotify.com/v1/recommendations/available-genre-seeds",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    console.warn("No s'han pogut carregar els gèneres", await res.text());
    return;
  }

  const data = await res.json();
  const select = document.getElementById("genreSelect");
  if (!select) return;

  data.genres.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    select.appendChild(opt);
  });
}

// =========================
// 5) HELPERS PER A SPOTIFY
// =========================

// Recomanacions clàssiques (gènere + energia + tempo)
async function getSpotifyRandomList(token, config) {
  const url = new URL("https://api.spotify.com/v1/recommendations");

  url.searchParams.append("seed_genres", config.genres);
  url.searchParams.append("limit", config.limit ?? 20);

  if (config.minEnergy != null) url.searchParams.append("min_energy", config.minEnergy);
  if (config.maxEnergy != null) url.searchParams.append("max_energy", config.maxEnergy);
  if (config.minTempo != null) url.searchParams.append("min_tempo", config.minTempo);
  if (config.maxTempo != null) url.searchParams.append("max_tempo", config.maxTempo);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    console.error("Error recommendations:", await res.text());
    return [];
  }

  const data = await res.json();
  return data.tracks || [];
}

// Buscar per dècada + gènere via /search
async function getTracksByDecade(token, { decadeKey, genre, limit = 30 }) {
  const decade = DECADES[decadeKey];
  if (!decade) return [];

  const url = new URL("https://api.spotify.com/v1/search");
  const qParts = [];

  if (genre) qParts.push(`genre:"${genre}"`);
  qParts.push(`year:${decade.from}-${decade.to}`);

  url.searchParams.set("q", qParts.join(" "));
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", limit);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    console.error("Error search by decade:", await res.text());
    return [];
  }

  const data = await res.json();
  return data.tracks?.items || [];
}

// =========================
// 6) IA – INTERPRETAR EL PROMPT
// =========================

// Intent amb IA externa (backend teu)
async function interpretPromptWithAI(prompt) {
  aiStatus.textContent = "🤖 Analitzant el que has escrit amb IA...";
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const data = await res.json();
    aiStatus.textContent = "✅ IA interpretada, generant playlist...";
    return data; // {artists, genres, year_from, year_to, energy, danceability...}
  } catch (err) {
    console.warn("Error IA, fem servir parser simple:", err.message);
    aiStatus.textContent = "⚠️ No s'ha pogut usar la IA externa, faig una interpretació bàsica.";
    return null;
  }
}

// Parser cutre local per si la IA falla
function parsePromptNaive(prompt) {
  const cfg = {
    artists: [],
    genres: [],
    year_from: null,
    year_to: null,
    decadeKey: null
  };

  const p = prompt.toLowerCase();

  if (p.includes("canto del loco") || p.includes("el canto del loco")) {
    cfg.artists.push("El Canto del Loco");
  }

  if (p.includes("2000s") || p.includes("00s")) cfg.decadeKey = "2000s";
  if (p.includes("2010s") || p.includes("10s")) cfg.decadeKey = "2010s";
  if (p.includes("2020s") || p.includes("20s")) cfg.decadeKey = "2020s";

  const rangeMatch = p.match(/(19|20)\d{2}.*(19|20)\d{2}/);
  if (rangeMatch) {
    const nums = rangeMatch[0].match(/(19|20)\d{2}/g);
    if (nums && nums.length >= 2) {
      cfg.year_from = parseInt(nums[0], 10);
      cfg.year_to = parseInt(nums[1], 10);
    }
  }

  return cfg;
}

// Buscar cançons a partir de la interpretació (IA o naive)
async function getTracksFromPromptConfig(token, config, fallbackGenre, limit = 40) {
  const url = new URL("https://api.spotify.com/v1/search");
  const qParts = [];

  if (config.artists && config.artists.length > 0) {
    // només agafem el primer per simplicitat
    qParts.push(`artist:"${config.artists[0]}"`);
  }

  let from = config.year_from;
  let to = config.year_to;

  if ((!from || !to) && config.decadeKey && DECADES[config.decadeKey]) {
    from = DECADES[config.decadeKey].from;
    to = DECADES[config.decadeKey].to;
  }

  if (from && to) {
    qParts.push(`year:${from}-${to}`);
  }

  const genreFromIA =
    config.genres && config.genres.length ? config.genres[0] : fallbackGenre;
  if (genreFromIA) {
    qParts.push(`genre:"${genreFromIA}"`);
  }

  if (!qParts.length) return [];

  url.searchParams.set("q", qParts.join(" "));
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", limit);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    console.error("Error search from prompt:", await res.text());
    return [];
  }

  const data = await res.json();
  return data.tracks?.items || [];
}

// =========================
// 7) UTILITAT – MOSTRA ALEATÒRIA
// =========================
function randomSample(arr, n) {
  if (arr.length <= n) return arr;
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

// =========================
// 8) BOTÓ "GENERAR PLAYLIST"
// =========================
document.getElementById("generateBtn").addEventListener("click", async () => {
  const token = (tokenInput.value || "").trim();
  if (!token) {
    alert("Cal un token de Spotify (fes login o enganxa'n un).");
    return;
  }

  const genreFromSelect = document.getElementById("genreSelect").value;
  const genreFallback = document.getElementById("genre").value;
  const finalGenre = genreFromSelect || genreFallback || "pop";

  const decadeKey = document.getElementById("decade").value || null;
  const minEnergy = parseFloat(document.getElementById("minEnergy").value);
  const maxEnergy = parseFloat(document.getElementById("maxEnergy").value);
  const minTempo = parseFloat(document.getElementById("minTempo").value);
  const maxTempo = parseFloat(document.getElementById("maxTempo").value);

  const nlPrompt = document.getElementById("nlPrompt").value.trim();

  let songs = [];

  try {
    // 1) Intentem IA si hi ha prompt
    if (nlPrompt) {
      const aiConfig = await interpretPromptWithAI(nlPrompt);
      let effectiveConfig = aiConfig;

      if (!effectiveConfig) {
        // Si la IA ha fallat, fem servir parser simple
        effectiveConfig = parsePromptNaive(nlPrompt);
      }

      songs = await getTracksFromPromptConfig(token, effectiveConfig, finalGenre, 40);
    }

    // 2) Si no hi ha prompt o no ha trobat res, provem dècada
    if (!songs.length && decadeKey) {
      aiStatus.textContent = "🎛️ Fent servir filtre per dècades...";
      songs = await getTracksByDecade(token, { decadeKey, genre: finalGenre, limit: 40 });
    }

    // 3) Fallback: recomanacions clàssiques
    if (!songs.length) {
      aiStatus.textContent = "🎲 Generant recomanacions clàssiques amb gènere + BPM + energy...";
      songs = await getSpotifyRandomList(token, {
        genres: finalGenre,
        minEnergy,
        maxEnergy,
        minTempo,
        maxTempo,
        limit: 40
      });
    }
  } catch (err) {
    console.error(err);
    aiStatus.textContent = "❌ Error generant la playlist, mira la consola.";
    alert("Hi ha hagut un error fent la crida a Spotify.");
    return;
  }

  // =========================
  // 9) PINTAR RESULTATS
  // =========================
  const container = document.getElementById("results");
  container.innerHTML = "<h2>📻 Resultats de la playlist</h2>";

  if (!songs.length) {
    container.innerHTML +=
      "<p>No s’han trobat cançons amb aquests paràmetres. Prova amb un gènere més general o una dècada diferent. 😅</p>";
    return;
  }

  const finalList = randomSample(songs, 20);

  finalList.forEach((song, idx) => {
    const img = song.album.images?.[0]?.url || "";
    const artists = song.artists.map((a) => a.name).join(", ");
    const url = song.external_urls?.spotify || "#";

    const div = document.createElement("div");
    div.className = "song";
    div.innerHTML = `
      ${img ? `<img src="${img}" alt="cover" />` : ""}
      <div>
        <div class="song-title">#${idx + 1} – ${song.name}</div>
        <div class="song-artist">👨‍🎤 ${artists}</div>
        <div class="song-meta">💽 ${song.album.name}</div>
        <a href="${url}" target="_blank">▶️ Obrir a Spotify</a>
      </div>
    `;
    container.appendChild(div);
  });

  aiStatus.textContent = "✅ Playlist generada! Ja pots fer de DJ. 🎧";
});
