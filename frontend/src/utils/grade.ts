// Shared grade-recommendation logic, used by both the Mentors page (intern
// count tile + name bridging) and the Interns page (grade recommendation badge).
//
// The two systems (Mars + int-server) write the same mentor's name differently,
// so we bridge them by a normalized name with a three-stage resolver:
// EXACT (normalized equality) → MANUAL (hand-curated map) → FUZZY (Levenshtein ≤ 3).

// ──────────── name matching ────────────

// Normalize a name for cross-system matching. The same mentor can be written
// differently across Mars and int-server, e.g. "Ibrohim Tolqinov" vs
// "Ibrohim To'lqinov". We lowercase, strip every apostrophe variant, and drop
// all non-alphanumeric characters so only letters/digits remain. Result:
// "Ibrohim To'lqinov" → "ibrohimtolqinov" === "Ibrohim Tolqinov" → match.
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    // Remove Uzbek/ASCII apostrophe + accent variants outright (so they don't
    // become a separating boundary): ʻ ‘ ’ ʼ ` ´ '
    .replace(/[ʻ‘’ʼ`´']/g, '')
    // Drop everything that isn't a basic latin letter or digit (spaces, dots,
    // commas, dashes, any leftover punctuation).
    .replace(/[^a-z0-9]/g, '')
}

// Levenshtein edit distance between two strings. Used as a fuzzy fallback when
// the normalized names aren't byte-identical but clearly refer to the same
// person (e.g. "Abbosxon Xamidov" vs "Abbos Xamidov" → distance 2).
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

// Max edit distance (on normalized full names) at which a fuzzy match is still
// accepted as the same person.
export const FUZZY_MAX_DISTANCE = 3

// Hand-curated map for people the fuzzy matcher can't catch — name/surname
// order swapped, or a spelling gap too large for distance ≤ 3. Keyed by
// normalized name → normalized counterpart name. Applied after exact, before fuzzy.
export const MANUAL_MAP: Record<string, string> = {
  // "Emirxan Ertan" ↔ "Ertan Emirhan" — first/last name swapped
  [normalizeName('Emirxan Ertan')]: normalizeName('Ertan Emirhan'),
  // "Islomjon Shaxobiddinov" ↔ "Islom Shahobiddinov"
  [normalizeName('Islomjon Shaxobiddinov')]: normalizeName('Islom Shahobiddinov'),
  // "Jamshidbek Saminjonov" ↔ "Jamshid Salimjonov"
  [normalizeName('Jamshidbek Saminjonov')]: normalizeName('Jamshid Salimjonov'),
}

// Make the manual map symmetric so it works regardless of which side is the
// query and which is the candidate (Mentors page queries Mars→int, Interns page
// queries int→Mars).
const MANUAL_MAP_SYMMETRIC: Record<string, string> = (() => {
  const m: Record<string, string> = { ...MANUAL_MAP }
  for (const [k, v] of Object.entries(MANUAL_MAP)) m[v] = k
  return m
})()

// Resolve a query name against a set of candidate (normalized) names, returning
// the matched candidate's normalized key or null. Three stages:
//   1. EXACT  — normalized equality.
//   2. MANUAL — hand-curated override (symmetric).
//   3. FUZZY  — closest candidate within FUZZY_MAX_DISTANCE; skip ambiguous ties.
export function resolveName(queryName: string, candidateNorms: Iterable<string>): string | null {
  const queryNorm = normalizeName(queryName)
  const candidates = Array.from(candidateNorms)
  const candidateSet = new Set(candidates)

  // 1. EXACT.
  if (candidateSet.has(queryNorm)) return queryNorm

  // 2. MANUAL override (before fuzzy to avoid accidental fuzzy hits).
  const manualTarget = MANUAL_MAP_SYMMETRIC[queryNorm]
  if (manualTarget && candidateSet.has(manualTarget)) return manualTarget

  // 3. FUZZY: closest candidate within FUZZY_MAX_DISTANCE. Skip ambiguous ties
  // (two candidates equally close) to avoid false positives.
  let bestDist = FUZZY_MAX_DISTANCE + 1
  let bestNorm: string | null = null
  let tie = false
  for (const norm of candidates) {
    const d = levenshtein(queryNorm, norm)
    if (d < bestDist) {
      bestDist = d
      bestNorm = norm
      tie = false
    } else if (d === bestDist) {
      tie = true
    }
  }
  if (bestNorm && bestDist <= FUZZY_MAX_DISTANCE && !tie) return bestNorm
  return null
}

// ──────────── grade recommendation ────────────

export type GradeRec = 'up' | 'stay' | 'down'

// Grade recommendation thresholds (intern percentage of total students).
// < 7% → grade should go down; 7–12% → stays; > 12% → should go up.
export const GRADE_STAY_THRESHOLD = 7
export const GRADE_UP_THRESHOLD = 12

export function getGradeRec(internPct: number): GradeRec {
  if (internPct < GRADE_STAY_THRESHOLD) return 'down'
  if (internPct > GRADE_UP_THRESHOLD) return 'up'
  return 'stay'
}

// Required intern counts derived from the grade thresholds (7% / >12%):
// - needToStay: minimum interns so the grade does NOT drop (≥7%).
// - needToUp:   minimum interns so the grade can go UP (>12%).
export function needToStay(studentCount: number): number {
  return Math.ceil(studentCount * (GRADE_STAY_THRESHOLD / 100))
}

export function needToUp(studentCount: number): number {
  return Math.floor(studentCount * (GRADE_UP_THRESHOLD / 100)) + 1
}

// ──────────── grade cycle ────────────

// Grade is evaluated on a 6-month cycle. Easy to change here when a new cycle
// starts. Current cycle: 1 Apr 2026 → 1 Oct 2026.
export const CYCLE_START = new Date('2026-04-01')
export const CYCLE_MONTHS = 6

// Whole months elapsed since the cycle start, clamped to 0..CYCLE_MONTHS.
export function getMonthsElapsed(): number {
  const now = new Date()
  const months = Math.floor((now.getTime() - CYCLE_START.getTime()) / (30.44 * 24 * 60 * 60 * 1000))
  return Math.max(0, Math.min(CYCLE_MONTHS, months))
}
