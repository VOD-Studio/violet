import { apiGet, apiPost, apiPut } from "@shared/api/request";
import type {
	RuntimeLogFilter,
	RuntimeLogMaintenance,
	RuntimeLogPage,
	RuntimeLogPolicyUpdate,
	RuntimeLogRotationResult,
	RuntimeLogStatus,
	UpdateRuntimeLogPolicyInput,
} from "../model/types";

const RUNTIME_LOGS_ENDPOINT = "/admin/runtime-logs";
const RUNTIME_LOGS_BROWSER_ENDPOINT = `/api/v1${RUNTIME_LOGS_ENDPOINT}`;

interface RuntimeLogPageOptions {
	before: string;
	limit: number;
	signal?: AbortSignal;
}

const filterParams = (filters: RuntimeLogFilter) => ({
	levels: filters.levels?.length ? filters.levels.join(",") : undefined,
	source: filters.source || undefined,
	keyword: filters.keyword || undefined,
	request_id: filters.request_id || undefined,
	trace_id: filters.trace_id || undefined,
	from: filters.from || undefined,
	until: filters.until || undefined,
});

const appendFilter = (params: URLSearchParams, filters: RuntimeLogFilter) => {
	for (const [name, value] of Object.entries(filterParams(filters))) {
		if (value !== undefined) params.set(name, value);
	}
};

export const fetchRuntimeLogs = (
	filters: RuntimeLogFilter,
	{ before, limit, signal }: RuntimeLogPageOptions,
) =>
	apiGet<RuntimeLogPage>(RUNTIME_LOGS_ENDPOINT, {
		params: {
			...filterParams(filters),
			before: before || undefined,
			limit,
		},
		signal,
	});

export const fetchRuntimeLogStatus = (signal?: AbortSignal) =>
	apiGet<RuntimeLogStatus>(`${RUNTIME_LOGS_ENDPOINT}/status`, { signal });

export const fetchRuntimeLogPolicy = (signal?: AbortSignal) =>
	apiGet<RuntimeLogMaintenance>(`${RUNTIME_LOGS_ENDPOINT}/policy`, { signal });

export const updateRuntimeLogPolicy = (input: UpdateRuntimeLogPolicyInput) =>
	apiPut<RuntimeLogPolicyUpdate>(`${RUNTIME_LOGS_ENDPOINT}/policy`, input);

export const rotateRuntimeLogs = () =>
	apiPost<RuntimeLogRotationResult>(`${RUNTIME_LOGS_ENDPOINT}/rotate`);

export const buildRuntimeLogStreamURL = (filters: RuntimeLogFilter, after: string) => {
	const params = new URLSearchParams();
	appendFilter(params, filters);
	params.set("after", after);
	return `${RUNTIME_LOGS_BROWSER_ENDPOINT}/stream?${params.toString()}`;
};

export const buildRuntimeLogExportURL = (filters: RuntimeLogFilter) => {
	const params = new URLSearchParams();
	appendFilter(params, filters);
	const query = params.toString();
	return `${RUNTIME_LOGS_BROWSER_ENDPOINT}/export${query ? `?${query}` : ""}`;
};
