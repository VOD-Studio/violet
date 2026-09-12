import { apiGet } from "@shared/api/request";
import type { RuntimeLogFilter, RuntimeLogPage, RuntimeLogStatus } from "../model/types";

interface RuntimeLogPageOptions {
	before: string;
	limit: number;
	signal?: AbortSignal;
}

export const fetchRuntimeLogs = (
	filters: RuntimeLogFilter,
	{ before, limit, signal }: RuntimeLogPageOptions,
) =>
	apiGet<RuntimeLogPage>("/admin/runtime-logs", {
		params: {
			levels: filters.levels?.length ? filters.levels.join(",") : undefined,
			source: filters.source || undefined,
			keyword: filters.keyword || undefined,
			request_id: filters.request_id || undefined,
			trace_id: filters.trace_id || undefined,
			from: filters.from || undefined,
			until: filters.until || undefined,
			before: before || undefined,
			limit,
		},
		signal,
	});

export const fetchRuntimeLogStatus = (signal?: AbortSignal) =>
	apiGet<RuntimeLogStatus>("/admin/runtime-logs/status", { signal });
