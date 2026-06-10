export interface FilialOverview {
  branch: string;
  mentorCount: number;
  groupCount: number;
  totalStudents: number;
  ratio: number;
}

export interface MentorGroup {
  name: string;
  category: string;
  time: string;
  studentCount: number;
}

export interface TimelinePoint {
  date: string; // "MM-DD"
  [branch: string]: string | number;
}

export interface TimelineResponse {
  available: boolean;
  branches: string[];
  points: TimelinePoint[];
}

export type MentorGrade = 'senior' | 'middle' | 'junior';

export interface Mentor {
  id: string;
  mentorId: string;
  name: string;
  branch: string;
  grade: MentorGrade;
  groupCount: number;
  studentCount: number;
  groups: MentorGroup[];
  trend: 'up' | 'down' | 'stable' | null;
  prevStudentCount: number | null;
}

export interface MentorHistory {
  date: string;
  studentCount: number;
  groupCount: number;
}

export interface LeftStudent {
  studentId: number;
  name: string;
  groupName: string;
  lastSeenDate: string;
}

export interface MentorLeftStudents {
  mentorId: number;
  mentorName: string;
  leftStudents: LeftStudent[];
}

export interface NotificationSetting {
  mentorId: string;
  mentorName: string;
  branch: string;
  enabled: boolean;
  threshold: number;
}

export interface SyncResponse {
  success: boolean;
  syncedAt: string;
  message?: string;
}

export interface DashboardStats {
  totalMentors: number;
  totalGroups: number;
  totalStudents: number;
  activeBranches: number;
  lastSyncAt: string | null;
}

// ──────────── interns (int-server) ────────────

export interface InternBrief {
  id: string;
  name: string;
  grade: string;
  sphere: string;
  branch: string;
  status: string;
}

export interface MentorInterns {
  mentorId: string;
  mentorName: string;
  branches: string[];
  internCount: number;
  gradeBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  interns: InternBrief[];
}

export interface InternsSummary {
  /** False when int-server is still waking (Render cold start) — fields are
   *  empty and the client keeps polling until it flips true. */
  available: boolean;
  totalInterns: number;
  totalMentors: number;
  mentorsWithInterns: number;
  mentorsWithoutInterns: number;
  unassignedInterns: number;
  gradeDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  mentors: MentorInterns[];
}

export interface InternMentorLink {
  id: string;
  name: string;
  branch: string;
  branchTelegram?: string;
  isHeadIntern: boolean;
  joinedAt?: string;
}

export interface InternDetail {
  id: string;
  name: string;
  username?: string;
  phoneNumber?: string;
  telegram?: string;
  grade: string;
  sphere: string;
  status: string;
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

  lastLessonDate: string | null;
  daysSinceLastLesson: number | null;
  totalLessonsAttended: number;
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

  badgeCount: number;
  bonusLessonCount: number;
  mentors: InternMentorLink[];
}

// ──────────── Tutor work schedule (read-only) ────────────

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface TutorBrief {
  id: number;
  name: string;
  username: string;
  branch: string;
  branchId: number | null;
  avgRating: number | null;
  totalRatings: number;
  interestingPercent: number | null;
  understandablePercent: number | null;
}

export interface TutorsResponse {
  /** False when Mars could not be reached — list is empty, client can retry. */
  available: boolean;
  total: number;
  branches: string[];
  tutors: TutorBrief[];
}

export interface ScheduleSlot {
  id: number;
  fromHour: string; // "09:00"
  tillHour: string; // "09:30"
  range: string; // "09:00-09:30"
}

export interface ScheduleRange {
  from: string; // "09:00"
  to: string; // "19:00"
}

export interface ScheduleDay {
  weekday: Weekday;
  date: string | null;
  slots: ScheduleSlot[];
  ranges: ScheduleRange[];
}

export interface TutorSlotsResponse {
  available: boolean;
  tutorId: number;
  /** Du..Ya, always 7 entries in order. */
  days: ScheduleDay[];
  totalSlots: number;
  workingDays: number;
  totalHours: number;
}

// ──────────── Tutor edit (management) shapes ────────────

export interface UpdateTutorSlotsPayload {
  day: Weekday;
  fromHour: string; // "HH:MM"
  tillHour: string; // "HH:MM"
}

export interface UpdateTutorNamePayload {
  firstName: string;
  lastName: string;
}

/** Unified tutor edit — name and/or branch (filial rotate). All optional. */
export interface UpdateTutorProfilePayload {
  firstName?: string;
  lastName?: string;
  branchId?: number;
}

export interface TutorWriteResult {
  ok: boolean;
  message?: string;
}

/** A user who can be promoted to tutor (active mentor, not yet a tutor). */
export interface TutorCandidate {
  id: number;
  name: string;
  branch: string;
}

export interface TutorCandidatesResponse {
  available: boolean;
  total: number;
  candidates: TutorCandidate[];
}

// ──────────── Create new tutor account (new hire) ────────────

export type TutorScheduleType = 'full-time' | 'part-time';

export interface Branch {
  id: number;
  title: string;
}

export interface BranchesResponse {
  available: boolean;
  branches: Branch[];
}

export interface CreateTutorAccountPayload {
  firstName: string;
  lastName: string;
  phone: string;
  password?: string;
  branchId: number;
  schedule?: TutorScheduleType;
}

export interface CreateTutorAccountResult {
  ok: boolean;
  message?: string;
  userId?: number;
  name?: string;
  branch?: string;
  branchId?: number;
}
