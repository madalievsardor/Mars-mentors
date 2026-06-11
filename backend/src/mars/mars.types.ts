export interface MarsAuthResponse {
  access_token: string;
  refresh_token: string;
}

export interface MarsTeacher {
  id: number;
  first_name: string;
  last_name: string;
  is_teacher: boolean;
  grade: string;
}

export interface MarsBranch {
  id: number;
  title: string;
}

export interface MarsCategory {
  id?: number;
  name: string;
  external_id?: string;
  image?: string;
  banner?: string;
  for_sale?: boolean;
  progress_percentage?: number;
  number_of_lessons?: number;
  program?: unknown;
}

export interface SimpleMentorGroup {
  id: number;
  name: string;
  category: string;
  time: string;
  studentCount: number;
}

export interface MarsGroupUser {
  id: number;
  first_name: string;
  last_name: string;
}

export interface MarsGroup {
  id: number;
  name: string;
  user: MarsGroupUser;
  branch: MarsBranch;
  category: MarsCategory;
  students_number: number;
  lesson_start_time: string;
  status: string;
  /** ISO timestamps marking the group's lifecycle window (used for the
   *  monthly-dynamics chart — a group is "active" in a month if the month
   *  overlaps [date_started, date_finished]). */
  date_started?: string | null;
  date_finished?: string | null;
}

export interface MarsGroupsResponse {
  page_count: number;
  groups: MarsGroup[];
}

/** A single student in a group roster (id + display name). */
export interface RosterStudent {
  id: number;
  name: string;
}

export interface MentorStat {
  id: number;
  name: string;
  branch: string;
  grade: string;
  groupCount: number;
  studentCount: number;
  groups: SimpleMentorGroup[];
}
