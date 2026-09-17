import type { CSSProperties, ReactNode } from "react";
import type { BubbleThemeAsset } from "../../model/appearance";
import styles from "./AppearanceBubbleSurface.module.css";
import { DecorativeImage } from "./DecorativeImage";

export interface AppearanceBubbleSurfaceProps {
	/** 本地白名单里已核对的九宫格定义。 */
	theme: BubbleThemeAsset;
	/** 保留收/发两种布局,但插画不随之镜像。 */
	mine: boolean;
	/** 既有的 Markdown/图片/时间节点;消息正文绝不烧进贴图。 */
	children: ReactNode;
}

/** 只拉伸中部与边部切片;四角花纹用独立固定尺寸盒。 */
export function AppearanceBubbleSurface({ theme, mine, children }: AppearanceBubbleSurfaceProps) {
	const style = {
		"--appearance-surface": `url("${theme.image}")`,
		"--appearance-slice": theme.slice,
		"--appearance-ink": theme.ink,
		"--appearance-fill": theme.fill,
	} as CSSProperties;
	return (
		<div
			className={styles.bubble}
			style={style}
			data-chat-bubble-theme={theme.id}
			data-side={mine ? "outgoing" : "incoming"}
		>
			{children}
			<DecorativeImage src={theme.ornament} className={styles.ornament} />
		</div>
	);
}
