import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RuntimeLogFilter } from "../model/types";
import {
	fetchRuntimeLogPolicy,
	fetchRuntimeLogStatus,
	fetchRuntimeLogs,
	rotateRuntimeLogs,
	updateRuntimeLogPolicy,
} from "./client";
import { runtimeLogKeys } from "./keys";

export const RUNTIME_LOG_PAGE_SIZE = 100;
export const MAX_RUNTIME_LOG_PAGES = 10;

/** 返回最新日志需 resetQueries；refetch 仅刷新当前保留的游标窗口。 */
export const useRuntimeLogs = (filters: RuntimeLogFilter, enabled = true) =>
	useInfiniteQuery({
		queryKey: runtimeLogKeys.list(filters),
		queryFn: ({ pageParam, signal }) =>
			fetchRuntimeLogs(filters, { before: pageParam, limit: RUNTIME_LOG_PAGE_SIZE, signal }),
		initialPageParam: "",
		getNextPageParam: (lastPage) =>
			lastPage.has_more && lastPage.next_cursor ? lastPage.next_cursor : undefined,
		maxPages: MAX_RUNTIME_LOG_PAGES,
		enabled,
		staleTime: 0,
		gcTime: 60_000,
	});

export const useRuntimeLogStatus = (enabled = true) =>
	useQuery({
		queryKey: runtimeLogKeys.status(),
		queryFn: ({ signal }) => fetchRuntimeLogStatus(signal),
		enabled,
		staleTime: 5_000,
		gcTime: 60_000,
		refetchInterval: 15_000,
		refetchIntervalInBackground: false,
	});

export const useRuntimeLogPolicy = (enabled = true) =>
	useQuery({
		queryKey: runtimeLogKeys.policy(),
		queryFn: ({ signal }) => fetchRuntimeLogPolicy(signal),
		enabled,
		staleTime: 5_000,
		gcTime: 60_000,
		refetchInterval: 15_000,
		refetchIntervalInBackground: false,
	});

export const useUpdateRuntimeLogPolicy = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: updateRuntimeLogPolicy,
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: runtimeLogKeys.policy() }),
				queryClient.invalidateQueries({ queryKey: runtimeLogKeys.status() }),
			]),
	});
};

export const useRotateRuntimeLogs = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: rotateRuntimeLogs,
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: runtimeLogKeys.policy() }),
				queryClient.invalidateQueries({ queryKey: runtimeLogKeys.lists() }),
			]),
	});
};
