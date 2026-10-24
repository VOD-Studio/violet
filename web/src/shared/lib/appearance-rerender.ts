/** 明暗切换动画结束后统一重渲染，避免图表渲染依赖的帧调度被 View Transition 暂停。 */

/** 已解析的站点明暗状态。 */
export type TargetAppearance = "dark" | "light";

type AppearanceRerenderFn = (appearance: TargetAppearance) => Promise<void> | void;

const subscribers = new Set<AppearanceRerenderFn>();

/** 注册明暗重渲染任务，返回组件卸载时使用的取消订阅函数。 */
export function subscribeAppearanceRerender(fn: AppearanceRerenderFn): () => void {
	subscribers.add(fn);
	return () => subscribers.delete(fn);
}

/**
 * 动画结束后执行并等待全部任务；无动画时在明暗状态更新后立即执行。
 * 单个订阅者失败不阻塞其他任务。目标值由调用方传入，不依赖异步更新的 DOM。
 */
export async function runAppearanceRerender(appearance: TargetAppearance): Promise<void> {
	const pending: Promise<void>[] = [];
	for (const fn of subscribers) {
		try {
			const r = fn(appearance);
			if (r) pending.push(Promise.resolve(r).catch(() => {}));
		} catch {
			// 单个订阅者异常不阻塞明暗切换。
		}
	}
	await Promise.all(pending);
}
