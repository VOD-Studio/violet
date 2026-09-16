import { useQueries } from "@tanstack/react-query";
import { type ReactNode, useContext, useMemo } from "react";
import { fetchAppearances } from "../../api/appearance";
import { appearanceKeys, useOwnChatAppearance } from "../../api/appearance-queries";
import { appearanceBatches, normalizeAppearanceUserIDs } from "../../lib/appearance";
import { ChatAppearanceContext, type ChatAppearanceScope } from "../../model/appearance-context";

export interface ChatAppearanceProviderProps {
	/** 登录用户,用于按账号隔离的查询。 */
	currentUserID: string;
	/** 可见会话用户或已加载的发送者;自动去重。 */
	userIDs: readonly string[];
	/** 原聊天子树,不加布局包装直接渲染。 */
	children: ReactNode;
}

/** 挂在消息面板内时批量聚合可见用户并继承侧栏数据。 */
export function ChatAppearanceProvider({
	currentUserID,
	userIDs,
	children,
}: ChatAppearanceProviderProps) {
	const parentScope = useContext(ChatAppearanceContext);
	const parent = parentScope?.currentUserID === currentUserID ? parentScope : null;
	const ids = normalizeAppearanceUserIDs([...userIDs, currentUserID]);
	const missing = ids.filter((id) => id !== currentUserID && !parent?.coveredIDs.has(id));
	const batches = appearanceBatches(missing);
	const self = useOwnChatAppearance(currentUserID);
	const results = useQueries({
		queries: batches.map((batch) => ({
			queryKey: appearanceKeys.batch(currentUserID, batch),
			queryFn: ({ signal }: { signal: AbortSignal }) => fetchAppearances(batch, signal),
			enabled: Boolean(currentUserID),
			staleTime: 10_000,
			refetchInterval: 30_000,
			refetchIntervalInBackground: false,
			refetchOnWindowFocus: true,
			retry: false,
		})),
	});
	// 由查询结果驱动更新,而非每头像一个 effect;ChatAvatar 内部不发请求。
	const value = useMemo<ChatAppearanceScope>(
		() => ({
			currentUserID,
			coveredIDs: new Set([...(parent?.coveredIDs ?? []), ...ids]),
			values: Object.assign(
				{},
				parent?.values,
				...results.map((result) => result.data ?? {}),
				self.data && currentUserID ? { [currentUserID]: self.data } : {},
			),
		}),
		[currentUserID, parent, ids, results, self.data],
	);
	return (
		<ChatAppearanceContext.Provider value={value}>{children}</ChatAppearanceContext.Provider>
	);
}
