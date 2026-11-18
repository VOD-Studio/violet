import { iconProps } from "@violet/ui";
import { Heart } from "lucide-react";
import styles from "./affection-heart.module.css";

/**
 * 站点印记的爱心；名称、计数和交互由外层控件负责。
 *
 * @remarks `feedback` 非零且变化时重播选中反馈，初始选中不播放。
 * `pulse` 只控制爱心回弹，粒子反馈不受影响。
 */
export function AffectionHeart({
	selected,
	feedback = 0,
	pulse = true,
}: {
	selected: boolean;
	feedback?: number;
	pulse?: boolean;
}) {
	const celebrate = selected && feedback > 0;
	return (
		<span
			key={feedback}
			aria-hidden="true"
			className={styles.heart}
			data-selected={selected}
			data-pulse={celebrate && pulse}
		>
			<Heart {...iconProps(14, styles.icon)} />
			{celebrate && (
				<span className={styles.particles}>
					<i />
					<i />
					<i />
					<i />
					<i />
					<i />
				</span>
			)}
		</span>
	);
}
