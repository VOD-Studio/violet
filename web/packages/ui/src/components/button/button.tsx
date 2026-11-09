"use client";

import { Slot } from "radix-ui";
import type * as React from "react";
import { Children, cloneElement, isValidElement, useEffect, useState } from "react";
import { Spinner } from "../indicator";
import { type ButtonVariantProps, buttonVariants } from "./styles";

/** 结果文案的默认展示时长。 */
const DONE_DURATION = 1600;

interface ButtonOptions extends ButtonVariantProps {
	/** 加载：aria-busy、仍可聚焦、点击被忽略；指示器盖在内容中央，宽度不变。asChild 保留子元素自己的内容。 */
	loading?: boolean;
	/** 加载时替换正文；宽度跟随新文案，仅在非 iconOnly 时生效。 */
	loadingText?: React.ReactNode;
	/** 完成后的结果文案（如「已保存」）：短暂替换正文后回到 children，供表单保存反馈用。 */
	done?: React.ReactNode;
	/** 结果文案展示时长。@default 1600 */
	doneDuration?: number;
	/** 前置图标表示动作；加载时被指示器在原位置替换。 */
	leftIcon?: React.ReactNode;
	/** 后置箭头表示展开或跳转；加载时移出。 */
	rightIcon?: React.ReactNode;
	/** 正圆形纯图标按钮；必须有可读名称（aria-label）。 */
	iconOnly?: boolean;
}

interface NativeButtonProps extends React.ComponentProps<"button">, ButtonOptions {
	asChild?: false;
}

interface AsChildButtonProps extends React.HTMLAttributes<HTMLElement>, ButtonOptions {
	/** 将属性与 ref 合并到唯一子元素；自定义组件必须透传属性与 ref。 */
	asChild: true;
	ref?: React.Ref<HTMLElement>;
	disabled?: boolean;
	type?: "button" | "submit" | "reset";
}

/**
 * 原生模式的 ref 与事件指向 button；asChild 模式指向子元素，公开 HTMLElement 契约。
 */
export type ButtonProps = NativeButtonProps | AsChildButtonProps;

type SlottedButtonProps = React.HTMLAttributes<HTMLElement> & {
	disabled?: boolean;
	type?: "button" | "submit" | "reset";
};

/**
 * 动作按钮默认 type="button"；纯图标用法由消费方提供 aria-label。
 */
export function Button({
	className,
	variant = "secondary",
	size = "md",
	asChild,
	loading = false,
	loadingText,
	done,
	doneDuration = DONE_DURATION,
	leftIcon,
	rightIcon,
	iconOnly = false,
	disabled = false,
	type = "button",
	children,
	ref,
	onClickCapture,
	onAuxClickCapture,
	onKeyDownCapture,
	onKeyUpCapture,
	...props
}: ButtonProps) {
	// done 展示期间点击仍然有效，只有 loading 忽略点击
	const showDone = !loading && done != null;
	const label = showDone ? done : loading && loadingText != null ? loadingText : children;
	// 设计稿：加载不算禁用，仍可聚焦；点击与键盘激活由 aria-disabled 的语义加上激活守卫忽略
	const isDisabled =
		disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true";
	const classes = buttonVariants({ variant, size, className });

	if (asChild) {
		const child = Children.only(children);
		if (!isValidElement<SlottedButtonProps>(child)) {
			throw new Error("Button asChild requires one React element.");
		}

		// 设计稿：加载不算禁用——子元素保持可聚焦，标记 aria-disabled/aria-busy，激活由守卫忽略
		const childUnavailable = loading || isDisabled;
		const childDisabled = !loading && isDisabled;
		const childAriaDisabled =
			childUnavailable ||
			child.props["aria-disabled"] === true ||
			child.props["aria-disabled"] === "true";
		const guardClick = (event: React.MouseEvent<HTMLElement>) => {
			if (childUnavailable) {
				event.preventDefault();
				event.stopPropagation();
				return true;
			}
			return false;
		};
		const guardKey = (event: React.KeyboardEvent<HTMLElement>) => {
			if (childUnavailable && (event.key === "Enter" || event.key === " ")) {
				event.preventDefault();
				event.stopPropagation();
				return true;
			}
			return false;
		};

		// Slot 先执行子元素事件，因此禁用拦截必须替换子元素的捕获 handler。
		const originalChildren = child.props.children;
		const slottedChildren = loading ? (
			<>
				{originalChildren}
				<span aria-hidden="true" className="v-button__overlay">
					<Spinner size={16} />
				</span>
			</>
		) : (
			originalChildren
		);
		const slottedChild = cloneElement(child, {
			"aria-disabled": childAriaDisabled || undefined,
			"aria-busy": loading || props["aria-busy"] || child.props["aria-busy"],
			tabIndex: childDisabled ? -1 : (child.props.tabIndex ?? props.tabIndex),
			...(child.type === "button"
				? { disabled: childDisabled, type: child.props.type ?? type }
				: {}),
			onClickCapture: (event) => {
				if (guardClick(event)) return;
				child.props.onClickCapture?.(event);
				onClickCapture?.(event);
			},
			onAuxClickCapture: (event) => {
				if (guardClick(event)) return;
				child.props.onAuxClickCapture?.(event);
				onAuxClickCapture?.(event);
			},
			onKeyDownCapture: (event) => {
				if (guardKey(event)) return;
				child.props.onKeyDownCapture?.(event);
				onKeyDownCapture?.(event);
			},
			onKeyUpCapture: (event) => {
				if (guardKey(event)) return;
				child.props.onKeyUpCapture?.(event);
				onKeyUpCapture?.(event);
			},
			children: slottedChildren,
		});
		return (
			<Slot.Root
				{...props}
				ref={ref}
				data-slot="button"
				data-variant={variant}
				data-size={size}
				data-loading={loading ? "true" : undefined}
				data-disabled={childDisabled ? "true" : undefined}
				data-as-child="true"
				className={classes}
			>
				{slottedChild}
			</Slot.Root>
		);
	}

	return (
		<NativeButton
			{...props}
			ref={ref}
			type={type}
			data-slot="button"
			data-variant={variant}
			data-size={size}
			data-loading={loading ? "true" : undefined}
			data-done={showDone ? "true" : undefined}
			data-icon-only={iconOnly ? "true" : undefined}
			data-disabled={isDisabled ? "true" : undefined}
			aria-busy={loading || props["aria-busy"]}
			aria-disabled={isDisabled || loading || props["aria-disabled"]}
			disabled={isDisabled}
			className={classes}
			onClickCapture={onClickCapture}
			onAuxClickCapture={onAuxClickCapture}
			onKeyDownCapture={onKeyDownCapture}
			onKeyUpCapture={onKeyUpCapture}
			label={label}
			leftIcon={leftIcon}
			rightIcon={rightIcon}
			loading={loading}
			iconOnly={iconOnly}
			showDone={showDone}
			doneDuration={doneDuration}
		>
			{children}
		</NativeButton>
	);
}

