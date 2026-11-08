import {
	type ChangeEvent,
	type ClipboardEvent,
	type FocusEvent,
	type KeyboardEvent,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { NumberInputProps } from "./number-input";
import {
	cleanNumberPaste,
	formatNumber,
	type NumberRules,
	normalizeDraft,
	normalizeNumber,
	parseNumber,
	stepNumber,
	toText,
} from "./number-value";

interface NumberInputState {
	inputRef: RefObject<HTMLInputElement | null>;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onFocus: (event: FocusEvent<HTMLInputElement>) => void;
	onBlur: (event: FocusEvent<HTMLInputElement>) => void;
	onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
	onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
	step: (direction: number) => void;
	parsed: number | null;
	outOfRange: boolean;
	defaultText: string | undefined;
}

export function useNumberInput(props: NumberInputProps, rules: NumberRules): NumberInputState {
	const inputRef = useRef<HTMLInputElement>(null);
	const initialText = toText(props.value ?? props.defaultValue);
	const initialNumber = parseNumber(initialText);
	const initial =
		initialNumber === null
			? rules.allowEmpty
				? null
				: normalizeNumber(rules.min ?? 0, rules)
			: normalizeNumber(initialNumber, rules);
	const [text, setText] = useState(initialText);
	const committed = useRef<number | null>(initial);
	const previousControlled = useRef(props.value);
	const lastDraft = useRef<string | undefined>(undefined);
	const pendingCommit = useRef<string | null>(null);
	const committing = useRef(false);
	const latest = useRef({ props, rules });
	latest.current = { props, rules };

	useLayoutEffect(() => {
		if (props.value !== undefined && props.value !== previousControlled.current) {
			const next = toText(props.value);
			if (pendingCommit.current === next || next !== lastDraft.current) {
				committed.current = normalizeDraft(next, committed.current, rules);
			}
			pendingCommit.current = null;
			previousControlled.current = props.value;
		}
		if (inputRef.current && inputRef.current.value !== text) {
			setText(inputRef.current.value);
		}
	});

	useEffect(() => {
		const input = inputRef.current;
		if (!input) return;
		const scopes = new Set([input.ownerDocument, input.getRootNode()]);
		let active = true;
		const pending = new WeakSet<Event>();
		const reset = (event: Event) => {
			const form = input.form;
			if (!form || event.target !== form || pending.has(event)) return;
			pending.add(event);
			const finish = () => {
				if (!active) return;
				if (event.eventPhase !== Event.NONE) {
					setTimeout(finish, 0);
					return;
				}
				pending.delete(event);
				if (event.defaultPrevented || input.form !== form) return;
				const { props: current, rules: currentRules } = latest.current;
				if (current.value !== undefined) input.value = toText(current.value);
				setText(input.value);
				committed.current = normalizeDraft(input.value, null, currentRules);
			};
			queueMicrotask(finish);
		};
		for (const scope of scopes) scope.addEventListener("reset", reset, true);
		return () => {
			active = false;
			for (const scope of scopes) scope.removeEventListener("reset", reset, true);
		};
	}, []);

	const write = (next: string) => {
		const input = inputRef.current;
		const view = input?.ownerDocument.defaultView;
		if (!input || !view || input.value === next) return;
		// 绕过 React value tracker，让规范化与步进走真实的 input / onChange 链。
		Object.getOwnPropertyDescriptor(view.HTMLInputElement.prototype, "value")?.set?.call(
			input,
			next,
		);
		input.dispatchEvent(new view.Event("input", { bubbles: true, composed: true }));
		setText(input.value);
	};

	const commit = (
		next = normalizeDraft(inputRef.current?.value ?? text, committed.current, rules),
	) => {
		const previous = committed.current;
		const text = formatNumber(next, rules.precision);
		const controlled = latest.current.props.value !== undefined;
		if (controlled && inputRef.current && inputRef.current.value !== text) {
			pendingCommit.current = text;
		} else {
			committed.current = next;
		}
		committing.current = true;
		try {
			write(text);
		} finally {
			committing.current = false;
		}
		if (next !== previous) props.onValueCommit?.(next);
	};

	const step = (direction: number) => {
		const input = inputRef.current;
		if (!input || input.disabled || input.readOnly) return;
		commit(stepNumber(input.value, direction, rules));
	};

	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		lastDraft.current = event.currentTarget.value;
		if (!committing.current) pendingCommit.current = null;
		setText(event.currentTarget.value);
		props.onChange?.(event);
	};
	const onFocus = (event: FocusEvent<HTMLInputElement>) => {
		props.onFocus?.(event);
		if (event.defaultPrevented) return;
		const current = parseNumber(event.currentTarget.value);
		if (
			current !== null &&
			(rules.min === undefined || current >= rules.min) &&
			(rules.max === undefined || current <= rules.max)
		)
			committed.current = normalizeNumber(current, rules);
		event.currentTarget.select();
	};
	const onBlur = (event: FocusEvent<HTMLInputElement>) => {
		// register().onBlur 必须观察规范化后的 DOM 值。
		if (!props.readOnly && !props.disabled) commit();
		props.onBlur?.(event);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		props.onKeyDown?.(event);
		if (
			event.defaultPrevented ||
			event.nativeEvent.isComposing ||
			props.readOnly ||
			props.disabled
		)
			return;
		if (event.key === "ArrowUp" || event.key === "ArrowDown") {
			event.preventDefault();
			step((event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 10 : 1));
		} else if (event.key === "Enter") {
			commit();
		} else if (event.key === "Escape") {
			event.preventDefault();
			write(formatNumber(committed.current, rules.precision));
		}
	};
	const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
		props.onPaste?.(event);
		if (event.defaultPrevented || props.readOnly || props.disabled) return;
		event.preventDefault();
		const clean = cleanNumberPaste(event.clipboardData.getData("text"));
		if (clean === null) return;
		const input = event.currentTarget;
		const start = input.selectionStart ?? 0;
		const end = input.selectionEnd ?? input.value.length;
		const next = input.value.slice(0, start) + clean + input.value.slice(end);
		if (parseNumber(next) === null) return;
		write(next);
		input.setSelectionRange(start + clean.length, start + clean.length);
	};

	const parsed = parseNumber(text);
	return {
		inputRef,
		onChange,
		onFocus,
		onBlur,
		onKeyDown,
		onPaste,
		step,
		parsed,
		outOfRange:
			parsed !== null &&
			((rules.min !== undefined && parsed < rules.min) ||
				(rules.max !== undefined && parsed > rules.max)),
		defaultText:
			props.defaultValue === undefined
				? undefined
				: initialNumber === null
					? initialText
					: formatNumber(initialNumber, rules.precision),
	};
}
