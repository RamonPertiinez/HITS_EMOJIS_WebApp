// 🔐 1) LLEGIR EL TOKEN DESPRÉS DEL LOGIN (implicit grant)
const hash = window.location.hash.substring(1);
const params = new URLSearchParams(hash);
const tokenFromSpotify = params.get("access_token");

const tokenInput = document.getElementById("tokenInput");

if (tokenFromSpotify && tokenInput) {
  // Posem el token al camp de text
  tokenInput.value = tokenFromSpotify;

  // Netegem l'URL perquè no quedi el token a la barra
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
}

// 🔑 2) BOTÓ LOGIN → ENS PORTA A SPOTIFY
const clientId = "ebaa4a1061024cd7a18aa6dca3ab3e6b"; // El teu Client ID
const scopes = ["user-read-email"]; // podries posar-ne més si cal

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

// 🎵 3) FUNCIÓ PER OBTENIR RECOMANACIONS DE SPOTIFY
async function getSpotifyRandomList(token, config) {
  const url = new URL("https://api.spotify.com/v1/recommendations");

  url.searchParams.append("seed_genres", config.genres);
  url.searchParams.append("limit", 20);

  url.searchParams.append("min_energy", config.minEnergy);
  url.searchParams.append("max_energy", config.maxEnergy);

  url.searchParams.append("min_tempo", config.minTempo);
  url.searchParams.append("max_tempo", config.maxTempo);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  return data.tracks || [];
}

// ▶️ 4) BOTÓ "GENERAR PLAYLIST"
document.getElementById("generateBtn").addEventListener("click", async () => {
  const token = tokenInput.value.trim();

  if (!token) {
    alert("Cal un token de Spotify (fes login o posa'l manualment).");
    return;
  }

  const config = {
    genres: document.getElementById("genre").value || "pop",
    minEnergy: parseFloat(document.getElementById("minEnergy").value),
    maxEnergy: parseFloat(document.getElementById("maxEnergy").value),
    minTempo: parseFloat(document.getElementById("minTempo").value),
    maxTempo: parseFloat(document.getElementById("maxTempo").value)
  };

  const songs = await getSpotifyRandomList(token, config);

  const container = document.getElementById("results");
  container.innerHTML = "<h2>Resultats</h2>";

  if (!songs.length) {
    container.innerHTML += "<p>No s’han trobat cançons amb aquests paràmetres.</p>";
    return;
  }

  songs.forEach(song => {
    const img = song.album.images?.[0]?.url || "";
    const artists = song.artists.map(a => a.name).join(", ");
    const url = song.external_urls?.spotify || "#";

    container.innerHTML += `
      <div class="song">
        ${img ? `<img src="${img}" alt="cover" />` : ""}
        <div>
          <strong>${song.name}</strong><br/>
          ${artists}<br/>
          <a href="${url}" target="_blank">Obrir a Spotify</a>
        </div>
      </div>
    `;
  });
});
