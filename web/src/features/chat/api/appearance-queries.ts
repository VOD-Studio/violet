import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatAppearance, ChatAppearanceState } from "../model/appearance";
import { fetchOwnAppearance, saveOwnAppearance } from "./appearance";

/** 每个 key 都带浏览账号,防止登录切换后复用缓存。 */
export const appearanceKeys = {
	root: (viewer: string) => ["chat", "appearance", viewer] as const,
	own: (viewer: string) => [...appearanceKeys.root(viewer), "own"] as const,
	users: (viewer: string) => [...appearanceKeys.root(viewer), "users"] as const,
	batch: (viewer: string, ids: readonly string[]) =>
		[...appearanceKeys.users(viewer), ids] as const,
};

/** 窗口聚焦/前台轮询,把其他设备上改过的外观同步过来。 */
export function useOwnChatAppearance(viewer: string) {
	return useQuery({
		queryKey: appearanceKeys.own(viewer),
		queryFn: ({ signal }) => fetchOwnAppearance(signal),
		enabled: Boolean(viewer),
		staleTime: 10_000,
		refetchInterval: 30_000,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: true,
		retry: false,
	});
}

/** 不做乐观视觉更新:先取消竞态读取,只发布服务端接受的状态。 */
export function useSaveChatAppearance(viewer: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (state: ChatAppearanceState) => saveOwnAppearance(state),
		retry: false,
		onSuccess: async (state) => {
			await client.cancelQueries({ queryKey: appearanceKeys.own(viewer) });
			client.setQueryData(appearanceKeys.own(viewer), state);
			client.setQueriesData<Record<string, ChatAppearance>>(
				{ queryKey: appearanceKeys.users(viewer) },
				(previous) => (previous ? { ...previous, [viewer]: state } : previous),
			);
			// Other users remain cached; the next foreground tick/focus revalidates the batch.
		},
	});
}
