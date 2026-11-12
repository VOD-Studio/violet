import { ImagePreview, useImagePreview } from "@shared/ui/image-preview";
import { Maximize2 } from "lucide-react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

/** 用仓库内已有的插画当照片；缩略图与原图分开，预览先出缩略图再换原图。 */
const PHOTOS = [
	{
		src: "/ai-personas/claude-cover.webp",
		thumb: "/ai-personas/claude-avatar.webp",
		alt: "淡紫色封面插画",
	},
	{
		src: "/ai-personas/deepseek-cover.webp",
		thumb: "/ai-personas/deepseek-avatar.webp",
		alt: "蓝色封面插画",
	},
	{
		src: "/ai-personas/gemini-cover.webp",
		thumb: "/ai-personas/gemini-avatar.webp",
		alt: "渐层封面插画",
	},
	{
		src: "/ai-personas/glm-cover.webp",
		thumb: "/ai-personas/glm-avatar.webp",
		alt: "绿色封面插画",
	},
];

const STATES: { id: string; label: string; count: number; list?: boolean }[] = [
	{ id: "gallery", label: "多图", count: PHOTOS.length },
	{ id: "single", label: "单图", count: 1 },
	{ id: "list", label: "多图带缩略条", count: PHOTOS.length },
];

/**
 * 灯箱常开在舞台里：遮罩、工具栏与图片都是真实预览层。
 * 关闭后停留在图片网格上，点任意一张重新打开；换状态重挂一次预览。
 */
function LightboxStage({ state }: ExhibitRenderProps) {
	const { ref, container } = useStageContainer();
	const preview = useImagePreview();
	// 展品不自动打开预览：预览层带 tabIndex，挂载即抢焦点，
	// 会让陈列室其余展品的走近按钮失去键盘可达性。点任意一张才打开。
	const definition = STATES.find((item) => item.id === state) ?? STATES[0];
	const photos = PHOTOS.slice(0, definition.count);

	return (
		<div ref={ref} className="relative size-full">
			<div className="grid grid-cols-2 gap-2">
				{photos.map((photo, index) => (
					<button
						key={photo.src}
						type="button"
						onClick={(event) =>
							preview.openPreview(
								photos.map((item) => item.src),
								index,
								event.currentTarget,
								photos.map((item) => item.thumb),
							)
						}
						className="overflow-hidden rounded-8 bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<img
							src={photo.thumb}
							alt={photo.alt}
							className="aspect-[4/3] w-full object-cover"
							loading="lazy"
						/>
					</button>
				))}
			</div>
			<p className="mt-3 flex items-center gap-1.5 text-13 text-muted-foreground">
				<Maximize2 aria-hidden className="size-3.5" />
				点任意一张打开预览；遮罩、工具栏与缩略条都由真实组件渲染。
			</p>
			{container ? (
				<ImagePreview
					key={state}
					container={container}
					open={preview.open}
					images={preview.images}
					thumbnails={preview.thumbnails}
					currentIndex={preview.currentIndex}
					triggerElement={preview.triggerElement}
					onClose={preview.closePreview}
					onIndexChange={preview.setCurrentIndex}
				/>
			) : null}
		</div>
	);
}

export const lightboxExhibit: Exhibit = {
	id: "lightbox",
	name: "图片预览",
	units: ["image-preview"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 560, height: 560 },
	states: STATES,
	Render: LightboxStage,
};
