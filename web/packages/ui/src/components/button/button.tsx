"use client";

import { Slot } from "radix-ui";
import type * as React from "react";
import { Children, cloneElement, isValidElement } from "react";
import { type ButtonVariantProps, buttonVariants } from "./styles";

interface ButtonOptions extends ButtonVariantProps {
	/** 加载时禁止激活并保留正文占位；asChild 保留子元素自己的内容。 */
	loading?: boolean;
	/** 原生按钮加载时替换正文；新文案的自然宽度可能不同。 */
	loadingText?: React.ReactNode;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
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
	variant = "default",
	size = "default",
	asChild,
	loading = false,
	loadingText,
	leftIcon,
	rightIcon,
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
	const isDisabled =
		disabled || loading || props["aria-disabled"] === true || props["aria-disabled"] === "true";
	const isIconOnly = typeof size === "string" && size.startsWith("icon");
	const hasLoadingText = !isIconOnly && loading && loadingText != null;
	const hasInlineSpinner = hasLoadingText && !leftIcon;
	const classes = buttonVariants({ variant, size, className });

	if (asChild) {
		const child = Children.only(children);
		if (!isValidElement<SlottedButtonProps>(child)) {
			throw new Error("Button asChild requires one React element.");
		}

		const childDisabled =
			isDisabled ||
			child.props.disabled === true ||
			child.props["aria-disabled"] === true ||
			child.props["aria-disabled"] === "true";
		const guardClick = (event: React.MouseEvent<HTMLElement>) => {
			if (childDisabled) {
				event.preventDefault();
				event.stopPropagation();
				return true;
			}
			return false;
		};
		const guardKey = (event: React.KeyboardEvent<HTMLElement>) => {
			if (childDisabled && (event.key === "Enter" || event.key === " ")) {
				event.preventDefault();
				event.stopPropagation();
				return true;
			}
			return false;
		};

		// Slot 先执行子元素事件，因此禁用拦截必须替换子元素的捕获 handler。
		const slottedChild = cloneElement(child, {
			"aria-disabled": childDisabled || undefined,
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
				data-indicator="overlay"
				data-as-child="true"
				className={classes}
			>
				{slottedChild}
			</Slot.Root>
		);
	}

	return (
		<button
			{...props}
			ref={ref}
			type={type}
			data-slot="button"
			data-variant={variant}
			data-size={size}
			data-loading={loading ? "true" : undefined}
			data-disabled={isDisabled ? "true" : undefined}
			data-indicator={isIconOnly || leftIcon || hasInlineSpinner ? "slot" : "overlay"}
			data-loading-text={hasLoadingText ? "true" : undefined}
			aria-busy={loading || props["aria-busy"]}
			aria-disabled={isDisabled || props["aria-disabled"]}
			disabled={isDisabled}
			className={classes}
			onClickCapture={onClickCapture}
			onAuxClickCapture={onAuxClickCapture}
			onKeyDownCapture={onKeyDownCapture}
			onKeyUpCapture={onKeyUpCapture}
		>
			{isIconOnly ? (
				<span data-slot="icon" className="v-button__icon">
					<span className="v-button__icon-content">{children}</span>
					{loading && <span aria-hidden="true" className="v-button__spinner" />}
				</span>
			) : (
				<>
					{hasInlineSpinner && (
						<span
							aria-hidden="true"
							className="v-button__spinner v-button__spinner--inline"
						/>
					)}
					{leftIcon && (
						<span aria-hidden="true" data-slot="start-icon" className="v-button__icon">
							<span className="v-button__icon-content">{leftIcon}</span>
							{loading && <span className="v-button__spinner" />}
						</span>
					)}
					<span data-slot="label" className="v-button__label">
						{loading && loadingText != null ? loadingText : children}
					</span>
					{rightIcon && (
						<span
							aria-hidden="true"
							data-slot="end-icon"
							className="v-button__end-icon"
						>
							{rightIcon}
						</span>
					)}
				</>
			)}
		</button>
	);
}
