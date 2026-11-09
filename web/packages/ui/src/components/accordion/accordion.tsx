"use client";

import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import { useControllableState } from "radix-ui/internal";
import {
	type ComponentProps,
	createContext,
	createElement,
	type ReactNode,
	use,
	useId,
	useMemo,
} from "react";

/** 标题的 h 级别；默认 3，按所在页面的大纲调整。 */
export type AccordionHeadingLevel = 2 | 3 | 4 | 5 | 6;

interface AccordionBaseProps extends Omit<ComponentProps<"div">, "defaultValue" | "onChange"> {
	headingLevel?: AccordionHeadingLevel;
}

/** 可同时展开多项：值是展开项 `value` 的数组，按展开先后排列。 */
export interface AccordionMultipleProps extends AccordionBaseProps {
	type?: "multiple";
	value?: string[];
	defaultValue?: string[];
	onValueChange?: (value: string[]) => void;
}

/** 一次一项：值是展开项的 `value`，空串表示全部收起；再点已展开的一项可收起。 */
export interface AccordionSingleProps extends AccordionBaseProps {
	type: "single";
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
}

export type AccordionProps = AccordionMultipleProps | AccordionSingleProps;

/** 折叠项：标题行、摘要与内容。必须放在 `Accordion` 里。 */
export interface AccordionItemProps extends Omit<ComponentProps<"div">, "title"> {
	/** 项的标识，在同一个 `Accordion` 内唯一。 */
	value: string;
	/** 标题行文字，也是按钮的名称。 */
	title: ReactNode;
	/** 收起时显示在标题右侧的当前值，展开后隐藏；同时成为按钮名称的一部分。 */
	summary?: ReactNode;
	/** 禁用后标题按钮不可点、不在 Tab 顺序里。 */
	disabled?: boolean;
}

interface AccordionContextValue {
	headingLevel: AccordionHeadingLevel;
	isOpen: (value: string) => boolean;
	toggle: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

/**
 * 折叠面板：点标题展开或收起内容，常见问题、设置分组。
 *
 * @example
 * ```tsx
 * <Accordion type="single" defaultValue="publish">
 *   <AccordionItem value="publish" title="发布设置" summary="立即发布">…</AccordionItem>
 * </Accordion>
 * ```
 */
export function Accordion({
	type,
	value,
	defaultValue,
	onValueChange,
	headingLevel = 3,
	className,
	...props
}: AccordionProps) {
	const single = type === "single";

	// 两种形态内部都用数组，单选的空串对应空数组
	const [openValues, setOpenValues] = useControllableState<string[]>({
		prop: type === "single" ? toList(value) : value,
		defaultProp: (type === "single" ? toList(defaultValue) : defaultValue) ?? [],
		onChange: (next) => {
			if (type === "single") onValueChange?.(next[0] ?? "");
			else onValueChange?.(next);
		},
	});

	const context = useMemo<AccordionContextValue>(
		() => ({
			headingLevel,
			isOpen: (itemValue) => openValues.includes(itemValue),
			toggle: (itemValue) => {
				if (openValues.includes(itemValue))
					setOpenValues(openValues.filter((v) => v !== itemValue));
				else setOpenValues(single ? [itemValue] : [...openValues, itemValue]);
			},
		}),
		[headingLevel, openValues, setOpenValues, single],
	);

	return (
		<AccordionContext value={context}>
			<div data-slot="accordion" {...props} className={cn("v-accordion", className)} />
		</AccordionContext>
	);
}

/** 标题是 `heading` 里的原生 `button`；内容常驻 DOM，收起时 `inert`。 */
export function AccordionItem({
	value,
	title,
	summary,
	disabled,
	className,
	children,
	...props
}: AccordionItemProps) {
	const context = use(AccordionContext);
	const id = useId();
	if (!context) throw new Error("AccordionItem 必须放在 Accordion 里");

	const open = context.isOpen(value);
	const triggerId = `${id}-trigger`;
	const panelId = `${id}-panel`;

	return (
		<div
			data-slot="accordion-item"
			data-state={open ? "open" : "closed"}
			data-disabled={disabled ? "" : undefined}
			{...props}
			className={cn("v-accordion__item", className)}
		>
			{createElement(
				`h${context.headingLevel}`,
				{ className: "v-accordion__heading" },
				<button
					id={triggerId}
					type="button"
					className="v-accordion__trigger"
					aria-expanded={open}
					aria-controls={panelId}
					disabled={disabled}
					onClick={() => context.toggle(value)}
				>
					<span className="v-accordion__title">{title}</span>
					{summary != null && !open ? (
						<span className="v-accordion__summary">{summary}</span>
					) : null}
					<ChevronDown
						className="v-accordion__chevron"
						aria-hidden="true"
						focusable="false"
					/>
				</button>,
			)}
			<div
				id={panelId}
				role="region"
				aria-labelledby={triggerId}
				className="v-accordion__panel"
				inert={!open}
			>
				<div className="v-accordion__clip">
					<div className="v-accordion__body">{children}</div>
				</div>
			</div>
		</div>
	);
}

function toList(value: string | undefined): string[] | undefined {
	if (value === undefined) return undefined;
	return value === "" ? [] : [value];
}
