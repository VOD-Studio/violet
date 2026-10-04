"use client";

import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import {
	type ComponentProps,
	type FocusEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { type CheckboxVariantProps, checkboxVariants } from "./styles";

/**
 * checked 由调用方持有，defaultChecked 提供非受控初值；ref 指向可聚焦的 button。
 *
 * @remarks 指示器由组件维护，可访问名称使用关联 Label 或 aria-label。
 */
export interface CheckboxProps
	extends Omit<ComponentProps<typeof CheckboxPrimitive.Root>, "children" | "asChild" | "type">,
		CheckboxVariantProps {}

/** 保留三态选择、事件取消和原生表单提交行为的复选框。 */
export function Checkbox({
	className,
	form,
	checked,
	defaultChecked = false,
	onCheckedChange,
	onClick,
	variant = "default",
	size = "default",
	...props
}: CheckboxProps) {
	const buttonRef = useRef<HTMLButtonElement>(null);
	const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);
	const currentChecked = checked ?? uncontrolledChecked;
	const initialChecked = useRef(currentChecked);
	const activationRef = useRef<Event | null>(null);
	const stateRef = useRef({
		value: currentChecked,
		controlled: checked !== undefined,
		onCheckedChange,
	});
	useLayoutEffect(() => {
		stateRef.current = {
			value: currentChecked,
			controlled: checked !== undefined,
			onCheckedChange,
		};
	}, [checked, currentChecked, onCheckedChange]);
	const applyChecked = useCallback((next: typeof currentChecked) => {
		const state = stateRef.current;
		if (state.value === next) return;
		if (!state.controlled) {
			stateRef.current = { ...state, value: next };
			setUncontrolledChecked(next);
		}
		state.onCheckedChange?.(next);
	}, []);

	useEffect(() => {
		const control = buttonRef.current;
		if (!control) return;
		const scopes = new Set<EventTarget>([control.ownerDocument, control.getRootNode()]);
		const pendingResets = new WeakSet<Event>();
		let active = true;
		const captureReset = (event: Event) => {
			const owner = buttonRef.current?.form;
			if (!owner || event.target !== owner || pendingResets.has(event)) return;
			pendingResets.add(event);
			const finishReset = () => {
				// 原生按钮的默认动作可能在事件传播中执行微任务。
				if (active && event.eventPhase !== Event.NONE) {
					setTimeout(finishReset, 0);
					return;
				}
				pendingResets.delete(event);
				if (active && !event.defaultPrevented && buttonRef.current?.form === owner) {
					applyChecked(initialChecked.current);
				}
			};
			queueMicrotask(finishReset);
		};
		for (const scope of scopes) scope.addEventListener("reset", captureReset, true);
		return () => {
			active = false;
			for (const scope of scopes) scope.removeEventListener("reset", captureReset, true);
		};
	}, [applyChecked]);

	const changeChecked = (next: typeof currentChecked) => {
		const activation = activationRef.current;
		activationRef.current = null;
		// 忽略 Root 从旧表单监听发出的 reset 请求，包括已移除的表单。
		if (activation) {
			const state = stateRef.current;
			const requested = state.controlled
				? next
				: state.value === "indeterminate" || !state.value;
			applyChecked(requested);
		}
	};
	const focusVisibleControl = (event: FocusEvent<HTMLSpanElement>) => {
		const target = event.target;
		if (target.matches('input[type="checkbox"][aria-hidden="true"]')) {
			event.stopPropagation();
			buttonRef.current?.focus();
		}
	};

	return (
		<span className="v-checkbox__wrapper" onFocusCapture={focusVisibleControl}>
			<CheckboxPrimitive.Root
				data-slot="checkbox"
				data-variant={variant}
				data-size={size}
				className={checkboxVariants({ variant, size, className })}
				{...props}
				form={form}
				checked={currentChecked}
				defaultChecked={checked === undefined ? initialChecked.current : currentChecked}
				onCheckedChange={changeChecked}
				onClick={(event) => {
					onClick?.(event);
					if (event.defaultPrevented) return;
					const activation = event.nativeEvent;
					activationRef.current = activation;
					queueMicrotask(() => {
						if (activationRef.current === activation) activationRef.current = null;
					});
				}}
				type="button"
				asChild
			>
				<button ref={buttonRef} type="button" form={form}>
					<CheckboxPrimitive.Indicator
						data-slot="checkbox-indicator"
						className="v-checkbox__indicator"
					>
						<Check
							aria-hidden="true"
							className="v-checkbox__icon v-checkbox__icon--checked"
						/>
						<Minus
							aria-hidden="true"
							className="v-checkbox__icon v-checkbox__icon--indeterminate"
						/>
					</CheckboxPrimitive.Indicator>
				</button>
			</CheckboxPrimitive.Root>
		</span>
	);
}
