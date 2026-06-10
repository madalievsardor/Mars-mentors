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
