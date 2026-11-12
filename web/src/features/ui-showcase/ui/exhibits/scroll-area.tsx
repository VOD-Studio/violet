import { Button, Card, ScrollArea } from "@violet/ui";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const CHAPTERS = [
	"在雨停之前",
	"穿过河谷",
	"山口的风",
	"沿着旧路",
	"云层之上",
	"湖边的夜",
	"下一个清晨",
	"回到原点",
	"路上的人",
	"未完的旅程",
	"把故事留下",
	"走过四季",
];

function ChapterChips() {
	return (
		<ScrollArea aria-label="横向章节导航" orientation="horizontal" className="h-16 w-full">
			<div className="flex gap-2 py-2">
				{CHAPTERS.map((chapter) => (
					<Button key={chapter}>{chapter}</Button>
				))}
			</div>
		</ScrollArea>
	);
}

/** 纵向与双向放在纸片里，渐隐取纸片色，与设计稿一致。 */
function ChapterList({ wide }: { wide: boolean }) {
	return (
		<Card className="size-full gap-0 overflow-hidden p-0 [--v-scroll-area-surface:var(--card)]">
			<ScrollArea
				aria-label="旅行手记章节"
				orientation={wide ? "both" : "vertical"}
				className="size-full"
			>
				<ol className={wide ? "w-180 px-3 py-1" : "px-3 py-1"}>
					{CHAPTERS.map((chapter, index) => (
						<li key={chapter} className="flex min-h-10 items-center gap-4 text-sm">
							<span className="w-6 shrink-0 font-mono text-xs text-muted-foreground">
								{String(index + 1).padStart(2, "0")}
							</span>
							<Button variant="ghost" size="sm">
								{chapter}
							</Button>
						</li>
					))}
				</ol>
			</ScrollArea>
		</Card>
	);
}

function ScrollAreaStage({ state }: ExhibitRenderProps) {
	if (state === "horizontal") {
		return (
			<div className="flex size-full items-center">
				<ChapterChips />
			</div>
		);
	}

	return <ChapterList wide={state === "both"} />;
}

export const scrollAreaExhibit: Exhibit = {
	id: "scroll-area",
	name: "滚动区域",
	units: ["scroll-area"],
	zone: "content",
	category: "layout",
	footprint: { width: 520, height: 280 },
	states: [
		{ id: "vertical", label: "纵向" },
		{ id: "horizontal", label: "横向" },
		{ id: "both", label: "双向" },
	],
	Render: ScrollAreaStage,
};
