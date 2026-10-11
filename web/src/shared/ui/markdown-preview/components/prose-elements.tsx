import { Checkbox } from "@violet/ui";
import type { CSSProperties } from "react";
import type { Components } from "react-markdown";
import "../../article-blocks/article-blocks.css";
import { SketchFrame } from "../../sketch-frame/SketchFrame";

function cellAlignment(
	align: string | undefined,
	style: CSSProperties | undefined,
): CSSProperties | undefined {
	if (style?.textAlign) return style;
	return align === "left" || align === "right" || align === "center" || align === "justify"
		? { textAlign: align }
		: undefined;
}

/** 保留阅读所需语义属性，不透传任意 DOM props。 */
export const proseElements: Components = {
	blockquote: ({ children, ...props }) => {
		const p = props as Record<string, unknown>;
		const type = p["data-alert-type"];
		const isAlert =
			p["data-type"] === "alert" &&
			typeof type === "string" &&
			/^(NOTE|TIP|IMPORTANT|WARNING|CAUTION)$/u.test(type);
		return isAlert ? (
			<blockquote data-type="alert" data-alert-type={type}>
				<span className="article-alert-title">{type}</span>
				{children}
			</blockquote>
		) : (
			<SketchFrame className="my-8" radius={18}>
				<blockquote className="relative rounded-2xl border-0 bg-primary/5 px-6 py-4 pl-14 text-foreground/85 before:absolute before:left-4 before:top-1 before:font-serif before:text-5xl before:leading-none before:text-primary/40 before:content-['“'] [&>p]:my-3 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
					{children}
				</blockquote>
			</SketchFrame>
		);
	},
	details: ({ children, open, id }) => (
		<details id={id} open={open} className="article-details">
			{children}
		</details>
	),
	summary: ({ children, id }) => <summary id={id}>{children}</summary>,
	ul: ({ children, ...props }) => {
		const p = props as Record<string, unknown>;
		const taskList =
			p["data-type"] === "taskList" ||
			String(p.className ?? "").includes("contains-task-list");
		return (
			<ul
				data-type={taskList ? "taskList" : undefined}
				className={
					taskList
						? "my-5 space-y-2 pl-0 list-none"
						: "my-5 list-disc space-y-2 pl-6 text-foreground/90 marker:text-primary"
				}
			>
				{children}
			</ul>
		);
	},
	ol: ({ children, start }) => (
		<ol
			start={start}
			className="my-5 list-decimal space-y-2 pl-6 text-foreground/90 marker:font-semibold marker:text-primary"
		>
			{children}
		</ol>
	),
	li: ({ children, id, value, ...props }) => {
		const p = props as Record<string, unknown>;
		const taskItem =
			p["data-type"] === "taskItem" || String(p.className ?? "").includes("task-list-item");
		return (
			<li
				id={id}
				value={value}
				data-checked={p["data-checked"] as string | undefined}
				data-footnote-label={p["data-footnote-label"] as string | undefined}
				className={taskItem ? "flex items-start gap-2" : undefined}
			>
				{children}
			</li>
		);
	},
	input: ({ type, checked }) =>
		type === "checkbox" ? (
			<Checkbox
				checked={!!checked}
				disabled
				aria-label={checked ? "已完成" : "未完成"}
				className="shrink-0 opacity-100"
			/>
		) : null,
	a: ({
		children,
		href,
		id,
		title,
		role,
		"aria-label": ariaLabel,
		"aria-describedby": ariaDescribedBy,
		...props
	}) => {
		const p = props as Record<string, unknown>;
		const external = !!href && !href.startsWith("#");
		return (
			<a
				href={href}
				id={id}
				title={title}
				role={role}
				aria-label={ariaLabel}
				aria-describedby={ariaDescribedBy}
				data-footnote-ref={p["data-footnote-ref"] as string | undefined}
				data-footnote-backref={p["data-footnote-backref"] as string | undefined}
				data-footnote-label={p["data-footnote-label"] as string | undefined}
				target={external ? "_blank" : undefined}
				rel={external ? "noopener noreferrer" : undefined}
				className="text-primary underline decoration-primary/30 decoration-2 underline-offset-4 transition-colors hover:decoration-primary"
			>
				{children}
			</a>
		);
	},
	th: ({ children, align, colSpan, rowSpan, style }) => (
		<th
			align={align}
			colSpan={colSpan}
			rowSpan={rowSpan}
			style={cellAlignment(align, style)}
			className="border-b border-dashed border-primary/30 px-4 py-2.5 text-left font-semibold whitespace-nowrap text-primary"
		>
			{children}
		</th>
	),
	td: ({ children, align, colSpan, rowSpan, style }) => (
		<td
			align={align}
			colSpan={colSpan}
			rowSpan={rowSpan}
			style={cellAlignment(align, style)}
			className="border-b border-dashed border-edge-hairline px-4 py-2.5 align-top"
		>
			{children}
		</td>
	),
};
