import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@violet/ui";
import { Bold, Italic, Link as LinkIcon } from "lucide-react";
import { useId } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const TOOLS = [
	{ name: "粗体", keys: ["mod", "B"], Icon: Bold },
	{ name: "斜体", keys: ["mod", "I"], Icon: Italic },
	{ name: "链接", keys: ["mod", "K"], Icon: LinkIcon },
] as const;

const RECENT = [
	"拆解 Saber —— 一个用 Go 写就的、会思考的聊天机器人",
	"独库公路，六天",
	"逐像素弯曲时空：singularity-rs 黑洞渲染器深度解析",
];

/** 不可用的按钮收不到悬停：外层壳接悬停，按钮 aria-disabled 并用 aria-describedby 指向原因。 */
function DisabledPublish({ arrow, container }: { arrow: boolean; container: HTMLElement | null }) {
	const reasonId = useId();
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="ml-auto inline-flex">
					<Button aria-disabled="true" aria-describedby={reasonId} variant="soft">
						发布
					</Button>
					<span id={reasonId} className="sr-only">
						还有 3 张图没有替代文字
					</span>
				</span>
			</TooltipTrigger>
			<TooltipContent arrow={arrow} container={container} side="top" align="end">
				还有 3 张图没有替代文字
			</TooltipContent>
		</Tooltip>
	);
}

/** 工具栏图标、不可用的发布按钮，以及只有被截断才出提示的列表。 */
function TooltipStage({ state }: ExhibitRenderProps) {
	const { ref, container } = useStageContainer();
	const arrow = state !== "plain";
	return (
		<div ref={ref} className="flex h-full flex-col gap-6 px-8 pt-12">
			<TooltipProvider key={state}>
				<div role="toolbar" aria-label="文字格式" className="flex items-center gap-1">
					{TOOLS.map(({ name, keys, Icon }, index) => (
						<Tooltip key={name} defaultOpen={index === 0}>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" aria-label={name}>
									<Icon size={16} />
								</Button>
							</TooltipTrigger>
							<TooltipContent arrow={arrow} container={container} shortcut={keys}>
								{name}
							</TooltipContent>
						</Tooltip>
					))}
					<DisabledPublish arrow={arrow} container={container} />
				</div>
				<section aria-label="最近编辑" className="min-w-0">
					<h3 className="mb-1 text-xs text-muted-foreground">最近编辑</h3>
					<ul className="w-56">
						{RECENT.map((title) => (
							<li key={title}>
								<Tooltip truncatedOnly>
									<TooltipTrigger asChild>
										<a
											href={`#${encodeURIComponent(title)}`}
											onClick={(event) => event.preventDefault()}
											className="block truncate rounded-md px-2 py-1 text-sm text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
										>
											{title}
										</a>
									</TooltipTrigger>
									<TooltipContent arrow={arrow} container={container}>
										{title}
									</TooltipContent>
								</Tooltip>
							</li>
						))}
					</ul>
				</section>
			</TooltipProvider>
		</div>
	);
}

export const tooltipExhibit: Exhibit = {
	id: "tooltip",
	name: "文字提示",
	units: ["tooltip"],
	zone: "stage",
	category: "overlay",
	footprint: { width: 360, height: 240 },
	states: [
		{ id: "arrow", label: "带箭头" },
		{ id: "plain", label: "不带箭头" },
	],
	Render: TooltipStage,
};
