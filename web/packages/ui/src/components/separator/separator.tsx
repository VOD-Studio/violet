import { cn } from "cn";
import * as React from "react";

/** 静态分隔符：不可聚焦，无需 aria-valuenow；经对象展开声明以绕开面向可聚焦 separator 的静态规则。 */
const SEPARATOR_ROLE = { role: "separator" } as const;
const VERTICAL_SEPARATOR = { role: "separator", "aria-orientation": "vertical" } as const;

/** 分隔符的属性；ref 指向实际渲染的 hr、div 或 span。 */
type SeparatorProps = Omit<React.HTMLAttributes<HTMLElement>, "role"> & {
	ref?: React.Ref<HTMLElement>;
	orientation?: "horizontal" | "vertical";
	/** 纯装饰（`role="none"`）；区块之间的分隔传 `false` 得到真实语义。带 `children` 或 `variant="dot"` 时忽略。 */
	decorative?: boolean;
	/** `dot` 为行内元信息之间的小圆点。 */
	variant?: "line" | "dot";
	/** `section` 在上下各留 32px。 */
	spacing?: "none" | "section";
};

/**
 * 分隔线、行内元信息圆点，以及带文字（如「或」）的分隔。
 *
 * 传入 `children` 时渲染「线 · 文字 · 线」，文字作为 separator 的可访问名称，此形态仅支持横向。
 */
function Separator({
	className,
	orientation = "horizontal",
	decorative = true,
	variant = "line",
	spacing = "none",
	children,
	ref,
	...props
}: SeparatorProps) {
	const labelId = React.useId();
	const common = {
		"data-slot": "separator",
		"data-orientation": orientation,
		"data-variant": variant,
		"data-spacing": spacing,
		className: cn("v-separator", className),
	};

	if (children !== undefined && children !== null && children !== false) {
		return (
			<div
				{...common}
				{...props}
				ref={ref as React.Ref<HTMLDivElement>}
				data-variant="label"
				{...SEPARATOR_ROLE}
				{...{ "aria-labelledby": labelId }}
			>
				<span className="v-separator__line" aria-hidden="true" />
				<span id={labelId} className="v-separator__label">
					{children}
				</span>
				<span className="v-separator__line" aria-hidden="true" />
			</div>
		);
	}

	if (variant === "dot") {
		return <span {...common} {...props} ref={ref as React.Ref<HTMLSpanElement>} role="none" />;
	}

	if (decorative) {
		return <div {...common} {...props} ref={ref as React.Ref<HTMLDivElement>} role="none" />;
	}

	if (orientation === "vertical") {
		return (
			<div
				{...common}
				{...props}
				ref={ref as React.Ref<HTMLDivElement>}
				{...VERTICAL_SEPARATOR}
			/>
		);
	}

	return <hr {...common} {...props} ref={ref as React.Ref<HTMLHRElement>} />;
}

export { Separator, type SeparatorProps };
