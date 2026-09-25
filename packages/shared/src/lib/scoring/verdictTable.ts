import type { Tier } from './weights';

export type VerdictLocale = 'vi' | 'en';

// Static verdict phrases per tier per locale. Consumed during the live
// outro display when the toggle is on. The v1 LLM path replaces this
// with a free-form sentence written into ScoreRecord.verdict, so the
// downstream display logic stays the same shape.
export const VERDICT_TABLE: Record<Tier, Record<VerdictLocale, string>> = {
  S: {
    vi: 'Diva phòng karaoke! 🌟',
    en: 'Karaoke royalty! 🌟',
  },
  A: {
    vi: 'Hát đỉnh quá nha! 🎤',
    en: 'Stage-ready performance! 🎤',
  },
  B: {
    vi: 'Giọng có lửa rồi đó! 🔥',
    en: 'Solid set — you found the groove. 🔥',
  },
  C: {
    vi: 'Khởi đầu ổn áp! 👏',
    en: 'Warming up nicely! 👏',
  },
  D: {
    vi: 'Lần sau hát tới luôn nha! 🎶',
    en: 'Let the room hear you next time! 🎶',
  },
};
