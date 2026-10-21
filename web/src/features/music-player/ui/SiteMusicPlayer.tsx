import MusicPlayerClient from "@features/music-player/ui/MusicPlayerClient";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** 播放核心仅在客户端创建，服务端与水合首帧均不输出播放器。 */
export function SiteMusicPlayer() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	if (!mounted) return null;
	return createPortal(
		<div className="dialect-public relative z-50">
			<MusicPlayerClient />
		</div>,
		document.body,
	);
}
