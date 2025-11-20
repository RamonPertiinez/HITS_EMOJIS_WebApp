// src/game/engine.ts
import {
  GameConfig,
  GameConfigResolved,   // 👈 afegeix això
  Question,
  PlayerState,
  RoundPhase,
  PublicGameState,
  PublicRoundState,
  AnswerResult,
} from "./types";

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // treu accents
    .replace(/[^a-z0-9\s]/g, "")     // treu símbols rars
    .replace(/\b(el|la|los|las|the|un|una|uns|unes|en|de|del|da|do)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export class GameEngine {
  private config: GameConfigResolved;     // 👈 abans era Required<GameConfig>
  private questions: Question[];
  private players: Map<string, PlayerState>;
  private status: "LOBBY" | "IN_PROGRESS" | "FINISHED";
  private currentRoundIndex: number;
  private phase: RoundPhase;

  private answeredPlayers: Set<string>;
  private currentQuestion: Question | null;

  constructor(questions: Question[], config?: GameConfig) {
    if (!questions.length) {
      throw new Error("GameEngine requires at least one Question");
    }

    this.config = {
      totalRounds: config?.totalRounds ?? 10,
      language: config?.language,
      decades: config?.decades,
      allowedGenres: config?.allowedGenres ?? [],
      minPopularity: config?.minPopularity,
      allowMultipleChoiceFallback: config?.allowMultipleChoiceFallback ?? true,
      pointsEmojis: config?.pointsEmojis ?? 100,
      pointsHint1: config?.pointsHint1 ?? 75,
      pointsHint2: config?.pointsHint2 ?? 50,
      pointsMcq: config?.pointsMcq ?? 25,
    };

    if (questions.length < this.config.totalRounds) {
      console.warn(
        `Only ${questions.length} questions available, but totalRounds=${this.config.totalRounds}. ` +
          `Some questions may repeat.`
      );
    }

    this.questions = questions;
    this.players = new Map();
    this.status = "LOBBY";
    this.currentRoundIndex = -1;
    this.phase = "EMOJIS";
    this.answeredPlayers = new Set();
    this.currentQuestion = null;
  }

  // ─────────────────────────────
  // GESTIÓ JUGADORS
  // ─────────────────────────────

  addPlayer(id: string, name: string): void {
    if (this.players.has(id)) return;
    this.players.set(id, {
      id,
      name,
      score: 0,
      hasAnsweredCurrentRound: false,
    });
  }

  removePlayer(id: string): void {
    this.players.delete(id);
  }

  // ─────────────────────────────
  // FLUX DEL JOC
  // ─────────────────────────────

  startGame(): void {
    if (this.status !== "LOBBY") return;
    this.status = "IN_PROGRESS";
    this.currentRoundIndex = -1;
    this.nextRound();
  }

  private pickQuestionForRound(roundIndex: number): Question {
    // permet repetir si falten preguntes; simple però efectiu
    const idx = roundIndex % this.questions.length;
    return this.questions[idx];
  }

  nextRound(): void {
    if (this.status !== "IN_PROGRESS") return;

    this.currentRoundIndex++;

    if (this.currentRoundIndex >= this.config.totalRounds) {
      this.status = "FINISHED";
      this.currentQuestion = null;
      return;
    }

    this.currentQuestion = this.pickQuestionForRound(this.currentRoundIndex);
    this.phase = "EMOJIS";
    this.answeredPlayers.clear();

    // reset del flag de ronda per a cada jugador
    this.players.forEach((p) => {
      p.hasAnsweredCurrentRound = false;
    });
  }

  advancePhase(): void {
    if (!this.currentQuestion) return;
    if (this.status !== "IN_PROGRESS") return;

    switch (this.phase) {
      case "EMOJIS":
        this.phase = "HINT1";
        break;
      case "HINT1":
        this.phase = "HINT2";
        break;
      case "HINT2":
        this.phase = this.config.allowMultipleChoiceFallback && this.currentQuestion.hint3Options
          ? "MCQ"
          : "REVEAL";
        break;
      case "MCQ":
        this.phase = "REVEAL";
        break;
      case "REVEAL":
        this.nextRound();
        break;
    }

    // en canviar de fase, podem permetre que la gent que no ha encertat
    // torni a provar (decisió de disseny; es pot fer més estricte si vols)
    if (this.phase !== "REVEAL") {
      this.answeredPlayers.clear();
      this.players.forEach((p) => {
        p.hasAnsweredCurrentRound = false;
      });
    }
  }

  // ─────────────────────────────
  // RESPOSTES I PUNTUACIÓ
  // ─────────────────────────────

  submitFreeTextAnswer(playerId: string, guess: string): AnswerResult | null {
    if (!this.currentQuestion) return null;
    if (this.status !== "IN_PROGRESS") return null;
    if (this.phase === "REVEAL" || this.phase === "MCQ") return null;

    const player = this.players.get(playerId);
    if (!player) return null;
    if (player.hasAnsweredCurrentRound) {
      // no permetem spam de respostes, es podria fer més elaborat
      return null;
    }

    const normalizedGuess = normalizeText(guess);
    const normalizedTitle = normalizeText(this.currentQuestion.song.title);

    const isCorrect = normalizedGuess === normalizedTitle;

    let points = 0;
    if (isCorrect) {
      switch (this.phase) {
        case "EMOJIS":
          points = this.config.pointsEmojis;
          break;
        case "HINT1":
          points = this.config.pointsHint1;
          break;
        case "HINT2":
          points = this.config.pointsHint2;
          break;
      }
      player.score += points;
    }

    player.hasAnsweredCurrentRound = true;
    this.answeredPlayers.add(playerId);

    return {
      isCorrect,
      points,
      normalizedGuess,
      normalizedTitle,
    };
  }

  submitMultipleChoiceAnswer(playerId: string, optionIndex: number): AnswerResult | null {
    if (!this.currentQuestion) return null;
    if (this.status !== "IN_PROGRESS") return null;
    if (this.phase !== "MCQ") return null;

    const player = this.players.get(playerId);
    if (!player) return null;
    if (player.hasAnsweredCurrentRound) return null;

    const correctIndex = this.currentQuestion.hint3CorrectIndex ?? -1;
    const isCorrect = optionIndex === correctIndex;

    let points = 0;
    if (isCorrect) {
      points = this.config.pointsMcq;
      player.score += points;
    }

    player.hasAnsweredCurrentRound = true;
    this.answeredPlayers.add(playerId);

    return {
      isCorrect,
      points,
      normalizedGuess: "",
      normalizedTitle: "",
    };
  }

  // ─────────────────────────────
  // ESTATS PÚBLICS PER LA UI
  // ─────────────────────────────

  getPublicState(): PublicGameState {
    const players = Array.from(this.players.values()).sort(
      (a, b) => b.score - a.score
    );

    let currentRound: PublicRoundState | undefined = undefined;

    if (this.status === "IN_PROGRESS" && this.currentQuestion) {
      currentRound = {
        roundNumber: this.currentRoundIndex + 1,
        totalRounds: this.config.totalRounds,
        phase: this.phase,
        emojis: this.currentQuestion.emojis,
        hint1: this.phase !== "EMOJIS" ? this.currentQuestion.hint1 : undefined,
        hint2:
          this.phase === "HINT2" || this.phase === "MCQ" || this.phase === "REVEAL"
            ? this.currentQuestion.hint2
            : undefined,
        hint3Options:
          this.phase === "MCQ" || this.phase === "REVEAL"
            ? this.currentQuestion.hint3Options
            : undefined,
      };
    }

    return {
      status: this.status,
      currentRound,
      players,
    };
  }

  getCurrentQuestionForDebug(): Question | null {
    // només per debug/admin (no per enviar als jugadors)
    return this.currentQuestion;
  }
}
