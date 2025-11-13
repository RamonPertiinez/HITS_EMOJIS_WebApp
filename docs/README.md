🎧 HITS AMB EMOJIS
El joc de música + emojis per jugar amb amics

Benvingut al repositori oficial del projecte HITS AMB EMOJIS, un party game web on els jugadors han d’endevinar cançons a partir d’una combinació d’emojis.
El joc funciona amb una estructura de room system tipus Kahoot: un host crea una sala, comparteix un link / QR, i els seus amics s’hi connecten amb el mòbil per participar.

Aquest document recull:

la visió general del projecte,

el resum del FRD (Functional Requirements Document),

el resum del SRS (Software Requirements Specification),

i els objectius del MVP del 27 de desembre.

🎯 Visió del projecte

L’objectiu és crear un joc:

ràpid d’iniciar,

accessible des de qualsevol dispositiu,

social i divertit,

i basat en una playlist aleatòria de cançons representades amb emojis.

El host defineix criteris (idiomes, gèneres, dècades), la IA genera una playlist i els jugadors competeixen per encertar la cançó el més ràpid possible.

📚 FRD — Functional Requirements Document (Resum)

El FRD defineix què ha de fer el sistema a nivell funcional.
A continuació hi ha el resum estructurat.

👥 Rols del sistema
🧑‍✈️ Host (Amfitrió)

Crea una sala amb criteris musicals (idioma, gènere, dècada, nº de cançons).

Opcionalment escriu un prompt lliure que la IA interpreta.

Rep un Room ID, URL i codi QR per compartir.

Veu els jugadors que entren.

Inicia el joc, controla les rondes i mostra el rànquing final.

🎮 Jugador

Entra via link o QR.

Posa nom i avatar.

Viu la partida responent les rondes d’emojis.

Competeix i veu el rànquing al final.

🤖 Motor IA / Playlist Engine

Interpreta criteris i/o prompts lliures.

Busca cançons dins una BD validada.

Proposa una playlist amb emojis associats.

🛠️ Eina interna de validació d’emojis

Serveix per validar manualment emojis assignats a cançons proposades per la IA.

Les cançons aprovades passen a la BD oficial del joc.

🧭 Flux complet d’una partida

Creació de sala

Host defineix criteris i crea sala → Room ID + QR.

Players join

Jugadors entren i s’identifiquen (nom + avatar).

Es mostren en temps real a la sala d’espera.

Generació de playlist

IA filtra segons criteris (o prompt) i crea la llista.

Rondes del joc

Es mostra una combinació d’emojis per cançó.

Jugadors responen.

El sistema valida encerts i puntua.

Rànquing final

Llista ordenada de jugadors amb puntuació total.

Host pot repetir o crear una nova sala.

🧩 Punts clau del FRD
✓ Sala personalitzable

Idiomes, gèneres, dècades, nombre de cançons i prompt lliure.

✓ Sincronització en temps real

Tot via WebSockets: entrades de jugadors, canvi de rondes, enviament de respostes.

✓ Puntuació simple

Correcte → +100

Bonus per velocitat → fins +50

Incorrecte → 0

✓ Rànquing final estil “party game”

Simple, visual i divertit.

⚙️ SRS — Software Requirements Specification (Resum)

El SRS defineix com ha de funcionar cada element a nivell tècnic: arquitectura, models de dades, validació, puntuació, API i requisits no funcionals.

A continuació tens el resum.

🔧 Arquitectura general
Frontend

React + Vite

Web responsive i optimitzada per mòbil

Components principals:

CreateRoom

PlayerJoin

WaitingRoom

GameRound

Ranking

HostDashboard

Backend

Node.js / Firebase Functions / Supabase (a decidir)

WebSockets per temps real

Persistència mínima per sala (playlist, jugadors, estat)

IA

API per interpretar prompts lliures i traduir-los a criteris

Generació de playlists candidates

Eina interna de validació d’emojis

🗃️ Models de dades
🟦 Song
song_id  
title  
artist  
year  
language  
genre  
popularity  
emojis[]  
validated (bool)

🟩 Room
room_id  
host_id  
criteria { languages[], genres[], decades[], prompt }  
playlist[]  
players[]  
status (waiting | playing | finished)  
created_at

🟨 Player
player_id  
name  
avatar  
score  
room_id  
connected

🤝 Validació de respostes (MVP)

Normalització:
minúscules, treure accents, treure articles (“el”, “la”, “the”)

Comparació flexible (Levenshtein / substring)

Retorna:

correct

incorrect

🚀 Requisits no funcionals (NFR)

⚡ Rendiment:

Càrrega de sala < 1.5s

Ronda < 200ms en WebSocket

📱 Compatibilitat:

iOS Safari

Chrome Android

Chrome/Edge/Safari desktop

🔌 Estabilitat:

Reconnexió automàtica de WebSocket

🔒 Privacitat:

Es guarda només nom, avatar i puntuació de la partida

🎯 MVP del 27 de desembre
Inclou:

Creació de sala completa

QR + URL

Sala d’espera

Rondes amb emojis

Validació simple de respostes

Puntuació i rànquing

No cal encara:

Àudio de cançons

Modes de joc avançats

Estadístiques

IA 100% autònoma

Perfils d’usuari registrats

🗂️ Estructura recomanada del repositori
/
├─ frontend/
│  ├─ src/
│  ├─ components/
│  └─ styles/
│
├─ backend/
│  ├─ functions/
│  └─ websocket/
│
├─ docs/
│  ├─ readme.html
│  ├─ FRD.pdf (opcional)
│  └─ SRS.pdf (opcional)
│
└─ README.md

🧪 Estat actual del projecte

🔹 FRD complet
🔹 SRS complet
🔹 EPICS + User Stories (Trello-ready)
🔹 Estructura conceptual tancada
🔹 MVP definit i acotat

💬 Autor

Ramon Pertíñez Solà
Projecte personal per crear un joc musical diferent, ràpid i molt social.
Aquest repositori serveix com a base tècnica i creativa per a futures versions.