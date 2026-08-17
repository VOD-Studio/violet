import type { PageQuery } from "@shared/api/types";

/** subscriptionKeys - 订阅管理 query key 工厂 */
export const subscriptionKeys = {
	all: ["subscriptions"] as const,
	list: (status: string, query: PageQuery) =>
		[...subscriptionKeys.all, "list", status, query] as const,
	detail: (id: string) => [...subscriptionKeys.all, "detail", id] as const,
};
