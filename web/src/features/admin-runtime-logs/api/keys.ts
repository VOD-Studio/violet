import type { RuntimeLogFilter } from "../model/types";

export const runtimeLogKeys = {
	all: ["admin-runtime-logs"] as const,
	list: (filters: RuntimeLogFilter) => [...runtimeLogKeys.all, "list", filters] as const,
	status: () => [...runtimeLogKeys.all, "status"] as const,
};
