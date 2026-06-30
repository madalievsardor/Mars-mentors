import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getDashboard,
  getDashboardTimeline,
  getDashboardMonthly,
  getMentors,
  getMentorHistory,
  getMentorLeftStudents,
  getNotificationSettings,
  updateNotificationSetting,
  triggerSync,
  getInternsSummary,
  getInternDetail,
  getTutors,
  getTutorSlots,
  updateTutorSlots,
  updateTutorName,
  updateTutorProfile,
  removeTutor,
  deleteTutor,
  getTutorCandidates,
  addTutor,
  getBranches,
  createTutorAccount,
  getAttendanceOverview,
  getGroupAttendance,
  markAttendance,
  getTutorBookings,
} from '../api/client';
import type {
  NotificationSetting,
  UpdateTutorSlotsPayload,
  UpdateTutorNamePayload,
  UpdateTutorProfilePayload,
  CreateTutorAccountPayload,
  GroupAttendance,
  CellState,
} from '../types';

export const QUERY_KEYS = {
  dashboard: ['dashboard'] as const,
  mentors: ['mentors'] as const,
  mentorHistory: (id: string) => ['mentors', id, 'history'] as const,
  mentorLeftStudents: (id: string) => ['mentors', id, 'left-students'] as const,
  notifications: ['notifications'] as const,
  interns: ['interns'] as const,
  internDetail: (id: string) => ['interns', id, 'detail'] as const,
  dashboardTimeline: ['dashboard', 'timeline'] as const,
  dashboardMonthly: ['dashboard', 'monthly'] as const,
  tutors: ['tutors'] as const,
  tutorSlots: (id: number) => ['tutors', id, 'slots'] as const,
  tutorCandidates: ['tutors', 'candidates'] as const,
  branches: ['tutors', 'branches'] as const,
  attendanceOverview: ['attendance', 'overview'] as const,
  groupAttendance: (id: number) => ['attendance', 'group', id] as const,
  tutorBookings: (id: number) => ['tutors', id, 'bookings'] as const,
};

export const useInterns = () =>
  useQuery({
    queryKey: QUERY_KEYS.interns,
    queryFn: getInternsSummary,
    staleTime: 5 * 60 * 1000,
    // While int-server is still waking (available === false), poll every 8s so
    // the page fills in by itself; once it's up, fall back to the 5-min refresh.
    refetchInterval: (query) =>
      query.state.data && !query.state.data.available ? 8000 : 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

export const useInternDetail = (id: string | null) =>
  useQuery({
    queryKey: QUERY_KEYS.internDetail(id ?? ''),
    queryFn: () => getInternDetail(id!),
    enabled: id !== null,
    staleTime: 60 * 1000,
  });

export const useTutors = () =>
  useQuery({
    queryKey: QUERY_KEYS.tutors,
    queryFn: getTutors,
    staleTime: 5 * 60 * 1000,
    // While Mars is still waking (available === false), poll every 8s so the
    // list fills in by itself; once it's up, fall back to the 5-min refresh.
    refetchInterval: (query) =>
      query.state.data && !query.state.data.available ? 8000 : 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

export const useTutorSlots = (id: number | null) =>
  useQuery({
    queryKey: QUERY_KEYS.tutorSlots(id ?? 0),
    queryFn: () => getTutorSlots(id!),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useUpdateTutorSlots = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: UpdateTutorSlotsPayload;
    }) => updateTutorSlots(id, payload),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tutorSlots(id) });
    },
  });
};

export const useUpdateTutorName = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: UpdateTutorNamePayload;
    }) => updateTutorName(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tutors });
    },
  });
};

export const useUpdateTutorProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: UpdateTutorProfilePayload;
    }) => updateTutorProfile(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tutors });
    },
  });
};

export const useRemoveTutor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => removeTutor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tutors });
    },
  });
};

export const useDeleteTutor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTutor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tutors });
    },
  });
};

