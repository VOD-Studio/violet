import { useCallback, useEffect, useRef } from "react";

/**
 * DebounceOptions - 防抖配置
 */
export interface DebounceOptions {
	/** 延迟毫秒，默认 300 */
	delay?: number;
	/** 是否在调用开始时立即触发一次，默认 false */
	leading?: boolean;
	/** 是否在静默期结束后触发尾随调用，默认 true */
	trailing?: boolean;
	/** 最长等待兜底：连续触发时最多延迟多久必须发射，默认不限制 */
	maxWait?: number;
}

/**
 * Debounced - 防抖化的调用入口
 */
export interface Debounced<TArgs extends unknown[], TResult> {
	/** 防抖后的调用入口 */
	run: (...args: TArgs) => void;
	/** 立即触发挂起的 trailing 调用并返回结果，无挂起则 no-op */
	flush: () => TResult | undefined;
	/** 取消挂起调用，不触发 */
	cancel: () => void;
	/** 是否有挂起的 trailing 调用 */
	pending: () => boolean;
}

interface InternalState<TArgs extends unknown[], TResult> {
	/** 定时器 id */
	timer: ReturnType<typeof setTimeout> | null;
	/** maxWait 兜底定时器 */
	maxTimer: ReturnType<typeof setTimeout> | null;
	/** 最近一次 run 传入的参数，trailing 触发时使用 */
	lastArgs: TArgs | null;
	/** 最近一次 run 的结果（flush 返回用） */
	lastResult: TResult | undefined;
	/** 本次防抖窗口内是否已触发过 leading（避免 leading+trailing 双触发单次调用） */
	leadingInvoked: boolean;
}

/**
 * useDebouncedCallback - 回调防抖（语义对齐 lodash）
 *
 * 核心能力：
 * - callback 始终用最新闭包（内部 ref 持有，每次渲染更新），避免过期状态
 * - leading/trailing/maxWait 完整支持
 * - flush 立即触发挂起的 trailing 调用并返回结果
 * - cancel 丢弃挂起调用
 * - pending 查询是否有挂起
 * - 返回的 run/flush/cancel/pending 引用稳定，可安全放入依赖数组
 * - 卸载时取消所有定时器
 *
 * @param callback 被防抖的函数
 * @param options 防抖配置
 *
 * @example
 * const debounced = useDebouncedCallback((q: string) => search(q), { delay: 300 });
 * debounced.run("hello");   // 挂起
 * debounced.flush();        // 立即触发
 * debounced.cancel();       // 丢弃
 * debounced.pending();      // 是否挂起
 */
export function useDebouncedCallback<TArgs extends unknown[], TResult>(
	callback: (...args: TArgs) => TResult,
	options: DebounceOptions = {},
): Debounced<TArgs, TResult> {
	const { delay = 300, leading = false, trailing = true, maxWait } = options;

	// 始终持有最新 callback 闭包，避免过期状态
	const callbackRef = useRef(callback);
	useEffect(() => {
		callbackRef.current = callback;
	});

	const state = useRef<InternalState<TArgs, TResult>>({
		timer: null,
		maxTimer: null,
		lastArgs: null,
		lastResult: undefined,
		leadingInvoked: false,
	});

	const clearTimers = useCallback(() => {
		if (state.current.timer) {
			clearTimeout(state.current.timer);
			state.current.timer = null;
		}
		if (state.current.maxTimer) {
			clearTimeout(state.current.maxTimer);
			state.current.maxTimer = null;
		}
	}, []);

	const invoke = useCallback((args: TArgs): TResult => {
		state.current.lastResult = callbackRef.current(...args);
		return state.current.lastResult;
	}, []);

	// 核心：触发防抖调用
	const run = useCallback(
		(...args: TArgs) => {
			state.current.lastArgs = args;
			const s = state.current;

			// leading：窗口首次调用立即触发（仅一次）
			if (leading && !s.timer && !s.leadingInvoked) {
				s.leadingInvoked = true;
				invoke(args);
			}

			// 清除旧的 trailing 定时器，重置静默期
			if (s.timer) clearTimeout(s.timer);
			s.timer = setTimeout(() => {
				// trailing 窗口结束
				clearTimers();
				s.leadingInvoked = false;
				if (trailing && s.lastArgs) {
					invoke(s.lastArgs);
				}
				s.lastArgs = null;
			}, delay);

			// maxWait 兜底：连续触发时确保最长延迟后必发射
			if (maxWait !== undefined && !s.maxTimer) {
				s.maxTimer = setTimeout(() => {
					clearTimers();
					s.leadingInvoked = false;
					if (s.lastArgs) {
						invoke(s.lastArgs);
					}
					s.lastArgs = null;
				}, maxWait);
			}
		},
		[delay, leading, trailing, maxWait, invoke, clearTimers],
	);

	// flush：立即触发挂起的 trailing 调用
	const flush = useCallback((): TResult | undefined => {
		clearTimers();
		state.current.leadingInvoked = false;
		if (state.current.lastArgs) {
			const args = state.current.lastArgs;
			state.current.lastArgs = null;
			return invoke(args);
		}
		return undefined;
	}, [invoke, clearTimers]);

	// cancel：丢弃挂起
	const cancel = useCallback(() => {
		clearTimers();
		state.current.lastArgs = null;
		state.current.leadingInvoked = false;
	}, [clearTimers]);

	// pending：是否有挂起的 trailing 调用
	const pending = useCallback(() => state.current.timer !== null, []);

	// 卸载清理
	useEffect(() => clearTimers, [clearTimers]);

	return { run, flush, cancel, pending };
}
