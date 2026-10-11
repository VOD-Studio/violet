import { cn } from "cn";
import { useEffect, useState } from "react";
import { coverCropTransform, type Size } from "./lib/crop-display";
import type { CropRect } from "./types";

export interface CropPreviewProps {
	/** 图片源（object URL 或远程 URL），不带 ?crop=。 */
	src: string;
	/** 归一化选区；缺省时按居中 cover 展示。 */
	rect?: CropRect;
	/** 预览框宽高比（宽 ÷ 高）。 */
	aspect: number;
	/** 是否圆形（头像预览）。 */
	round?: boolean;
	className?: string;
}

/** 按选区实时渲染取景结果，几何与 CroppedImage 一致，尺寸由外层宽度决定。 */
export function CropPreview({ src, rect, aspect, round, className }: CropPreviewProps) {
	const [natural, setNatural] = useState<Size | null>(null);
	const [box, setBox] = useState<Size | null>(null);
	const [node, setNode] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		let cancelled = false;
		setNatural(null);
		const img = new Image();
		img.onload = () => {
			if (!cancelled) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
		};
		img.src = src;
		return () => {
			cancelled = true;
		};
	}, [src]);

	useEffect(() => {
		if (!node) return;
		const measure = () => setBox({ w: node.offsetWidth, h: node.offsetHeight });
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(node);
		return () => ro.disconnect();
	}, [node]);

	const full: CropRect = rect ?? { x: 0, y: 0, w: 1, h: 1 };
	const transform = natural && box ? coverCropTransform(full, natural, box) : null;

	return (
		<div
			ref={setNode}
			className={cn(
				"relative overflow-hidden bg-muted ring-1 ring-border ring-inset",
				round ? "rounded-full" : "rounded-lg",
				className,
			)}
			style={{ aspectRatio: aspect }}
		>
			{transform && (
				<img
					src={src}
					alt=""
					draggable={false}
					className="absolute max-w-none select-none"
					style={{
						width: transform.width,
						height: transform.height,
						left: transform.left,
						top: transform.top,
					}}
				/>
			)}
		</div>
	);
}
