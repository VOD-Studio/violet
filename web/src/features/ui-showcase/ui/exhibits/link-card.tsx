import { LinkCard } from "@violet/ui";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const IMAGES: Record<string, string | undefined> = {
	cover: "/ai-personas/claude-cover.webp",
	logo: "/logo.png",
	broken: "data:image/png;base64,broken",
	none: undefined,
};

function LinkCardInProse({ state }: ExhibitRenderProps) {
	return (
		<div className="flex flex-col gap-3 text-sm leading-7">
			<p>写组件前先读一遍原生语义，再决定哪些行为交给浏览器：</p>
			<LinkCard
				href="https://example.com/guide#native-links"
				title="组件设计指南：保持原生链接交互和完整图片内容"
				description="从原生语义开始，让封面、Logo、长标题和窄容器各自保持稳定。"
				siteName="Example Journal"
				imageSrc={IMAGES[state]}
				imageAlt={state === "cover" ? "抱着枕头的角色插画" : ""}
			/>
		</div>
	);
}

export const linkCardExhibit: Exhibit = {
	id: "link-card",
	name: "链接卡片",
	units: ["link-card"],
	zone: "content",
	category: "content",
	footprint: { width: 520, height: 140 },
	states: [
		{ id: "cover", label: "封面" },
		{ id: "logo", label: "Logo" },
		{ id: "none", label: "无图" },
		{ id: "broken", label: "坏图" },
	],
	Render: LinkCardInProse,
};
