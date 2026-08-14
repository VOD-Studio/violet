import { clientQueryClient } from "@shared/api/query-client";
import { toast } from "sonner";
import { create } from "zustand";

import { fetchSubscription, getSubscription } from "../api/client";
import { subscriptionKeys } from "../api/keys";

/**
 * SubscriptionFetchingState - 手动抓取进行态（Zustand 单例）
 *
 * 状态与轮询必须长在组件外：立即抓取是 202 异步任务，抓取期间用户在
 * admin 菜单间导航会卸载路由组件——组件内 useState/useRef 会丢 spin 并
 * 中止轮询。store 是模块级单例，导航往返后 spin 自动恢复、轮询不中断。
 */
interface SubscriptionFetchingState {
	/** 正在抓取的订阅 id 集合（202 返回后后台异步执行，直到 last_fetched_at 变化） */
	fetchingIds: Set<string>;
}

export const useSubscriptionFetchingStore = create<SubscriptionFetchingState>()(() => ({
	fetchingIds: new Set<string>(),
}));

const MAX_MS = 300_000; // 5min 保底：源站极慢或轮询异常时的 spin 上限
const INTERVAL = 5000;

// 轮询 timer 按订阅 id 管理，另有 `fallback:${id}` 保底超时项，clear 时一并清理
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const fallbackKey = (id: string) => `fallback:${id}`;

const clearFetching = (id: string) => {
	for (const key of [id, fallbackKey(id)]) {
		const t = timers.get(key);
		if (t) {
			clearTimeout(t);
			timers.delete(key);
		}
	}
	useSubscriptionFetchingStore.setState((s) => {
		if (!s.fetchingIds.has(id)) return s;
		const next = new Set(s.fetchingIds);
		next.delete(id);
		return { fetchingIds: next };
	});
};

// 轮询订阅详情检测 last_fetched_at 变化——不读 list 缓存，
// 避免筛选/分页切换导致读不到数据。
const poll = async (id: string, prevFetchedAt: string | null, startTime: number) => {
	if (Date.now() - startTime > MAX_MS) return;
	try {
		const detail = await getSubscription(id);
		if ((detail.last_fetched_at ?? null) !== prevFetchedAt) {
			clearFetching(id);
			clientQueryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
			return;
		}
	} catch {
		// 网络错误不中断轮询，下轮重试
	}
	timers.set(
		id,
		setTimeout(() => poll(id, prevFetchedAt, startTime), INTERVAL),
	);
};

/** triggerSubscriptionFetch - 手动触发抓取并跟踪完成（「立即抓取」入口） */
export const triggerSubscriptionFetch = (id: string, prevFetchedAt: string | null) => {
	if (useSubscriptionFetchingStore.getState().fetchingIds.has(id)) return;
	useSubscriptionFetchingStore.setState((s) => ({
		fetchingIds: new Set(s.fetchingIds).add(id),
	}));

	const startTime = Date.now();
	fetchSubscription(id)
		.then(() => {
			toast.success("抓取已开始，完成后会通知你");
			timers.set(
				id,
				setTimeout(() => poll(id, prevFetchedAt, startTime), INTERVAL),
			);
			timers.set(
				fallbackKey(id),
				setTimeout(() => clearFetching(id), MAX_MS),
			);
		})
		.catch((e: Error) => {
			toast.error(`抓取失败：${e.message}`);
			clearFetching(id);
		});
};
