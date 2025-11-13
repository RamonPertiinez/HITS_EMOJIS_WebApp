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

// Quan fem clic al botó
document.getElementById("generateBtn").addEventListener("click", async () => {
    const token = document.getElementById("tokenInput").value.trim();

    if (!token) {
        alert("Introdueix un token de Spotify!");
        return;
    }

    const config = {
        genres: document.getElementById("genre").value,
        minEnergy: parseFloat(document.getElementById("minEnergy").value),
        maxEnergy: parseFloat(document.getElementById("maxEnergy").value),
        minTempo: parseFloat(document.getElementById("minTempo").value),
        maxTempo: parseFloat(document.getElementById("maxTempo").value),
    };

    const songs = await getSpotifyRandomList(token, config);

    const container = document.getElementById("results");
    container.innerHTML = "<h2>Resultats</h2>";

    if (songs.length === 0) {
        container.innerHTML += "<p>No s’han trobat cançons amb aquests paràmetres.</p>";
        return;
    }

    songs.forEach(song => {
        container.innerHTML += `
            <div class="song">
                <img src="${song.album.images[0]?.url}" />
                <div>
                    <strong>${song.name}</strong><br/>
                    ${song.artists.map(a => a.name).join(", ")}<br/>
                    <a href="${song.external_urls.spotify}" target="_blank">Obrir a Spotify</a>
                </div>
            </div>
        `;
    });
});
