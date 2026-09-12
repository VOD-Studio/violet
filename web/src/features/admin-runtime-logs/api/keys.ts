import type { RuntimeLogFilter } from "../model/types";

export const runtimeLogKeys = {
	all: ["admin-runtime-logs"] as const,
	lists: () => [...runtimeLogKeys.all, "list"] as const,
	list: (filters: RuntimeLogFilter) => [...runtimeLogKeys.lists(), filters] as const,
	status: () => [...runtimeLogKeys.all, "status"] as const,
	policy: () => [...runtimeLogKeys.all, "policy"] as const,
};
