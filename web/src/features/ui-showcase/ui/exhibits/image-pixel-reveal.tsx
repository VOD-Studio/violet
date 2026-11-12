import { ImagePixelReveal, type PixelRevealVariant } from "@violet/ui";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

function PixelReveal({ state }: ExhibitRenderProps) {
	return (
		<ImagePixelReveal
			key={state}
			src="/ai-personas/gemini-cover.webp"
			alt="角色封面插画"
			variant={state as PixelRevealVariant}
			replayOnHover
			loading="eager"
			className="size-full overflow-hidden rounded-xl"
			imgClassName="size-full object-cover"
		/>
	);
}

export const imagePixelRevealExhibit: Exhibit = {
	id: "image-pixel-reveal",
	name: "像素展开",
	units: ["image-pixel-reveal"],
	zone: "content",
	category: "display",
	footprint: { width: 400, height: 240 },
	states: [
		{ id: "random", label: "随机" },
		{ id: "ripple", label: "中心扩散" },
		{ id: "diagonal", label: "对角线" },
		{ id: "curtain", label: "自上而下" },
	],
	Render: PixelReveal,
};