interface NativeButtonInternalProps extends Omit<React.ComponentProps<"button">, "children"> {
	label: React.ReactNode;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
	loading: boolean;
	iconOnly: boolean;
	showDone: boolean;
	doneDuration: number;
	children?: React.ReactNode;
}

/**
 * 结果文案的展示计时归内部按钮：loading 与 done 交替更新时定时器重新起算；
 * 回落只翻内部状态，不回调调用方，调用方的状态机由它自己的异步流程收尾。
 */
function NativeButton({
	label,
	leftIcon,
	rightIcon,
	loading,
	iconOnly,
	showDone,
	doneDuration,
	children,
	...props
}: NativeButtonInternalProps) {
	const [settled, setSettled] = useState(false);
	useEffect(() => {
		if (!showDone) {
			setSettled(false);
			return;
		}
		const timer = window.setTimeout(() => setSettled(true), doneDuration);
		return () => window.clearTimeout(timer);
	}, [showDone, doneDuration]);
	const settledDone = showDone && settled;
	const hasOverlay = loading && (iconOnly || !leftIcon);
	const visibleLabel = settledDone ? children : label;
	// 加载时激活被忽略：aria-disabled 挡住原生 click 与键盘激活（jsdom 与真实浏览器一致）
	const guard = (event: React.SyntheticEvent) => {
		if (!loading) return;
		event.preventDefault();
		event.stopPropagation();
	};
	return (
		<button
			{...props}
			data-done={showDone ? "true" : undefined}
			data-settled={settledDone ? "true" : undefined}
			onClick={loading ? guard : props.onClick}
			onDoubleClick={loading ? guard : props.onDoubleClick}
			onMouseDown={loading ? guard : props.onMouseDown}
			onMouseUp={loading ? guard : props.onMouseUp}
			onTouchStart={loading ? guard : props.onTouchStart}
			onTouchEnd={loading ? guard : props.onTouchEnd}
			onKeyDown={loading ? guard : props.onKeyDown}
			onKeyUp={loading ? guard : props.onKeyUp}
		>
			{iconOnly ? (
				<span data-slot="icon" className="v-button__icon">
					<span className="v-button__icon-content">{children}</span>
					{hasOverlay && (
						<span aria-hidden="true" className="v-button__overlay">
							<Spinner size={16} />
						</span>
					)}
				</span>
			) : (
				<>
					{leftIcon && (
						<span aria-hidden="true" data-slot="start-icon" className="v-button__icon">
							<span className="v-button__icon-content">{leftIcon}</span>
							{loading && (
								<span aria-hidden="true" className="v-button__overlay">
									<Spinner size={16} />
								</span>
							)}
						</span>
					)}
					{showDone && (
						<span aria-hidden="true" data-slot="done-icon" className="v-button__done-icon">
							<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
								<path d="m5 12.5 4.5 4.5L19 7.5" />
							</svg>
						</span>
					)}
					<span data-slot="label" className="v-button__label">
						{visibleLabel}
					</span>
					{rightIcon && !loading && (
						<span
							aria-hidden="true"
							data-slot="end-icon"
							className="v-button__end-icon"
						>
							{rightIcon}
						</span>
					)}
					{hasOverlay && (
						<span aria-hidden="true" className="v-button__overlay">
							<Spinner size={16} />
						</span>
					)}
				</>
			)}
		</button>
	);
}
