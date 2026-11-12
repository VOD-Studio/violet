import { type ComponentType, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** 播放核心仅在客户端创建，且在页面接管之后才下载；服务端与水合首帧均不输出播放器。 */
export function SiteMusicPlayer() {
	const [Player, setPlayer] = useState<ComponentType | null>(null);
	useEffect(() => {
		let active = true;
		// 播放器是可选装饰：下载失败时不显示，不能让阅读页进入错误边界
		import("@features/music-player/ui/MusicPlayerClient").then(
			(module) => {
				if (active) setPlayer(() => module.default);
			},
			() => {},
		);
		return () => {
			active = false;
		};
	}, []);
	if (!Player) return null;
	return createPortal(
		<div className="relative z-50">
			<Player />
		</div>,
		document.body,
	);
}
