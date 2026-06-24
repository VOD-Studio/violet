import { useMusicUIStore } from "@features/music/model/ui-store";
import { Button } from "@shared/ui/button";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * MusicPlayer - 全屏音乐播放器（Nexus 视觉）
 *
 * 毛玻璃全屏遮罩 + 左侧「唱片/轨道」shimmer 占位 + 右侧歌单骨架。
 * 仍由 MusicUIStore 控显隐，不动 store。
 */
const MusicPlayer = () => {
	const { isOpen, close } = useMusicUIStore();
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);
	if (!mounted || !isOpen) return null;

	return createPortal(
		<div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-2xl dark:bg-surface-glass/70">
			<div className="container mx-auto flex h-full flex-col px-4 py-6">
				<div className="mb-6 flex items-center justify-between">
					<h2 className="font-mono text-2xl font-bold">Music</h2>
					<Button variant="ghost" size="icon" onClick={close} aria-label="关闭">
						<X className="size-5" />
					</Button>
				</div>
				<div className="grid flex-1 grid-cols-1 gap-6 md:grid-cols-[40%_60%]">
					<div className="flex flex-col items-center justify-center gap-4">
						<ShimmerSkeleton className="aspect-square w-64 rounded-full" />
						<div className="w-64 space-y-2">
							<ShimmerSkeleton className="h-4 w-2/3" />
							<ShimmerSkeleton className="h-3 w-1/2" />
						</div>
					</div>
					<div className="space-y-2">
						{Array.from({ length: 8 }).map((_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: 骨架
							<ShimmerSkeleton key={i} className="h-12 w-full rounded-md" />
						))}
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
};

export default MusicPlayer;
