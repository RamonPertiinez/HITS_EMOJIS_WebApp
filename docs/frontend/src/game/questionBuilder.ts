// src/game/questionBuilder.ts
import type { SongMeta, EmojiEntry, Question, GameConfig } from "./types";

function stringIncludesAny(haystack: string | null | undefined, needles: string[]): boolean {
  if (!haystack || needles.length === 0) return true;
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

export function buildQuestions(
  songs: SongMeta[],
  emojis: EmojiEntry[],
  config?: GameConfig
): Question[] {
  const emojiById = new Map<string, EmojiEntry>();

  for (const e of emojis) {
    if (e.deleted) continue;
    if (!e.emojis) continue;
    emojiById.set(e.id, e);
  }

  const {
    language,
    decades,
    allowedGenres = [],
    minPopularity,
  } = config || {};

  const questions: Question[] = [];

  for (const song of songs) {
    const emojiEntry = emojiById.get(song.id);
    if (!emojiEntry) continue;

    // filtres bàsics segons config
    if (language && song.language && song.language !== language) continue;

    if (decades && decades.length > 0 && song.decade && !decades.includes(song.decade)) {
      continue;
    }

    if (typeof minPopularity === "number" &&
        typeof song.popularity === "number" &&
        song.popularity < minPopularity) {
      continue;
    }

    if (allowedGenres.length > 0 && !stringIncludesAny(song.genres, allowedGenres)) {
      continue;
    }

    questions.push({
      id: song.id,
      emojis: emojiEntry.emojis,
      hint1: emojiEntry.hint1,
      hint2: emojiEntry.hint2,
      hint3Options: emojiEntry.hint3Options,
      hint3CorrectIndex: emojiEntry.hint3CorrectIndex,
      song,
    });
  }

  // barregem perquè no surtin sempre en el mateix ordre
  return shuffleArray(questions);
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
