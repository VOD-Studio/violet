import { Button, type IconSize, IslandIcon, iconProps, MorphIcon, TimelineIcon } from "@violet/ui";
import { CircleAlert, Ellipsis, Plus, Search, SquarePen, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const SIZES: IconSize[] = [12, 14, 16, 18, 20, 24];

/** lucide 取六个常用形，后三个是项目自绘，同排比较线宽与视觉重量。 */
const ICONS = [
	{ label: "提示", Icon: CircleAlert },
	{ label: "搜索", Icon: Search },
	{ label: "新增", Icon: Plus },
	{ label: "更多", Icon: Ellipsis },
	{ label: "编辑", Icon: SquarePen },
	{ label: "删除", Icon: Trash2 },
	{ label: "灵动岛", Icon: IslandIcon },
	{ label: "时间线", Icon: TimelineIcon },
	{ label: "变形", Icon: MorphIcon },
];

function IconGrid({ state }: ExhibitRenderProps) {
	const size = SIZES.find((size) => String(size) === state) ?? 16;
	const [selected, setSelected] = useState<string>();
	return (
		<div className="flex h-full flex-col justify-center gap-4">
			<p className="font-mono text-xs text-muted-foreground">
				{size} 档 · 线宽 {iconProps(size).strokeWidth}
			</p>
			<div className="grid grid-cols-3 gap-x-3 gap-y-4">
				{ICONS.map(({ label, Icon }) => (
					<div key={label} className="flex flex-col items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							iconOnly
							aria-label={`${label}图标`}
							aria-pressed={selected === label}
							className={
								selected === label
									? "text-selected-foreground"
									: "text-muted-foreground hover:text-foreground"
							}
							onClick={() => {
								setSelected(selected === label ? undefined : label);
							}}
						>
							<Icon {...iconProps(size)} />
						</Button>
						<span className="text-xs text-muted-foreground">{label}</span>
					</div>
				))}
			</div>
		</div>
	);
}

export const iconsExhibit: Exhibit = {
	id: "icons",
	name: "图标",
	units: ["icons"],
	zone: "shelf",
	category: "display",
	footprint: { width: 360, height: 230 },
	states: SIZES.map((size) => ({ id: String(size), label: `${size} px` })),
	Render: IconGrid,
};
