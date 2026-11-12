"use client";

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
					{/* 对勾是一笔描出来的：pathLength 归一后由 data-state 驱动描线与擦回，不随状态重挂 */}
					<svg className="v-checkbox__tick" viewBox="0 0 16 16" aria-hidden="true">
						<path
							className="v-checkbox__tick-path"
							d="M3.6 8.3 6.6 11.2 12.4 4.9"
							pathLength={1}
						/>
					</svg>
					<span className="v-checkbox__dash" aria-hidden="true" />
				</button>
			</CheckboxPrimitive.Root>
		</span>
	);
}
