import type { CSSProperties, ReactNode } from "react";
import { CHARM_BY_ID, FRAME_BY_ID } from "../../model/appearance-catalog";
import styles from "./AvatarDecoration.module.css";
import { DecorativeImage } from "./DecorativeImage";

export interface AvatarDecorationProps {
	/** 圆形头像框 ID;空串或未知 ID 不叠加任何覆盖层。 */
	frameId: string;
	/** 右下角挂件的独立 ID。 */
	charmId: string;
	/** 既有的头像/字母兜底节点,保留原尺寸类。 */
	children: ReactNode;
}

/** 可点击/个人页/头像区域保持原样;只有透明装饰延伸到区域之外。 */
export function AvatarDecoration({ frameId, charmId, children }: AvatarDecorationProps) {
	const frame = FRAME_BY_ID.get(frameId);
	const charm = CHARM_BY_ID.get(charmId);
	if (!frame && !charm) return children;
	const style = { "--avatar-frame-scale": frame?.scale ?? 1.35 } as CSSProperties;
	return (
		<div className={styles.avatar} style={style} data-chat-avatar-decoration="">
			{children}
			{frame && <DecorativeImage src={frame.image} className={styles.frame} />}
			{charm && <DecorativeImage src={charm.image} className={styles.charm} />}
		</div>
	);
}
