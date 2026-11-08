import {
	type MutableRefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

interface OTPOptions {
	value?: string;
	defaultValue: string;
	length: number;
	disabled: boolean;
	readOnly: boolean;
	invalid: boolean;
	onChange?: (value: string) => void;
	onComplete?: (value: string) => void;
}

export interface OTPModel {
	cells: string[];
	inputs: MutableRefObject<(HTMLInputElement | null)[]>;
	errorActive: boolean;
	focus: (index: number) => void;
	put: (index: number, text: string, wholeCode?: boolean) => void;
	erase: (index: number, backward?: boolean) => void;
}

export function digits(text: string, length: number) {
	return text.replace(/\D/g, "").slice(0, length);
}

function split(text: string, length: number) {
	return Array.from({ length }, (_, index) => text[index] ?? "");
}

export function useOTP({
	value,
	defaultValue,
	length,
	disabled,
	readOnly,
	invalid,
	onChange,
	onComplete,
}: OTPOptions): OTPModel {
	const controlled = value !== undefined;
	const externalValue = digits(value ?? "", length);
	const [snapshot, setSnapshot] = useState(() => {
		const initial = digits(value ?? defaultValue, length);
		return { value: initial, cells: split(initial, length) };
	});
	const cells =
		controlled && externalValue !== snapshot.value
			? split(externalValue, length)
			: split("", length).map((_, index) => snapshot.cells[index] ?? "");
	const inputs = useRef<(HTMLInputElement | null)[]>([]);
	const initialCells = useRef(cells);
	const state = useRef({ cells, controlled, disabled, readOnly, invalid, onChange, onComplete });
	const lastCompletion = useRef<string | undefined>(undefined);
	const pendingComplete = useRef<string | null>(null);
	const wasInvalid = useRef(false);
	const errorTimer = useRef<number | undefined>(undefined);
	const [errorActive, setErrorActive] = useState(false);
	useLayoutEffect(() => {
		state.current = { cells, controlled, disabled, readOnly, invalid, onChange, onComplete };
	});
	useLayoutEffect(() => {
		const pending = pendingComplete.current;
		if (pending === null) return;
		pendingComplete.current = null;
		if (externalValue !== pending) return;
		lastCompletion.current = pending;
		state.current.onComplete?.(pending);
	});
	useLayoutEffect(() => {
		if (controlled && externalValue !== snapshot.value) {
			setSnapshot({ value: externalValue, cells: split(externalValue, length) });
			lastCompletion.current = undefined;
		}
	}, [controlled, externalValue, length, snapshot.value]);

	const focus = useCallback((index: number) => {
		const input = inputs.current[index];
		if (!input || input.disabled) return;
		input.focus({ preventScroll: true });
		input.select();
	}, []);

	const apply = useCallback((next: string[], complete = true) => {
		const current = state.current;
		const nextValue = next.join("");
		const previousValue = current.cells.join("");
		const filled = next.every(Boolean);
		const shouldComplete =
			complete &&
			filled &&
			(nextValue !== previousValue || !current.cells.every(Boolean)) &&
			lastCompletion.current !== nextValue;
		if (!filled || !complete) lastCompletion.current = undefined;
		setSnapshot({ value: nextValue, cells: next });
		if (!current.controlled) {
			state.current = { ...current, cells: next };
			if (shouldComplete) lastCompletion.current = nextValue;
		}
		if (nextValue !== previousValue) current.onChange?.(nextValue);
		// 受控值被父层接受后才算完成；被拒绝的输入不触发验证。
		if (shouldComplete) {
			if (current.controlled) pendingComplete.current = nextValue;
			else current.onComplete?.(nextValue);
		}
	}, []);

	const put = useCallback(
		(index: number, text: string, wholeCode = false) => {
			const current = state.current;
			if (current.disabled || current.readOnly) return;
			const incoming = digits(text, length);
			if (!incoming) return;
			const start = wholeCode || incoming.length >= length ? 0 : index;
			const next = wholeCode ? split("", length) : current.cells.slice();
			let end = start;
			for (const digit of incoming) {
				if (end >= length) break;
				next[end++] = digit;
			}
			apply(next);
			focus(Math.min(end, length - 1));
		},
		[apply, focus, length],
	);

	const erase = useCallback(
		(index: number, backward = false) => {
			const current = state.current;
			if (current.disabled || current.readOnly) return;
			const next = current.cells.slice();
			if (backward && !next[index] && index > 0) next[index - 1] = "";
			else next[index] = "";
			apply(next);
			if (backward) focus(Math.max(0, index - 1));
		},
		[apply, focus],
	);

	useEffect(() => {
		const locked = disabled || readOnly;
		const rising = invalid && !locked && !wasInvalid.current;
		// 已播放过的错误在锁定切换时不重播；锁定期间才到达的错误边沿留到解锁后播放。
		if (!invalid) wasInvalid.current = false;
		else if (!locked) wasInvalid.current = true;
		if (!invalid || locked) {
			clearTimeout(errorTimer.current);
			setErrorActive(false);
			return;
		}
		if (!rising) return;
		const reduced = inputs.current[0]?.ownerDocument.defaultView?.matchMedia?.(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const finish = () => {
			errorTimer.current = undefined;
			setErrorActive(false);
			const current = state.current;
			if (!current.invalid || current.disabled || current.readOnly) return;
			apply(split("", current.cells.length), false);
			focus(0);
		};
		setErrorActive(true);
		if (reduced) finish();
		else errorTimer.current = window.setTimeout(finish, 500);
	}, [apply, disabled, focus, invalid, readOnly]);

	useEffect(
		() => () => {
			clearTimeout(errorTimer.current);
			wasInvalid.current = false;
		},
		[],
	);

	useEffect(() => {
		const control = inputs.current[0];
		if (!control) return;
		const scopes = new Set<EventTarget>([control.ownerDocument, control.getRootNode()]);
		const pending = new WeakSet<Event>();
		let active = true;
		const reset = (event: Event) => {
			const form = inputs.current[0]?.form;
			if (!form || event.target !== form || pending.has(event)) return;
			pending.add(event);
			const finish = () => {
				if (active && event.eventPhase !== Event.NONE) {
					setTimeout(finish, 0);
					return;
				}
				pending.delete(event);
				if (!active || event.defaultPrevented || inputs.current[0]?.form !== form) return;
				clearTimeout(errorTimer.current);
				setErrorActive(false);
				apply(initialCells.current.slice(), false);
				if (state.current.controlled) {
					inputs.current.forEach((input, index) => {
						if (input) input.value = state.current.cells[index] ?? "";
					});
				}
			};
			queueMicrotask(finish);
		};
		for (const scope of scopes) scope.addEventListener("reset", reset, true);
		return () => {
			active = false;
			for (const scope of scopes) scope.removeEventListener("reset", reset, true);
		};
	}, [apply]);

	return { cells, inputs, errorActive, focus, put, erase };
}
