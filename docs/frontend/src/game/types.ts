// src/game/types.ts

export type LanguageCode = "ca" | "es" | "en" | string;
export type Decade =
  | "1980s"
  | "1990s"
  | "2000s"
  | "2010s"
  | "2020s"
  | string;

export interface SongMeta {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  year?: number | null;
  decade?: Decade | null;
  popularity?: number | null;
  language?: LanguageCode | null;
  genres?: string | null;           // cadena tipus "pop, reggaeton"
  mood?: string | null;
  source_playlist?: string | null;
  youtube_views_estimate?: number | null;
}

export interface EmojiEntry {
  id: string;
  emojis: string;
  hint1?: string;
  hint2?: string;
  hint3Options?: string[];
  hint3CorrectIndex?: number;
  deleted?: boolean;
  updatedAt?: string;
}

export interface Question {
  id: string;
  emojis: string;
  hint1?: string;
  hint2?: string;
  hint3Options?: string[];
  hint3CorrectIndex?: number;
  song: SongMeta;
}

export type RoundPhase = "EMOJIS" | "HINT1" | "HINT2" | "MCQ" | "REVEAL";

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  hasAnsweredCurrentRound: boolean;
}

export interface AnswerResult {
  isCorrect: boolean;
  points: number;
  normalizedGuess: string;
  normalizedTitle: string;
}

export interface GameConfig {
  totalRounds: number;
  language?: LanguageCode;
  decades?: Decade[];
  allowedGenres?: string[];     // paraules clau que han d’aparèixer a song.genres
  minPopularity?: number;
  allowMultipleChoiceFallback?: boolean;
  // pesos de puntuació per fase
  pointsEmojis?: number;
  pointsHint1?: number;
  pointsHint2?: number;
  pointsMcq?: number;
}

export interface PublicRoundState {
  roundNumber: number;
  totalRounds: number;
  phase: RoundPhase;
  emojis: string;
  hint1?: string;
  hint2?: string;
  hint3Options?: string[];
  // sense indicar la correcta, òbviament
  timeRemainingSec?: number;    // per si després hi poses temporitzador
}

export interface PublicGameState {
  status: "LOBBY" | "IN_PROGRESS" | "FINISHED";
  currentRound?: PublicRoundState;
  players: PlayerState[];
}

export interface GameConfigResolved {
  totalRounds: number;
  language?: LanguageCode;
  decades?: Decade[];
  allowedGenres: string[];           // sempre array, encara que sigui buit
  minPopularity?: number;
  allowMultipleChoiceFallback: boolean;
  pointsEmojis: number;
  pointsHint1: number;
  pointsHint2: number;
  pointsMcq: number;
}