// Shapes returned by the Mars int-server (internship admin) REST API.
// Only the fields the dashboard actually uses are typed.

export interface IntLoginResponse {
  token: string;
  refreshToken?: string;
  user?: {
    _id: string;
    name: string;
    lastName: string;
    role: string;
  };
}

export interface IntMentorRef {
  _id: string;
  name: string;
  lastName: string;
}

export interface IntBranchRef {
  _id: string;
  name: string;
  telegramLink?: string;
}

/** One entry in an intern's `branches` array — this is where the mentor link lives. */
export interface IntInternBranch {
  branch: IntBranchRef | null;
  mentor: IntMentorRef | null;
  isHeadIntern?: boolean;
  joinedAt?: string;
}

/** One lesson the intern was marked present for. The element `_id` is a Mongo
 *  ObjectId whose leading 4 bytes encode the creation timestamp — that is our
 *  per-lesson date (the payload itself carries no explicit date field). */
export interface IntLessonVisited {
  mentorId?: string;
  lessonId?: string;
  count?: number;
  _id?: string;
}

export interface IntIntern {
  _id: string;
  name: string;
  lastName: string;
  username?: string;
  phoneNumber?: string;
  telegram?: string;
  sphere?: string;
  grade?: string;
  status?: string;
  level?: number;
  xp?: number;
  score?: number;
  currentStreak?: number;
  longestStreak?: number;
  dateJoined?: string;
  probationStartDate?: string;
  probationPeriod?: number;
  lessonsPerMonth?: number;
  confirmedLessonsThisMonth?: number;
  confirmedLessonsCount?: number;
  pendingLessonsCount?: number;
  requiredLessonsByNow?: number;
  deficit?: number;
  isPlanBlocked?: boolean;
  reason?: string;
  weeklyTarget?: number;
  completedWeeksInMonth?: number;
  elapsedWorkingDays?: number;
  totalWorkingDaysInWindow?: number;
  lessonsVisited?: IntLessonVisited[];
  bonusLessons?: unknown[];
  badges?: unknown[];
  branches?: IntInternBranch[];
}

export interface IntMentor {
  _id: string;
  name: string;
  lastName: string;
  role: string;
  branches?: IntBranchRef[];
}

// ──────────── dashboard-facing shapes ────────────

export interface InternBrief {
  id: string;
  name: string;
  grade: string;
  sphere: string;
  branch: string;
  /** active | frozen | archived | unknown */
  status: string;
}

export interface MentorInterns {
  mentorId: string;
  mentorName: string;
  branches: string[];
  internCount: number;
  /** intern count by grade, e.g. { junior: 5, middle: 2 } */
  gradeBreakdown: Record<string, number>;
  /** intern count by status, e.g. { active: 4, frozen: 1 } */
  statusBreakdown: Record<string, number>;
  interns: InternBrief[];
}

export interface InternsSummary {
  totalInterns: number;
  totalMentors: number;
  mentorsWithInterns: number;
  /** Mentors that currently have zero interns assigned. */
  mentorsWithoutInterns: number;
  unassignedInterns: number;
  gradeDistribution: Record<string, number>;
  /** intern count by status across all interns (active/frozen/archived/unknown) */
  statusDistribution: Record<string, number>;
  mentors: MentorInterns[];
}

/** A mentor an intern is linked to, with the branch where the link applies. */
export interface InternMentorLink {
  id: string;
  name: string;
  branch: string;
  branchTelegram?: string;
  isHeadIntern: boolean;
  joinedAt?: string;
}

/** Full profile for the intern detail modal. Combines raw int-server fields
 *  with attendance figures derived from `lessonsVisited`. */
export interface InternDetail {
  id: string;
  name: string;
  username?: string;
  phoneNumber?: string;
  telegram?: string;
  grade: string;
  sphere: string;
  status: string;
  /** active === not frozen/archived */
  isActive: boolean;
  level?: number;
  xp?: number;
  score?: number;
  currentStreak?: number;
  longestStreak?: number;
  dateJoined?: string;
  probationStartDate?: string;
  probationPeriod?: number;
  lessonsPerMonth?: number;

  // ── derived attendance ──
  /** ISO date of the most recent visited lesson, or null if none. */
  lastLessonDate: string | null;
  /** Whole days between lastLessonDate and now, or null if no lessons. */
  daysSinceLastLesson: number | null;
  /** Total lessons the intern has been marked present for. */
  totalLessonsAttended: number;
  /** This-month confirmed count straight from int-server. */
  confirmedLessonsThisMonth?: number;
  confirmedLessonsCount?: number;
  pendingLessonsCount?: number;

  // ── plan ──
  requiredLessonsByNow?: number;
  deficit?: number;
  isPlanBlocked?: boolean;
  reason?: string;
  weeklyTarget?: number;
  completedWeeksInMonth?: number;
  elapsedWorkingDays?: number;
  totalWorkingDaysInWindow?: number;

  badgeCount: number;
  bonusLessonCount: number;
  mentors: InternMentorLink[];
}
