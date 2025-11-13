/****************************************************
 * HITS with EMOJIS – Spotify Lab
 * script.js – Versió amb PKCE + IA simple + guardar playlist
 ****************************************************/

// 🔐 CONFIGURACIÓ SPOTIFY
const SPOTIFY_CLIENT_ID = "ebaa4a1061024cd7a18aa6dca3ab3e6b";
const SPOTIFY_REDIRECT_URI =
  "https://ramonpertinez.github.io/HITS_EMOJIS_WebApp/";
const SPOTIFY_SCOPES = [
  "user-read-email",
  "playlist-modify-private",
  "playlist-modify-public"
].join(" ");

// Helpers ràpids
const $ = (id) => document.getElementById(id);

// Última llista generada (per guardar-la com a playlist)
let lastTracks = [];
let lastPlaylistName = "";

/****************************************************
 * 1) PKCE: VERIFIER + CHALLENGE
 ****************************************************/
function generateCodeVerifier(length) {
  let text = "";
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/****************************************************
 * 2) LOGIN: REDIRIGIR A SPOTIFY
 ****************************************************/
async function redirectToSpotify() {
  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("spotify_verifier", verifier);

  const params = new URLSearchParams();
  params.append("client_id", SPOTIFY_CLIENT_ID);
  params.append("response_type", "code");
  params.append("redirect_uri", SPOTIFY_REDIRECT_URI);
  params.append("scope", SPOTIFY_SCOPES);
  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  const url =
    "https://accounts.spotify.com/authorize?" + params.toString();

  window.location.href = url;
}

/****************************************************
 * 3) CALLBACK: INTERCANVIAR CODE PER TOKEN
 ****************************************************/
async function exchangeCodeForToken(code) {
  const verifier = localStorage.getItem("spotify_verifier");
  if (!verifier) {
    alert("Error intern: falta verifier al localStorage.");
    return null;
  }

  const params = new URLSearchParams();
  params.append("client_id", SPOTIFY_CLIENT_ID);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", SPOTIFY_REDIRECT_URI);
  params.append("code_verifier", verifier);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  if (!res.ok) {
    console.error("Token error:", await res.text());
    alert("Error obtenint token de Spotify.");
    return null;
  }

  const data = await res.json();
  console.log("🎫 TOKEN DATA", data);

  const expiresAt = Date.now() + data.expires_in * 1000;
  localStorage.setItem("spotify_access_token", data.access_token);
  localStorage.setItem("spotify_expires_at", expiresAt);

  if (data.refresh_token)
    localStorage.setItem("spotify_refresh_token", data.refresh_token);

  return data.access_token;
}

/****************************************************
 * 4) TOKEN STORAGE + VALIDACIÓ
 ****************************************************/
function getValidToken() {
  const token = localStorage.getItem("spotify_access_token");
  const exp = Number(localStorage.getItem("spotify_expires_at"));
  if (!token) return null;
  if (!exp || Date.now() > exp) return null;
  return token;
}

/****************************************************
 * 5) CARREGAR GÈNERES OFICIALS (pot fallar, endpoint deprecated)
 ****************************************************/
async function loadSpotifyGenres(token) {
  try {
    const res = await fetch(
      "https://api.spotify.com/v1/recommendations/available-genre-seeds",
      { headers: { Authorization: "Bearer " + token } }
    );
    if (!res.ok) {
      console.warn(
        "No s'han pogut carregar gèneres (Spotify pot haver desactivat aquest endpoint):",
        await res.text()
      );
      return;
    }
    const data = await res.json();
    const select = $("genreSelect");
    data.genres.forEach((g) => {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error("Error carregant gèneres:", e);
  }
}

/****************************************************
 * 6) “IA” SIMPLE PER INTERPRETAR EL PROMPT
 ****************************************************/
function applyPromptToControls(promptText) {
  const p = promptText.toLowerCase();
  const aiStatus = $("aiStatus");

  // Detectar artístes típics
  if (p.includes("canto del loco")) {
    $("genre").value = "pop rock espanyol";
    $("decade").value = "2000s";

    const genreSelect = $("genreSelect");
    if (genreSelect) {
      if ([...genreSelect.options].some((o) => o.value === "spanish")) {
        genreSelect.value = "spanish";
      } else if ([...genreSelect.options].some((o) => o.value === "rock")) {
        genreSelect.value = "rock";
      } else {
        genreSelect.value = "pop";
      }
    }
  }

  if (p.includes("reggaeton") || p.includes("perrear")) {
    $("genre").value = "reggaeton";
    $("decade").value = "2010s";
    const genreSelect = $("genreSelect");
    if (genreSelect) {
      if ([...genreSelect.options].some((o) => o.value === "reggaeton")) {
        genreSelect.value = "reggaeton";
      } else {
        genreSelect.value = "latin";
      }
    }
  }

  // Detectar paraules de vibe
  if (p.includes("tranquil") || p.includes("relax") || p.includes("chill")) {
    $("minEnergy").value = 0.2;
    $("maxEnergy").value = 0.6;
    $("minTempo").value = 70;
    $("maxTempo").value = 120;
  }
  if (
    p.includes("animad") ||
    p.includes("fiesta") ||
    p.includes("party") ||
    p.includes("motivat")
  ) {
    $("minEnergy").value = 0.6;
    $("maxEnergy").value = 1.0;
    $("minTempo").value = 110;
    $("maxTempo").value = 150;
  }

  // Detectar anys per mapejar a dècades
  const years = p.match(/(19|20)\d{2}/g);
  if (years && years.length) {
    const first = parseInt(years[0], 10);
    if (first >= 2000 && first <= 2009) $("decade").value = "2000s";
    else if (first >= 2010 && first <= 2019) $("decade").value = "2010s";
    else if (first >= 2020 && first <= 2029) $("decade").value = "2020s";
  }

  if (aiStatus) {
    aiStatus.textContent =
      "✨ El prompt s'ha traduït a paràmetres automàticament.";
  }
}

/****************************************************
 * 7) GENERAR PLAYLIST (NOU – amb /v1/search)
 ****************************************************/
function pickRandomN(array, n) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

async function generatePlaylist() {
  const token = getValidToken();
  if (!token) {
    alert("Fes login amb Spotify abans de generar la playlist!");
    return;
  }

  // 1) Aplicar IA del prompt si hi ha text
  const nlPrompt = $("nlPrompt")?.value.trim() || "";
  if (nlPrompt.length > 6) {
    applyPromptToControls(nlPrompt);
  }

  // 2) Llegir controls
  const genreFree = $("genre")?.value.trim().toLowerCase() || "";
  const genreAPI = $("genreSelect")?.value || "";
  const decade = $("decade")?.value || "";
  const minEnergy = parseFloat($("minEnergy")?.value || "0.4");
  const maxEnergy = parseFloat($("maxEnergy")?.value || "0.8");
  const minTempo = parseInt($("minTempo")?.value || "90", 10);
  const maxTempo = parseInt($("maxTempo")?.value || "130", 10);

  // 3) Construir query de SEARCH
  const qParts = [];

  const textGenre = genreAPI || genreFree;
  if (textGenre) qParts.push(textGenre);

  if (decade === "2000s") qParts.push("year:2000-2009");
  else if (decade === "2010s") qParts.push("year:2010-2019");
  else if (decade === "2020s") qParts.push("year:2020-2029");

  // Mapeig molt simple d’energia → vibe textual
  if (maxEnergy >= 0.7) {
    qParts.push("upbeat");
  } else if (maxEnergy <= 0.5) {
    qParts.push("chill");
  }

  // Mapeig simple de tempo (ràpid/lent)
  if (maxTempo >= 130) {
    qParts.push("dance");
  } else if (maxTempo <= 100) {
    qParts.push("acoustic");
  }

  if (!qParts.length) {
    qParts.push("pop");
  }

  const query = qParts.join(" ");

  console.log("🔍 SEARCH query:", query);

  // Nom “bonic” per la playlist
  let decadeLabel = "";
  if (decade === "2000s") decadeLabel = "2000–2009";
  if (decade === "2010s") decadeLabel = "2010–2019";
  if (decade === "2020s") decadeLabel = "2020–2029";

  lastPlaylistName =
    "HITS with EMOJIS – " + (decadeLabel || textGenre || "Random Mix");

  const params = new URLSearchParams();
  params.append("q", query);
  params.append("type", "track");
  params.append("limit", "50"); // agafem bastantes i després fem random
  params.append("market", "from_token");

  const url = "https://api.spotify.com/v1/search?" + params.toString();
  console.log("🔗 URL Spotify search:", url);

  const btn = $("generateBtn");
  btn.disabled = true;
  btn.textContent = "Generant... 🔄";

  try {
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Error generant playlist (search):", errorText);
      alert("Error generant playlist amb Spotify!");
      return;
    }

    const data = await res.json();
    const allTracks = data.tracks?.items || [];

    if (!allTracks.length) {
      alert("No s'han trobat cançons amb aquests paràmetres 😢");
      renderResults([]);
      return;
    }

    // 4) Agafem 20 cançons aleatòries
    lastTracks = pickRandomN(allTracks, 20);
    renderResults(lastTracks);
  } catch (e) {
    console.error(e);
    alert("Error desconegut generant la playlist.");
  } finally {
    btn.disabled = false;
    btn.textContent = "🎲 Generar Playlist";
  }
}

/****************************************************
 * 8) GUARDAR PLAYLIST AL COMPTE DE SPOTIFY
 ****************************************************/
async function handleSavePlaylist() {
  const token = getValidToken();
  if (!token) {
    alert("Token caducat. Torna a fer login amb Spotify.");
    return;
  }

  if (!lastTracks || !lastTracks.length) {
    alert("Primer genera una playlist! 😉");
    return;
  }

  const defaultName = lastPlaylistName || "HITS with EMOJIS – Random Mix";
  const name =
    prompt("Nom per la playlist a Spotify:", defaultName) || defaultName;

  const description =
    "Playlist generada automàticament amb HITS with EMOJIS – Spotify Lab 🎧";

  try {
    // 1) Agafem l'usuari
    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!meRes.ok) {
      console.error("Error /me:", await meRes.text());
      alert("No s'ha pogut llegir l'usuari de Spotify.");
      return;
    }
    const me = await meRes.json();

    // 2) Creem la playlist
    const playlistRes = await fetch(
      `https://api.spotify.com/v1/users/${encodeURIComponent(
        me.id
      )}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          description,
          public: false
        })
      }
    );

    if (!playlistRes.ok) {
      console.error("Error creant playlist:", await playlistRes.text());
      alert("No s'ha pogut crear la playlist a Spotify.");
      return;
    }

    const playlist = await playlistRes.json();

    // 3) Afegim les cançons
    const uris = lastTracks.map((t) => t.uri).filter(Boolean);
    if (uris.length) {
      const addRes = await fetch(
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ uris })
        }
      );

      if (!addRes.ok) {
        console.error("Error afegint tracks:", await addRes.text());
        alert(
          "La playlist s'ha creat, però hi ha hagut un problema afegint les cançons."
        );
        return;
      }
    }

    alert("✅ Playlist creada al teu Spotify!");
    console.log("Playlist URL:", playlist.external_urls?.spotify);
  } catch (e) {
    console.error("Error guardant playlist:", e);
    alert("Error desconegut creant la playlist.");
  }
}

/****************************************************
 * 9) MOSTRAR RESULTATS
 ****************************************************/
function renderResults(tracks) {
  const container = $("results");
  if (!container) return;

  if (!tracks.length) {
    container.innerHTML = "<p>No s'han trobat cançons 😢</p>";
    return;
  }

  const htmlTracks = tracks
    .map((t, i) => {
      const name = t.name;
      const artist = t.artists.map((a) => a.name).join(", ");
      const link = t.external_urls.spotify;
      const cover = t.album.images[1]?.url || t.album.images[0]?.url || "";
      const preview = t.preview_url;

      return `
        <article class="track-card">
          <div class="track-index">#${i + 1}</div>
          ${
            cover
              ? `<img src="${cover}" class="track-cover" />`
              : `<div class="track-cover no-img">🎵</div>`
          }
          <div class="track-info">
            <a href="${link}" target="_blank" class="track-title">${name}</a>
            <div class="track-artist">${artist}</div>
            ${
              preview
                ? `<audio controls src="${preview}" class="track-preview"></audio>`
                : `<div class="track-no-preview">Sense preview 🎧</div>`
            }
          </div>
        </article>
      `;
    })
    .join("");

  const saveBtn = `
    <button id="savePlaylistBtn" class="btn secondary wide save-btn">
      💾 Guardar com a playlist a Spotify
    </button>
  `;

  container.innerHTML = saveBtn + htmlTracks;

  const saveBtnEl = $("savePlaylistBtn");
  if (saveBtnEl) {
    saveBtnEl.addEventListener("click", handleSavePlaylist);
  }
}

/****************************************************
 * 10) INIT
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  $("loginBtn").addEventListener("click", redirectToSpotify);

  $("generateBtn").addEventListener("click", (e) => {
    e.preventDefault();
    generatePlaylist();
  });

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    const token = await exchangeCodeForToken(code);
    if (token) {
      $("tokenInput").value = token;
      await loadSpotifyGenres(token);
    }
    window.history.replaceState({}, document.title, SPOTIFY_REDIRECT_URI);
  } else {
    const token = getValidToken();
    if (token) {
      $("tokenInput").value = token;
      await loadSpotifyGenres(token);
    }
  }
});
