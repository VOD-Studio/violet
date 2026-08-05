/**
 * theme-rerender - 主题切换时的异步重渲染协调点
 *
 * 问题背景：主题切换走 View Transition 圆形扩散时，若图块（mermaid）在 VT
 * 动画期间各自异步重渲染（MutationObserver 自治模式），DOM 持续写入会与 VT
 * 动画互相放大（实测 finished 从 ~500ms 拖到 9.5s，worst 帧 15s+）。
 *
 * 解法：重渲染任务注册到本表，由主题切换流程在 VT 动画结束后统一驱动
 * （transition.finished → runThemeRerender）。不能放 VT update 回调里
 * await——mermaid v11 渲染依赖被 VT 暂停的帧调度，update 里渲染会死锁。
 * 动画期间图块以旧色参与，结束后 ~400ms 统一换新色。
 *
 * 目标主题由调用方显式传入：next-themes 的 setTheme 只 setState，<html> class
 * 变更落在 React effect，VT 流程执行时 classList 可能还是旧主题，订阅方
 * 自己读 classList 会拿到旧值（首次切换不重渲的 bug 根源）。
 */

/** 目标主题(与 next-themes 的 dark/light 对齐) */
export type TargetTheme = "dark" | "light";

/** 订阅回调:收到目标主题;返回 Promise 时 VT 会等它完成 */
type ThemeRerenderFn = (theme: TargetTheme) => Promise<void> | void;

const subscribers = new Set<ThemeRerenderFn>();

/** 注册主题重渲染任务,返回取消函数(组件卸载时调) */
export function subscribeThemeRerender(fn: ThemeRerenderFn): () => void {
	subscribers.add(fn);
	return () => subscribers.delete(fn);
}

/**
 * 执行全部订阅任务并等其完成。仅由主题切换的 VT update 回调调用。
 * 单个订阅者异常/失败不阻塞其他订阅者与主题切换本身。
 */
export async function runThemeRerender(theme: TargetTheme): Promise<void> {
	const pending: Promise<void>[] = [];
	for (const fn of subscribers) {
		try {
			const r = fn(theme);
			if (r) pending.push(Promise.resolve(r).catch(() => {}));
		} catch {
			// 订阅者同步异常:忽略,不阻塞主题切换
		}
	}
	await Promise.all(pending);
}
