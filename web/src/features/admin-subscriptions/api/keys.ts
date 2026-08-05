/** subscriptionKeys - 订阅管理 query key 工厂 */
export const subscriptionKeys = {
	all: ["subscriptions"] as const,
	list: (status: string, page: number, limit: number) =>
		[...subscriptionKeys.all, "list", status, page, limit] as const,
	detail: (id: string) => [...subscriptionKeys.all, "detail", id] as const,
};
