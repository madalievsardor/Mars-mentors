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
