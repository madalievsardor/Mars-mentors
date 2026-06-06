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
  name: string;
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
}

export interface MarsGroupsResponse {
  page_count: number;
  groups: MarsGroup[];
}

export interface MentorStat {
  id: number;
  name: string;
  branch: string;
  grade: string;
  groupCount: number;
  studentCount: number;
  groups: MarsGroup[];
}
