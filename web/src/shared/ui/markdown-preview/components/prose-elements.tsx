import { Checkbox } from "@violet/ui";
import type { CSSProperties } from "react";
import type { Components } from "react-markdown";
import "../../article-blocks/article-blocks.css";

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
			<blockquote className="my-6 border-l-4 border-primary/50 bg-muted/40 py-2 pl-5 text-foreground/80">
				{children}
			</blockquote>
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
						: "my-5 list-disc space-y-2 pl-6 text-foreground/90"
				}
			>
				{children}
			</ul>
		);
	},
	ol: ({ children, start }) => (
		<ol start={start} className="my-5 list-decimal space-y-2 pl-6 text-foreground/90">
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
				className="text-primary underline underline-offset-2 transition-opacity hover:opacity-80"
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
			className="border border-edge-hairline px-3 py-2 text-left font-semibold"
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
			className="border border-edge-hairline px-3 py-2"
		>
			{children}
		</td>
	),
};
