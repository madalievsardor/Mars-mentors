import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDashboard,
  getMentors,
  getMentorHistory,
  getNotificationSettings,
  updateNotificationSetting,
  triggerSync,
} from '../api/client';
import type { NotificationSetting } from '../types';

export const QUERY_KEYS = {
  dashboard: ['dashboard'] as const,
  mentors: ['mentors'] as const,
  mentorHistory: (id: string) => ['mentors', id, 'history'] as const,
  notifications: ['notifications'] as const,
};

export const useDashboard = () =>
  useQuery({
    queryKey: QUERY_KEYS.dashboard,
    queryFn: getDashboard,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useMentors = () =>
  useQuery({
    queryKey: QUERY_KEYS.mentors,
    queryFn: getMentors,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useMentorHistory = (id: string | null) =>
  useQuery({
    queryKey: QUERY_KEYS.mentorHistory(id ?? ''),
    queryFn: () => getMentorHistory(id!),
    enabled: id !== null,
  });

export const useNotificationSettings = () =>
  useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: getNotificationSettings,
  });

export const useUpdateNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      mentorId,
      payload,
    }: {
      mentorId: string;
      payload: Partial<Pick<NotificationSetting, 'enabled' | 'threshold'>>;
    }) => updateNotificationSetting(mentorId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
    },
  });
};

export const useTriggerSync = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mentors });
    },
  });
};
