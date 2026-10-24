import { useMe } from "@features/auth/api/queries";
import { useLoginDialogStore } from "@shared/api/login-dialog-store";
import { useSessionStore } from "@shared/api/session";
import { useQuery } from "@tanstack/react-query";
import type { UsageRange } from "../model/usage";
import { getUsageModels, getUsageSummary, getUsageTimeseries } from "./usage-client";

/** 账号和会话版本仅参与本地缓存隔离，不作为 API 的用户选择参数。 */
export const usageKeys = {
	all: ["profile", "usage"] as const,
	range: (userId: string | undefined, sessionVersion: number, range: UsageRange) =>
		[...usageKeys.all, userId, sessionVersion, range] as const,
};

/** 仅在客户端登录后读取；会话失效暂停，登出由 clearAuthCache 清除全部档位。 */
export function useUsage(range: UsageRange) {
	const { data: user } = useMe({ enabled: typeof window !== "undefined" });
	const sessionVersion = useSessionStore((state) => state.sessionVersion);
	const loginDialogOpen = useLoginDialogStore((state) => state.isOpen);
	const queryKey = usageKeys.range(user?.id, sessionVersion, range);
	const options = {
		enabled: typeof window !== "undefined" && !!user && !loginDialogOpen,
		staleTime: 60_000,
		meta: { sessionScoped: true },
	};
	const summary = useQuery({
		...options,
		queryKey: [...queryKey, "summary"],
		queryFn: ({ signal }) => getUsageSummary(range, signal),
	});
	const models = useQuery({
		...options,
		queryKey: [...queryKey, "models"],
		queryFn: ({ signal }) => getUsageModels(range, signal),
	});
	const timeseries = useQuery({
		...options,
		queryKey: [...queryKey, "timeseries"],
		queryFn: ({ signal }) => getUsageTimeseries(range, signal),
	});
	return { summary, models, timeseries };
}
