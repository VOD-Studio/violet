"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 异步检查默认在值停手这么久之后才发出。 */
const DEFAULT_ASYNC_DELAY = 600;

/** `useFieldCheck` 的入参。 */
export interface UseFieldCheckOptions<T> {
	/** 受控值。检查只读它，不持有第二份状态。 */
	value: T;
	/** 同步检查：返回错误文案，通过返回 `undefined`。 */
	validate?: (value: T) => string | null | undefined;
	/**
	 * 异步检查：返回错误文案，通过返回 `undefined`。仅在同步检查通过且值非空时发起；
	 * 值再变或卸载时 `signal` 被中止，请把它交给 `fetch`。抛出的错误（含中止）视为没有结论，
	 * 既不是错误也不是 `valid`。
	 */
	validateAsync?: (value: T, signal: AbortSignal) => Promise<string | null | undefined>;
	/** 值停手多少毫秒后发起异步检查，默认 600。 */
	asyncDelay?: number;
	/**
	 * 同步错误何时显示：`"blur"`（默认）失焦或 `touch()` 之后；`"change"` 边输入边显示，
	 * 用于复选组一类没有「失焦」的控件。
	 */
	revealOn?: "blur" | "change";
}

/** `useFieldCheck` 的返回值，直接喂给 `Field` 的 `error` / `checking`。 */
export interface UseFieldCheck {
	/** 当前应显示的错误文案；同步错误受 `revealOn` 门控，异步错误结果到达即显示。 */
	error: string | undefined;
	/** 异步检查已发出、结果未到。 */
	checking: boolean;
	/** 仅当异步检查通过且值此后没有变化时为 `true`；普通字段对了什么都不显示。 */
	valid: boolean;
	/** 把同步错误提前暴露，用于提交时一次标出全部。 */
	touch: () => void;
	/** 回到未触碰、无异步结果的初始状态。 */
	reset: () => void;
	/** 放到控件上：失焦即 `touch()`。 */
	fieldProps: { onBlur: () => void };
}

type Message = string | null | undefined;

interface Settled<T> {
	value: T;
	error: string | undefined;
}

function isEmpty(value: unknown) {
	return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

/**
 * 表单项的「检查时机」状态机：同步错误失焦后才显示并实时重算，异步检查停手后才发出。
 * 纯逻辑，不渲染、不接线；调用方把 `error`、`checking` 交给 `Field`，把 `valid` 换成成功文案。
 *
 * @typeParam T 被检查的值类型。
 * @example
 * const check = useFieldCheck({ value: email, validate: (v) => (v.includes("@") ? undefined : "缺少 @") });
 * <Field label="邮箱" error={check.error}>
 *   <Input value={email} onChange={(e) => setEmail(e.target.value)} {...check.fieldProps} />
 * </Field>
 */
export function useFieldCheck<T>({
	value,
	validate,
	validateAsync,
	asyncDelay = DEFAULT_ASYNC_DELAY,
	revealOn = "blur",
}: UseFieldCheckOptions<T>): UseFieldCheck {
	const [touched, setTouched] = useState(false);
	const [settled, setSettled] = useState<Settled<T> | null>(null);
	const [inFlight, setInFlight] = useState<{ value: T } | null>(null);
	const [seen, setSeen] = useState(value);
	const cancelRound = useRef<(() => void) | null>(null);
	// 值每变一次，已完成的结果就属于上一轮：渲染期立刻作废，不等 effect，值改回旧值也不会复活旧结果。
	if (!Object.is(seen, value)) {
		setSeen(value);
		setSettled(null);
		setInFlight(null);
	}
	const asyncRef = useRef(validateAsync);
	asyncRef.current = validateAsync;
	const hasAsync = validateAsync !== undefined;

	const syncError = validate?.(value) || undefined;
	const checkable = hasAsync && !syncError && !isEmpty(value);

	useEffect(() => {
		if (!checkable) return;
		const controller = new AbortController();
		const timer = setTimeout(() => {
			const run = asyncRef.current;
			if (!run) return;
			setInFlight({ value });
			run(value, controller.signal).then(
				(message: Message) => {
					if (controller.signal.aborted) return;
					setSettled({ value, error: message || undefined });
					setInFlight(null);
				},
				() => {
					if (!controller.signal.aborted) setInFlight(null);
				},
			);
		}, asyncDelay);
		const cancel = () => {
			clearTimeout(timer);
			controller.abort();
		};
		cancelRound.current = cancel;
		return () => {
			cancel();
			if (cancelRound.current === cancel) cancelRound.current = null;
		};
	}, [value, checkable, asyncDelay]);

	const touch = useCallback(() => setTouched(true), []);
	const reset = useCallback(() => {
		cancelRound.current?.();
		cancelRound.current = null;
		setTouched(false);
		setSettled(null);
		setInFlight(null);
	}, []);

	const current =
		checkable && settled !== null && Object.is(settled.value, value) ? settled : null;
	const revealed = revealOn === "change" || touched;
	return {
		error: (revealed ? syncError : undefined) ?? current?.error,
		checking: checkable && inFlight !== null && Object.is(inFlight.value, value),
		valid: checkable && current !== null && current.error === undefined,
		touch,
		reset,
		fieldProps: { onBlur: touch },
	};
}
