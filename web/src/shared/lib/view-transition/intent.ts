import { create } from "zustand";

import { matchesAny } from "./patterns";

/** 共享元素的种类；同一时刻页面上每种至多一个元素携带转场名。 */
export type SharedName = "cover" | "avatar";

/**
 * 一次点击留下的共享元素意图：哪一种元素、哪一个实体、在哪些路由之间有效。
 *
 * 来源页点击时登记，来源与目标页上 id 相同的元素才会获得转场名，浏览器据此做 morph；
 * 浏览器后退时意图仍然有效，所以返回的列表页对应卡片同样会获得转场名并反向 morph。
 */
export interface SharedIntent {
	name: SharedName;
	id: string;
	/**
	 * 来源页上被点击的那一个实例；同一实体在来源页出现多次（如同一作者的多条推文）时用它唯一指定。
	 * 声明了 instance 的元素必须与之相同才参与 morph，目标页的元素不声明 instance。
	 */
	instance?: string;
	/** 意图有效的路由模式；导航到范围之外时意图被清除，避免残留转场名造成莫名飞入。 */
	scope: readonly string[];
}

interface SharedIntentState {
	intent: SharedIntent | null;
	mark(intent: SharedIntent): void;
	clear(): void;
}

export const useSharedIntent = create<SharedIntentState>((set) => ({
	intent: null,
	mark: (intent) => set({ intent }),
	clear: () => set({ intent: null }),
}));

/**
 * 登记共享元素意图，供来源链接的 onClick 调用。
 *
 * @example
 * <Link to="/blog/$slug" onClick={() => markSharedSource("cover", post.slug, BLOG_SCOPE)} />
 */
export function markSharedSource(
	name: SharedName,
	id: string,
	scope: readonly string[],
	instance?: string,
): void {
	useSharedIntent.getState().mark({ name, id, scope, instance });
}

/** 一次导航的两端是否都在意图的有效范围内。 */
export function intentCovers(
	intent: SharedIntent | null,
	from: string | undefined,
	to: string,
): boolean {
	return intent !== null && matchesAny(intent.scope, from) && matchesAny(intent.scope, to);
}

/**
 * 导航开始时整理意图：两端不都在有效范围内就清除，返回清除后仍然有效的意图。
 *
 * 由路由器的转场回调调用，保证意图只在它所属的路由之间存在。
 */
export function reconcileIntent(from: string | undefined, to: string): SharedIntent | null {
	const { intent, clear } = useSharedIntent.getState();
	if (intent === null) return null;
	if (intentCovers(intent, from, to)) return intent;
	clear();
	return null;
}
