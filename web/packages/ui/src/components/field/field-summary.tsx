"use client";

import { cn } from "cn";
import { CircleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { focusField } from "./focus-field";

/** 汇总里的一条：`id` 是控件的 id，`label` 只写字段名，不写错误原因。 */
export interface FieldSummaryItem {
	id: string;
	label: ReactNode;
}

/** 提交汇总属性。 */
export interface FieldSummaryProps extends Omit<ComponentProps<"div">, "title" | "children"> {
	/** 有错误的字段；为空时整个汇总不渲染。 */
	errors: FieldSummaryItem[];
	/** 标题，默认「还有 {n} 处需要修改」。 */
	title?: (count: number) => ReactNode;
}

const defaultTitle = (count: number) => `还有 ${count} 处需要修改`;

/**
 * 提交时一次标出全部错误：放在表单最上面，每一条是按钮，点了把焦点移到对应控件。
 * 提交失败后由调用方把焦点先移到第一个错误的控件（`focusField`），汇总自己带 `role="alert"` 负责播报。
 *
 * @example
 * <FieldSummary errors={[{ id: "title", label: "标题" }]} />
 */
export function FieldSummary({
	errors,
	title = defaultTitle,
	className,
	...props
}: FieldSummaryProps) {
	if (errors.length === 0) return null;
	return (
		<div role="alert" tabIndex={-1} {...props} className={cn("v-field-summary", className)}>
			<CircleAlert className="v-field-summary__icon" size={16} aria-hidden="true" />
			<div className="v-field-summary__body">
				<b className="v-field-summary__title">{title(errors.length)}</b>
				<ul className="v-field-summary__list">
					{errors.map((item) => (
						<li key={item.id}>
							<button
								type="button"
								className="v-field-summary__item"
								onClick={() => focusField(item.id)}
							>
								{item.label}
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
