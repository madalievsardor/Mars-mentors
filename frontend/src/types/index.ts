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