export const useTutorCandidates = (enabled: boolean) =>
  useQuery({
    queryKey: QUERY_KEYS.tutorCandidates,
    queryFn: getTutorCandidates,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useAddTutor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => addTutor(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tutors });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tutorCandidates });
    },
  });
};

export const useBranches = (enabled: boolean) =>
  useQuery({
    queryKey: QUERY_KEYS.branches,
    queryFn: getBranches,
    enabled,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useCreateTutorAccount = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTutorAccountPayload) =>
      createTutorAccount(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.tutors });
    },
  });
};

export const useAttendanceOverview = () =>
  useQuery({
    queryKey: QUERY_KEYS.attendanceOverview,
    queryFn: () => getAttendanceOverview(false),
    // Backend scans every active group, so it's heavy and cached server-side
    // (~30 min). Keep the client copy fresh for 10 min; no aggressive polling.
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

export const useRefreshAttendanceOverview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => getAttendanceOverview(true),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.attendanceOverview, data);
    },
  });
};

export const useGroupAttendance = (id: number | null) =>
  useQuery({
    queryKey: QUERY_KEYS.groupAttendance(id ?? 0),
    queryFn: () => getGroupAttendance(id!),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

export const useMarkAttendance = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAttendance,
    // Optimistic update: flip the targeted cell in the cached grid right away so
    // the UI reflects the mark without a manual reload. We patch exactly what was
    // written (the value we POSTed), so the cache stays truthful — no need to
    // immediately refetch the group (a refetch could even briefly read stale Mars
    // data). The cross-group overview counts are refreshed separately.
    onMutate: async (vars) => {
      const key = QUERY_KEYS.groupAttendance(vars.groupId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<GroupAttendance>(key)
      if (previous) {
        const violetDay =
          previous.days.find((d) => d.date === vars.date)?.isVioletDay ?? false
        // status 1 → present; status 0 → keep the column's violet tint if it's a
        // flagged violet day, otherwise a plain (real) absence.
        const nextState: CellState =
          vars.status === 1 ? 'present' : violetDay ? 'violet' : 'absent'

        let suspectVioletCount = previous.suspectVioletCount
        let unmarkedCount = previous.unmarkedCount
        const students = previous.students.map((s) => {
          if (s.studentId !== vars.studentId || s.frozen) return s
          return {
            ...s,
            cells: s.cells.map((c) => {
              if (c.date !== vars.date) return c
              // Keep the header issue counts roughly in sync as the cell changes.
              if (c.state === 'violet' && nextState !== 'violet') {
                suspectVioletCount = Math.max(0, suspectVioletCount - 1)
              }
              if (c.state === 'unmarked') {
                unmarkedCount = Math.max(0, unmarkedCount - 1)
              }
              return { ...c, state: nextState }
            }),
          }
        })
        queryClient.setQueryData<GroupAttendance>(key, {
          ...previous,
          students,
          suspectVioletCount,
          unmarkedCount,
        })
      }
      return { previous, key }
    },
    onError: (_err, _vars, ctx) => {
      // Roll the grid back to its pre-mutation snapshot on failure.
      if (ctx?.previous) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled: () => {
      // Eventual consistency for the (separately cached) cross-group overview.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.attendanceOverview })
    },
  })
};

export const useDashboard = () =>
  useQuery({
    queryKey: QUERY_KEYS.dashboard,
    queryFn: getDashboard,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useDashboardTimeline = () =>
  useQuery({
    queryKey: QUERY_KEYS.dashboardTimeline,
    queryFn: getDashboardTimeline,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export const useDashboardMonthly = () =>
  useQuery({
    queryKey: QUERY_KEYS.dashboardMonthly,
    queryFn: getDashboardMonthly,
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

export const useMentorLeftStudents = (id: string | null) =>
  useQuery({
    queryKey: QUERY_KEYS.mentorLeftStudents(id ?? ''),
    queryFn: () => getMentorLeftStudents(id!),
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

export const useTutorBookings = (id: number | null) =>
  useQuery({
    queryKey: QUERY_KEYS.tutorBookings(id ?? 0),
    queryFn: () => getTutorBookings(id!),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
