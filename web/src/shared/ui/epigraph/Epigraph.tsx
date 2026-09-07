import { cn } from "@shared/lib/utils";
import { Signature } from "@shared/ui/signature";
import type { HTMLAttributes } from "react";

import styles from "./Epigraph.module.css";

export interface EpigraphProps extends HTMLAttributes<HTMLElement> {
	/** 英文或外文原文引语 */
	quote: string;
	/** 中文译文（可选） */
	translation?: string;
	/** 作者名字（如 "Alan Turing"） */
	author?: string;
	/** 是否以手写动态签名呈现作者名字，默认 true */
	signature?: boolean;
	/** 签名特定名字（未指定时优先使用 author） */
	signatureName?: string;
	/** 视觉风格变体：'accent-line' (左侧淡雅主色细线，默认) | 'borderless' (无边框) | 'card' (卡片) */
	variant?: "accent-line" | "borderless" | "card";
	/** 署名对齐方式：'end' (靠右落款，默认) | 'start' (靠左) | 'center' (居中) */
	captionAlign?: "start" | "end" | "center";
}

/**
 * Epigraph: 典雅卷首引言 / 箴言公共组件
 *
 * 适用于首页序章、长文卷首、关于页等场景。
 * 遵循数据与样式分离，优雅呈现外文原文、中文直角译文与作者手写签名落款。
 */
export function Epigraph({
	quote,
	translation,
	author,
	signature = true,
	signatureName,
	variant = "accent-line",
	captionAlign = "end",
	className,
	...props
}: EpigraphProps) {
	const variantClass =
		variant === "borderless"
			? styles.borderless
			: variant === "card"
				? styles.card
				: styles.accentLine;

	const alignStyle =
		captionAlign === "start" ? "flex-start" : captionAlign === "center" ? "center" : "flex-end";

	const resolvedSignatureName = signatureName || author;

	return (
		<figure
			className={cn(styles.root, variantClass, className)}
			aria-label="卷首引言"
			{...props}
		>
			<blockquote className={styles.content}>
				{/* 原文 */}
				<p className={styles.quote}>“{quote}”</p>

				{/* 译文 */}
				{translation ? <p className={styles.translation}>{translation}</p> : null}
			</blockquote>

			{/* 署名落款 */}
			{author || resolvedSignatureName ? (
				<figcaption className={styles.caption} style={{ justifyContent: alignStyle }}>
					<span className={styles.dash}>—</span>
					{signature && resolvedSignatureName ? (
						<Signature name={resolvedSignatureName} size="sm" variant="muted" />
					) : (
						<span className={styles.authorText}>{author}</span>
					)}
				</figcaption>
			) : null}
		</figure>
	);
}
