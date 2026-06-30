// Attendance feature types.
//
// Mars exposes only a raw status per (student, lesson-day): 1 = present,
// 0 = absent, or no record at all = unmarked. The Mars *UI* additionally paints
// some absences violet ("mentor didn't take attendance / auto-absent — should be
// corrected to present") vs red ("real, older absence — leave alone"), but the
// API does NOT carry that colour. We re-derive a "violet" (suspect) flag with the
// same heuristic the mars-davomat-fix workflow uses:
//   a recent lesson day on which (almost) the whole group is absent/unmarked is a
//   "violet day" — the mentor most likely never took attendance that day.
// See attendance.service.ts for the exact thresholds.

/** Cell colour for one (student, day). */
export type CellState = 'present' | 'absent' | 'violet' | 'unmarked';

/** Mars status_type values we care about. */
export const STATUS_TYPE_ACTIVE = 5;
export const STATUS_TYPE_FROZEN = 4;

export interface AttendanceDay {
  date: string; // YYYY-MM-DD
  /** Mentor who taught that day (Mars `day.user`), best-effort. */
  teacher: string | null;
  isReplaced: boolean;
  comment: string;
  /** A recent, near-whole-column absent/unmarked day — absences here are violet. */
  isVioletDay: boolean;
}

export interface AttendanceCell {
  date: string;
  state: CellState;
}

export interface AttendanceStudentRow {
  studentId: number;
  name: string;
  statusType: number; // 5 = active, 4 = frozen
  frozen: boolean;
  cells: AttendanceCell[];
  /** True when this student is a registered intern in the int-server. */
  isIntern?: boolean;
}

/** Full normalized grid for one group (drill-down view, mirrors core). */
export interface GroupAttendance {
  groupId: number;
  groupName: string;
  mentorId: number;
  mentorName: string;
  branch: string;
  windowFrom: string;
  windowTill: string;
  days: AttendanceDay[];
  students: AttendanceStudentRow[];
  suspectVioletCount: number;
  unmarkedCount: number;
  /** Dars xonasi nomi (GET /groups/{id} dan) */
  roomName: string | null;
  /** Kurator ismi (GET /groups/{id} dan, ba'zi guruhlarda null) */
  curatorName: string | null;
  /** Yo'nalish / kurs nomi */
  courseName: string | null;
  /** Dars boshlanish vaqti ("HH:MM" formati) */
  lessonStartTime: string | null;
  /** Dars tugash vaqti ("HH:MM" formati) */
  lessonEndTime: string | null;
  /** Haftada necha kun: 1=toq, 2=juft, boshqa = sonli */
  lessonDays: number | null;
}

/** Per-group issue summary used on the overview page. */
export interface GroupIssueSummary {
  groupId: number;
  groupName: string;
  branch: string;
  lastLessonDate: string | null;
  suspectVioletCount: number;
  unmarkedCount: number;
  activeStudents: number;
}

/** A mentor that has at least one group with attendance issues. */
export interface MentorAttendanceIssues {
  mentorId: number;
  mentorName: string;
  branch: string;
  /** suspectViolet + unmarked across all the mentor's flagged groups. */
  totalIssues: number;
  totalSuspectViolet: number;
  totalUnmarked: number;
  groups: GroupIssueSummary[];
}

/** Result of marking a single (student, day) cell present/absent. */
export interface MarkResult {
  ok: boolean;
  /** False when the cell was already in the requested state (no write needed). */
  changed: boolean;
  message?: string;
}

export interface AttendanceOverview {
  /** False when Mars couldn't be reached at all (caller can retry). */
  available: boolean;
  generatedAt: string;
  windowFrom: string;
  windowTill: string;
  totalGroupsScanned: number;
  mentors: MentorAttendanceIssues[];
  totalMentorsWithIssues: number;
  totalSuspectViolet: number;
  totalUnmarked: number;
}
