import { type RefCallback, useCallback, useEffect, useState } from "react";

const listeners = new Map<Element, () => void>();
let observer: IntersectionObserver | undefined;

function observe(element: Element, prepare: () => void) {
	if (typeof IntersectionObserver === "undefined") {
		prepare();
		return () => {};
	}
	if (!observer) {
		observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const listener = listeners.get(entry.target);
					listeners.delete(entry.target);
					observer?.unobserve(entry.target);
					listener?.();
				}
			},
			{ rootMargin: `${window.innerHeight}px 0px` },
		);
	}
	listeners.set(element, prepare);
	observer.observe(element);
	return () => {
		listeners.delete(element);
		observer?.unobserve(element);
		if (listeners.size === 0) {
			observer?.disconnect();
			observer = undefined;
		}
	};
}

/** 主线程一直忙碌时，等待空闲的最长时间。 */
const IDLE_TIMEOUT_MS = 2000;
/** 不支持 requestIdleCallback 的浏览器让出首屏渲染的延时。 */
const IDLE_FALLBACK_DELAY_MS = 200;

const idleListeners = new Set<() => void>();
let idleScheduled = false;

function flushIdle() {
	idleScheduled = false;
	const pending = [...idleListeners];
	idleListeners.clear();
	for (const prepare of pending) prepare();
}

function whenIdle(prepare: () => void) {
	idleListeners.add(prepare);
	if (!idleScheduled) {
		idleScheduled = true;
		if (typeof requestIdleCallback === "function") {
			requestIdleCallback(flushIdle, { timeout: IDLE_TIMEOUT_MS });
		} else {
			setTimeout(flushIdle, IDLE_FALLBACK_DELAY_MS);
		}
	}
	return () => {
		idleListeners.delete(prepare);
	};
}

/** 视口之外的启用时机。 */
export interface ViewportPreparationOptions {
	/**
	 * 浏览器空闲后即使仍在远处也启用，供读者可能直接跳转到的内容提前准备。
	 *
	 * @default false
	 */
	idle?: boolean;
}

/**
 * 内容接近视口时一次性启用增强，离开后仍保留已挂载的结果。
 *
 * @typeParam T - 承载可读降级内容的宿主元素类型。
 * @returns 稳定的宿主 ref 与只会从 false 变为 true 的 ready 标记。
 * @remarks SSR 始终返回 ready=false；浏览器不支持 IO 时挂载后启用。
 * 所有未准备的宿主共享观察器，准备距离为创建观察器时的一屏高度；卸载后解除订阅。
 * 等待空闲的宿主共用一次空闲回调，同一批一起启用。
 */
export function useViewportPreparation<T extends HTMLElement>({
	idle = false,
}: ViewportPreparationOptions = {}): {
	ref: RefCallback<T>;
	ready: boolean;
} {
	const [element, setElement] = useState<T | null>(null);
	const [ready, setReady] = useState(false);
	const ref = useCallback<RefCallback<T>>((node) => setElement(node), []);
	useEffect(() => {
		if (!element || ready) return;
		const prepare = () => setReady(true);
		const stopObserving = observe(element, prepare);
		const stopWaiting = idle ? whenIdle(prepare) : undefined;
		return () => {
			stopObserving();
			stopWaiting?.();
		};
	}, [element, ready, idle]);
	return { ref, ready };
}
