import { useLivePresence } from "@features/presence";
import { SeasonBackdrop } from "@features/seasonal-decor/ui/SeasonBackdrop";
import { WindowBackdrop } from "@features/window-backdrop";

import styles from "./SiteBackdrop.module.css";

/**
 * 前台固定背景：站长那边的窗，叠上季节装饰。
 *
 * @param dense - 阅读页：雾更浓，水珠避开正文栏
 * @remarks 须挂在建立层叠上下文（isolate）的前台壳层内：负 z-index 让它位于壳层画布之上、
 * 页面内容之下；不透明的卡片与页脚自然遮住它。
 */
export default function SiteBackdrop({ dense }: { dense: boolean }) {
	const { lead } = useLivePresence();
	const media = lead?.sources.media;
	const listening =
		media?.state === "playing"
			? `正在听《${media.title}》${media.artist ? ` · ${media.artist}` : ""}`
			: null;

	return (
		<div aria-hidden className={styles.backdrop}>
			<WindowBackdrop dense={dense} listening={listening} />
			<SeasonBackdrop />
		</div>
	);
}
