// 1) Constants bàsiques
const tokenInput = document.getElementById("tokenInput");
const DECADES = {
  "2000s": { from: 2000, to: 2009 },
  "2010s": { from: 2010, to: 2019 },
  "2020s": { from: 2020, to: 2029 }
};

// POSA EL TEU CLIENT ID AQUÍ (NO el secret!)
const clientId = "EL_TEU_CLIENT_ID_DE_SPOTIFY"; // ex: "ebaa4a10...."
const scopes = ["user-read-email"];

// 2) Capturar el token de l'URL després del login (implicit grant)
(function initTokenFromHash() {
  const hash = window.location.hash.substring(1);
  if (!hash) return;

  const params = new URLSearchParams(hash);
  const tokenFromSpotify = params.get("access_token");

  if (tokenFromSpotify && tokenInput) {
    tokenInput.value = tokenFromSpotify;

    // Netegem l'URL
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    // Carreguem gèneres oficials
    loadGenres(tokenFromSpotify).catch(console.error);
  }
})();

// 3) Botó de login amb Spotify
document.getElementById("loginBtn").addEventListener("click", () => {
  const redirectUri = window.location.origin + window.location.pathname;

  const authUrl =
    "https://accounts.spotify.com/authorize" +
    "?response_type=token" +
    "&client_id=" + encodeURIComponent(clientId) +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    "&scope=" + encodeURIComponent(scopes.join(" "));

  window.location.href = authUrl;
});

// 4) Carregar gèneres disponibles de Spotify
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

// 5) Helpers Spotify

// Recomanacions per gènere + energia + tempo
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

// Buscar tracks per dècada (anys) + gènere
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

// Buscar tracks per prompt en llenguatge natural
async function getTracksFromPrompt(token, nlConfig, fallbackGenre, limit = 30) {
  const url = new URL("https://api.spotify.com/v1/search");
  const qParts = [];

  if (nlConfig.artistName) {
    qParts.push(`artist:"${nlConfig.artistName}"`);
  }

  // anys
  let from = nlConfig.yearFrom;
  let to = nlConfig.yearTo;

  if ((!from || !to) && nlConfig.decadeKey && DECADES[nlConfig.decadeKey]) {
    from = DECADES[nlConfig.decadeKey].from;
    to = DECADES[nlConfig.decadeKey].to;
  }

  if (from && to) {
    qParts.push(`year:${from}-${to}`);
  }

  if (fallbackGenre) {
    qParts.push(`genre:"${fallbackGenre}"`);
  }

  if (!qParts.length) {
    // Si no hem sabut interpretar res, tornem buit i que decideixi el caller
    return [];
  }

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

// 6) Parser molt simple de llenguatge natural
function parsePromptNaive(prompt) {
  const cfg = {
    artistName: null,
    yearFrom: null,
    yearTo: null,
    decadeKey: null
  };

  const p = prompt.toLowerCase();

  // Exemple concret
  if (p.includes("canto del loco") || p.includes("el canto del loco")) {
    cfg.artistName = "El Canto del Loco";
  }

  // Dècades textuals
  if (p.includes("2000s") || p.includes("00s")) {
    cfg.decadeKey = "2000s";
  }
  if (p.includes("2010s") || p.includes("10s")) {
    cfg.decadeKey = "2010s";
  }
  if (p.includes("2020s") || p.includes("20s")) {
    cfg.decadeKey = "2020s";
  }

  // Rang d'anys 19xx–20xx dins el text
  const matchRange = p.match(/(19|20)\d{2}.*(19|20)\d{2}/);
  if (matchRange) {
    const nums = matchRange[0].match(/(19|20)\d{2}/g);
    if (nums && nums.length >= 2) {
      cfg.yearFrom = parseInt(nums[0], 10);
      cfg.yearTo = parseInt(nums[1], 10);
    }
  }

  // Frase tipus "fins el 2020"
  const matchSingleYear = p.match(/fins (al|el) (19|20)\d{2}/);
  if (matchSingleYear) {
    const year = parseInt(matchSingleYear[0].match(/(19|20)\d{2}/)[0], 10);
    cfg.yearTo = year;
  }

  return cfg;
}

// 7) Utilitat per fer una mostra aleatòria d'un array
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

// 8) Botó "Generar Playlist"
document.getElementById("generateBtn").addEventListener("click", async () => {
  const token = (tokenInput.value || "").trim();
  if (!token) {
    alert("Cal un token de Spotify (fes login o posa'l manualment).");
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
    // 1) Si hi ha prompt en llenguatge natural, intentem interpretar-lo
    if (nlPrompt) {
      const nlConfig = parsePromptNaive(nlPrompt);
      songs = await getTracksFromPrompt(token, nlConfig, finalGenre, 40);
    }

    // 2) Si no hi ha prompt útil, provem amb dècada
    if (!songs.length && decadeKey) {
      songs = await getTracksByDecade(token, { decadeKey, genre: finalGenre, limit: 40 });
    }

    // 3) Si tampoc, usem recomanacions clàssiques (gènere + energia + BPM)
    if (!songs.length) {
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
    alert("Hi ha hagut un error fent la crida a Spotify. Mira la consola.");
    return;
  }

  // Mostrem resultats
  const container = document.getElementById("results");
  container.innerHTML = "<h2>Resultats</h2>";

  if (!songs.length) {
    container.innerHTML += "<p>No s’han trobat cançons amb aquests paràmetres.</p>";
    return;
  }

  const finalList = randomSample(songs, 20);

  finalList.forEach((song) => {
    const img = song.album.images?.[0]?.url || "";
    const artists = song.artists.map((a) => a.name).join(", ");
    const url = song.external_urls?.spotify || "#";

    const div = document.createElement("div");
    div.className = "song";
    div.innerHTML = `
      ${img ? `<img src="${img}" alt="cover" />` : ""}
      <div>
        <strong>${song.name}</strong><br/>
        ${artists}<br/>
        <a href="${url}" target="_blank">Obrir a Spotify</a>
      </div>
    `;
    container.appendChild(div);
  });
});
