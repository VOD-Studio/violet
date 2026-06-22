import { useMusicUIStore } from "@features/music/model/ui-store";
import { Button } from "@shared/ui/button";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import MusicPlayerEmpty from "./MusicPlayerEmpty";

/**
 * MusicPlayer - 全屏音乐播放器组件
 *
 * 常驻 __root，通过 MusicUIStore 控显隐（不是路由）。
 * 用 portal 挂到 body 避免 __root overflow 截断全屏遮罩。
 *
 * 首期仅做骨架：打开/关闭 + 空态占位。
 * 实际播放（Plyr / 音频流 / 歌单列表）下一期扩展。
 *
 * SSR 安全：mounted 标记确保 createPortal 仅在客户端运行。
 */
const MusicPlayer = () => {
	const { isOpen, close } = useMusicUIStore();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted || !isOpen) return null;

	return createPortal(
		<div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
			<div className="container mx-auto h-full flex flex-col px-4 py-6">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-2xl font-bold">音乐</h2>
					<Button variant="ghost" size="icon" onClick={close} aria-label="关闭">
						<X className="h-5 w-5" />
					</Button>
				</div>
				<div className="flex-1 flex items-center justify-center">
					<MusicPlayerEmpty />
				</div>
			</div>
		</div>,
		document.body,
	);
};

export default MusicPlayer;
