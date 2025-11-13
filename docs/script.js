/****************************************************
 * HITS with EMOJIS – Spotify Lab
 * script.js – Versió 100% adaptada al teu index.html
 * Flux Spotify Authorization Code + PKCE
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
  if (Date.now() > exp) return null;
  return token;
}

/****************************************************
 * 5) CARREGAR GÈNERES OFICIALS
 ****************************************************/
async function loadSpotifyGenres(token) {
  const res = await fetch("https://api.spotify.com/v1/recommendations/available-genre-seeds", {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();
  const select = $("genreSelect");

  data.genres.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    select.appendChild(opt);
  });
}

/****************************************************
 * 6) GENERAR PLAYLIST
 ****************************************************/
async function generatePlaylist() {
  const token = getValidToken();
  if (!token) {
    alert("Fes login amb Spotify abans de generar la playlist!");
    return;
  }

  // Paràmetres del formulari
  const genreFree = $("genre")?.value.trim().toLowerCase() || "";
  const genreAPI = $("genreSelect")?.value || "";
  const decade = $("decade")?.value || "";
  const minEnergy = parseFloat($("minEnergy")?.value || "0.4");
  const maxEnergy = parseFloat($("maxEnergy")?.value || "0.8");
  const minTempo = parseInt($("minTempo")?.value || "90");
  const maxTempo = parseInt($("maxTempo")?.value || "130");

  const nlPrompt = $("nlPrompt")?.value.trim() || "";
  if (nlPrompt.length > 6) {
    // futura integració IA
    console.log("🤖 Prompt IA rebut:", nlPrompt);
  }

  // Decidir gènere final
  const seedGenre = genreAPI || genreFree || "pop";

  // Dècada → filtre any
  let yearQuery = "";
  if (decade.includes("2000")) yearQuery = " year:2000-2009";
  if (decade.includes("2010")) yearQuery = " year:2010-2019";
  if (decade.includes("2020")) yearQuery = " year:2020-2029";

  // Recomanacions
  const params = new URLSearchParams();
  params.append("seed_genres", seedGenre);
  params.append("limit", "20");
  params.append("min_energy", minEnergy);
  params.append("max_energy", maxEnergy);
  params.append("min_tempo", minTempo);
  params.append("max_tempo", maxTempo);

  const url =
    "https://api.spotify.com/v1/recommendations?" + params.toString();

  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + token }
  });

  if (!res.ok) {
    console.error("Error generating playlist:", await res.text());
    alert("Error generant playlist amb Spotify!");
    return;
  }

  const data = await res.json();
  renderResults(data.tracks);
}

/****************************************************
 * 7) MOSTRAR RESULTATS
 ****************************************************/
function renderResults(tracks) {
  const container = $("results");
  if (!container) return;

  if (!tracks.length) {
    container.innerHTML = "<p>No s'han trobat cançons 😢</p>";
    return;
  }

  container.innerHTML = tracks
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
}

/****************************************************
 * 8) INIT
 ****************************************************/
document.addEventListener("DOMContentLoaded", async () => {
  // Botó LOGIN
  $("loginBtn").addEventListener("click", redirectToSpotify);

  // Botó GENERAR PLAYLIST
  $("generateBtn").addEventListener("click", generatePlaylist);

  // Detectar ?code= a la URL
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (code) {
    const token = await exchangeCodeForToken(code);
    if (token) {
      $("tokenInput").value = token;
      await loadSpotifyGenres(token);
    }

    // Netejar el ?code de la URL
    window.history.replaceState({}, document.title, SPOTIFY_REDIRECT_URI);
  } else {
    // Si ja tens token guardat → carregar gèneres
    const token = getValidToken();
    if (token) {
      $("tokenInput").value = token;
      await loadSpotifyGenres(token);
    }
  }
});
