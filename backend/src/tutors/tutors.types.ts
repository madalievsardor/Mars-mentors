// Shapes returned by the Mars tutor (work-schedule) API, plus the dashboard-facing
// types the read-only "Schedule" page consumes.

// ──────────── raw Mars shapes ────────────

/** One tutor from GET /api/v2/controls/tutors/stats/get. */
export interface MarsTutorStat {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  branch?: string;
  branch_id?: number;
  avg_rating?: number;
  interesting_percent?: number;
  understandable_percent?: number;
  total_ratings?: number;
}

export interface MarsTutorsStatsResponse {
  tutors: MarsTutorStat[];
  total_count?: number;
}

/** One filial (branch) from GET /api/v1/company. `id` is the branch_id. */
export interface MarsCompany {
  id: number;
  title: string;
}

/**
 * One user from GET /api/v2/users/teachers-and-tutors (and /all-users). The full
 * Mars user record; we only type the fields the profile-update flow reads. The
 * assigned branch lives under `profile.branches[].branch_id` (Mars has no
 * top-level branch_id on this record).
 */
export interface MarsV2User {
  id: number;
  first_name?: string;
  last_name?: string;
  phone?: string;
  profile?: {
    /** The PROFILE id — required by PUT /api/v2/users/company/activate. */
    id?: number;
    branches?: Array<{
      branch_id?: number;
      is_active?: boolean;
      /** Nested branch record; `branch.title` is the human filial name. */
      branch?: { id?: number; title?: string };
    }>;
  };
}

/** One booked half-hour slot inside a weekday bucket. */
export interface MarsSlot {
  id: number;
  from_hour: string; // "09:00:00"
  till_hour: string; // "09:30:00"
  time_range: string; // "09:00-09:30"
}

/**
 * One day entry from GET /api/v1/users/user_slots. The weekday name (monday..
 * sunday) is itself a key whose value is the slots array, alongside `date`.
 */
export type MarsUserSlotDay = {
  date: string; // "YYYY-MM-DD"
} & Partial<Record<Weekday, MarsSlot[]>>;

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

// ──────────── dashboard-facing shapes ────────────

export interface TutorBrief {
  id: number;
  name: string;
  username: string;
  branch: string;
  branchId: number | null;
  avgRating: number | null;
  totalRatings: number;
  /** % of students who found lessons interesting (0..100), if Mars reports it. */
  interestingPercent: number | null;
  /** % who found lessons understandable (0..100), if Mars reports it. */
  understandablePercent: number | null;
}

export interface TutorsResponse {
  /** False when Mars could not be reached — list is empty, client can retry. */
  available: boolean;
  total: number;
  branches: string[];
  tutors: TutorBrief[];
}

/** A single booked slot in the dashboard's normalized form. */
export interface ScheduleSlot {
  id: number;
  fromHour: string; // "09:00"
  tillHour: string; // "09:30"
  range: string; // "09:00-09:30"
}

/** A contiguous working interval, built by merging adjacent half-hour slots. */
export interface ScheduleRange {
  from: string; // "09:00"
  to: string; // "19:00"
}

/** One weekday column of a tutor's weekly schedule. */
export interface ScheduleDay {
  weekday: Weekday;
  /** Calendar date that this weekday maps to in the returned week, if known. */
  date: string | null;
  slots: ScheduleSlot[];
  /** Adjacent slots merged into compact working intervals (e.g. 09:00–19:00). */
  ranges: ScheduleRange[];
}

export interface TutorSlotsResponse {
  available: boolean;
  tutorId: number;
  /** Du..Ya, always 7 entries in order. */
  days: ScheduleDay[];
  /** Total booked slots across the week. */
  totalSlots: number;
  /** Number of weekdays that have at least one working interval. */
  workingDays: number;
  /** Total scheduled hours across the week (slots * 0.5h). */
  totalHours: number;
}

// ──────────── booking stats ────────────

export interface BookingEntry {
  id: number;
  studentName: string;
  topic: string;
  dateTime: string;
  status: string;
}

export interface TutorBookingStats {
  tutorId: number;
  total: number;
  byStatus: Record<string, number>;
  recent: BookingEntry[];
}

// ──────────── write (edit) shapes ────────────

/** One 30-minute slot template from GET /api/v1/users/slots_list. */
export interface MarsSlotTemplate {
  id: number;
  from_hour: string; // "09:00:00" or "09:00"
  till_hour: string; // "09:30:00" or "09:30"
}

/**
 * Replace one weekday's working interval for a tutor.
 * `fromHour`/`tillHour` are "HH:MM"; an empty/equal pair clears the day.
 */
export interface UpdateTutorSlotsDto {
  day: Weekday;
  fromHour: string;
  tillHour: string;
}

/** Edit a tutor's profile — name and/or branch (all optional). */
export interface UpdateTutorDto {
  firstName?: string;
  lastName?: string;
  branchId?: number;
}

/** Generic write result echoed back to the dashboard. */
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
  /** False when Mars could not be reached — list is empty, client can retry. */
  available: boolean;
  total: number;
  candidates: TutorCandidate[];
}

/** Promote a user to the tutor role. */
export interface AddTutorDto {
  userId: number;
}

// ──────────── create-account (new hire) shapes ────────────

/** Schedule type accepted by Mars `POST /api/v2/users/create`. */
export type TutorScheduleType = 'full-time' | 'part-time';

/** One branch (filial) the new tutor can be assigned to. */
export interface Branch {
  id: number;
  title: string;
}

export interface BranchesResponse {
  available: boolean;
  branches: Branch[];
}

/**
 * Result of creating a brand-new Mars account and promoting it to tutor.
 * `userId` is the new Mars user id (used by the client to open the schedule
 * editor right after creation).
 */
export interface CreateTutorAccountResult {
  ok: boolean;
  message?: string;
  userId?: number;
  name?: string;
  branch?: string;
  branchId?: number;
}
