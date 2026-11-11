import { ImageGrid } from "@violet/ui";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { cover } from "./art";

const photos = Array.from({ length: 9 }, (_, index) => ({
	src: cover(120 + index * 26),
	alt: `远山 ${index + 1}`,
	width: 320,
	height: 200,
}));
const tall = { src: cover(142), alt: "竖幅山景", width: 200, height: 400 };
const wide = { src: cover(195), alt: "宽幅山景", width: 800, height: 200 };

function ImageGrids({ state }: ExhibitRenderProps) {
	const [selected, setSelected] = useState<number | null>(null);
	const images =
		state === "portrait" ? [tall] : state === "wide" ? [wide] : photos.slice(0, Number(state));
	return (
		<div className="flex w-105 flex-col gap-3">
			<ImageGrid images={images} onImageClick={(index) => setSelected(index)} />
			<output className="text-xs text-muted-foreground" aria-live="polite">
				{selected === null ? "选择一张照片" : `已选择第 ${selected + 1} 张`}
			</output>
		</div>
	);
}

export const imageGridExhibit: Exhibit = {
	id: "image-grid",
	name: "图片网格",
	units: ["image-grid"],
	zone: "content",
	category: "display",
	footprint: { width: 440, height: 420 },
	states: [
		{ id: "4", label: "四张" },
		{ id: "1", label: "单张" },
		{ id: "portrait", label: "竖幅单张" },
		{ id: "wide", label: "超宽单张" },
		{ id: "2", label: "两张" },
		{ id: "3", label: "三张" },
		{ id: "5", label: "五张" },
		{ id: "9", label: "九张" },
	],
	Render: ImageGrids,
};
