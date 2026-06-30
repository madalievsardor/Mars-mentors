import axios from 'axios';
import { getStoredToken } from '../hooks/useAuth';
import type {
  FilialOverview,
  Mentor,
  MentorHistory,
  MentorLeftStudents,
  NotificationSetting,
  SyncResponse,
  InternsSummary,
  InternDetail,
  TimelineResponse,
  MonthlyResponse,
  TutorsResponse,
  TutorSlotsResponse,
  UpdateTutorSlotsPayload,
  UpdateTutorNamePayload,
  UpdateTutorProfilePayload,
  TutorWriteResult,
  TutorCandidatesResponse,
  BranchesResponse,
  CreateTutorAccountPayload,
  CreateTutorAccountResult,
  AttendanceOverview,
  GroupAttendance,
  GroupListItem,
  AttendanceMarkPayload,
  AttendanceMarkResult,
  TutorBookingStats,
  ApiLogEntry,
  LogCategory,
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

export const getDashboard = async (): Promise<FilialOverview[]> => {
  const { data } = await api.get<FilialOverview[]>('/dashboard');
  return data;
};

export const getDashboardTimeline = async (): Promise<TimelineResponse> => {
  const { data } = await api.get<TimelineResponse>('/dashboard/timeline');
  return data;
};

export const getDashboardMonthly = async (): Promise<MonthlyResponse> => {
  const { data } = await api.get<MonthlyResponse>('/dashboard/monthly');
  return data;
};

export const getMentors = async (): Promise<Mentor[]> => {
  const { data } = await api.get<Mentor[]>('/mentors');
  return data;
};

export const getMentorHistory = async (id: string): Promise<MentorHistory[]> => {
  const { data } = await api.get<{ mentorId: number; history: MentorHistory[] }>(`/mentors/${id}/history`);
  return data.history ?? [];
};

export const getMentorLeftStudents = async (
  id: string,
): Promise<MentorLeftStudents | null> => {
  const { data } = await api.get<MentorLeftStudents | null>(
    `/mentors/${id}/left-students`,
  );
  return data ?? null;
};

export const getNotificationSettings = async (): Promise<NotificationSetting[]> => {
  const { data } = await api.get<NotificationSetting[]>('/notifications/settings');
  return data;
};

export const updateNotificationSetting = async (
  mentorId: string,
  payload: Partial<Pick<NotificationSetting, 'enabled' | 'threshold'>>
): Promise<NotificationSetting> => {
  const { data } = await api.patch<NotificationSetting>(
    `/notifications/settings/${mentorId}`,
    payload
  );
  return data;
};

export const triggerSync = async (): Promise<SyncResponse> => {
  const { data } = await api.post<SyncResponse>('/sync');
  return data;
};

export const getInternsSummary = async (): Promise<InternsSummary> => {
  const { data } = await api.get<InternsSummary>('/interns/summary');
  return data;
};

export const getInternDetail = async (id: string): Promise<InternDetail> => {
  const { data } = await api.get<InternDetail>(`/interns/${id}`);
  return data;
};

export const getTutors = async (): Promise<TutorsResponse> => {
  const { data } = await api.get<TutorsResponse>('/tutors');
  return data;
};

export const getTutorSlots = async (id: number): Promise<TutorSlotsResponse> => {
  const { data } = await api.get<TutorSlotsResponse>(`/tutors/${id}/slots`);
  return data;
};

export const getTutorBookings = async (id: number): Promise<TutorBookingStats> => {
  const { data } = await api.get<TutorBookingStats>(`/tutors/${id}/bookings`);
  return data;
};

export const getTodayBookingsSummary = async (): Promise<Record<number, number>> => {
  const { data } = await api.get<Record<number, number>>('/tutors/bookings-summary');
  return data;
};

export interface NaborGroup {
  id: number
  name: string
  mentor: string | null
  mentorId: number | null
  branch: string | null
  category: string | null
  lessonStart: string
  lessonEnd: string
  days: number
  dateStarted: string
  studentsCount: number
}

export const getNaborGroups = async (): Promise<NaborGroup[]> => {
  const { data } = await api.get<NaborGroup[]>('/nabor')
  return data
};

export const getApiLogs = async (category?: LogCategory): Promise<ApiLogEntry[]> => {
  const { data } = await api.get<ApiLogEntry[]>('/logs', {
    params: category ? { category } : undefined,
  });
  return data;
};

export const updateTutorSlots = async (
  id: number,
  payload: UpdateTutorSlotsPayload,
): Promise<TutorWriteResult> => {
  const { data } = await api.post<TutorWriteResult>(
    `/tutors/${id}/slots`,
    payload,
  );
  return data;
};

export const updateTutorName = async (
  id: number,
  payload: UpdateTutorNamePayload,
): Promise<TutorWriteResult> => {
  const { data } = await api.patch<TutorWriteResult>(`/tutors/${id}`, payload);
  return data;
};

/** Unified profile edit — sends only the changed fields (name and/or branch). */
export const updateTutorProfile = async (
  id: number,
  payload: UpdateTutorProfilePayload,
): Promise<TutorWriteResult> => {
  const { data } = await api.patch<TutorWriteResult>(`/tutors/${id}`, payload);
  return data;
};

export const removeTutor = async (id: number): Promise<TutorWriteResult> => {
  const { data } = await api.post<TutorWriteResult>(`/tutors/${id}/remove`, {});
  return data;
};

/**
 * ⚠️ Permanently delete the user from Mars (irreversible). Gated behind a
 * strong type-the-name confirmation in the UI.
 */
export const deleteTutor = async (id: number): Promise<TutorWriteResult> => {
  const { data } = await api.delete<TutorWriteResult>(`/tutors/${id}`);
  return data;
};

export const getTutorCandidates = async (): Promise<TutorCandidatesResponse> => {
  const { data } = await api.get<TutorCandidatesResponse>('/tutors/candidates');
  return data;
};

export const addTutor = async (userId: number): Promise<TutorWriteResult> => {
  const { data } = await api.post<TutorWriteResult>('/tutors/add', { userId });
  return data;
};

export const getBranches = async (): Promise<BranchesResponse> => {
  const { data } = await api.get<BranchesResponse>('/tutors/branches');
  return data;
};

export const createTutorAccount = async (
  payload: CreateTutorAccountPayload,
): Promise<CreateTutorAccountResult> => {
  const { data } = await api.post<CreateTutorAccountResult>(
    '/tutors/create-account',
    payload,
  );
  return data;
};

export const getGroupsList = async (): Promise<GroupListItem[]> => {
  const { data } = await api.get<GroupListItem[]>('/attendance/groups');
  return data;
};

export const getAttendanceOverview = async (
  refresh = false,
): Promise<AttendanceOverview> => {
  const { data } = await api.get<AttendanceOverview>('/attendance/overview', {
    params: refresh ? { refresh: 1 } : undefined,
  });
  return data;
};

export const getGroupAttendance = async (
  groupId: number,
): Promise<GroupAttendance> => {
  const { data } = await api.get<GroupAttendance>(
    `/attendance/group/${groupId}`,
  );
  return data;
};

export const markAttendance = async (
  payload: AttendanceMarkPayload,
): Promise<AttendanceMarkResult> => {
  const { data } = await api.post<AttendanceMarkResult>(
    '/attendance/mark',
    payload,
  );
  return data;
};
