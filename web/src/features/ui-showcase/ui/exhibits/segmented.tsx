import { Segmented } from "@violet/ui";
import { LayoutGrid, List, Moon, Sun, SunMoon } from "lucide-react";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const SCOPES = [
	{ value: "all", label: "全部" },
	{ value: "series", label: "系列" },
	{ value: "archive", label: "归档" },
];
const STATUSES = [
	{ value: "all", label: "全部", count: 270 },
	{ value: "draft", label: "草稿", count: 3 },
	{ value: "scheduled", label: "定时", count: 1 },
];
const APPEARANCES = [
	{ value: "light", label: "浅色", icon: <Sun size={14} /> },
	{ value: "dark", label: "深色", icon: <Moon size={14} /> },
	{ value: "system", label: "跟随系统", icon: <SunMoon size={14} /> },
];
const VIEWS = [
	{ value: "grid", label: "网格", icon: <LayoutGrid size={14} /> },
	{ value: "list", label: "列表", icon: <List size={14} /> },
];
const RANGES = [
	{ value: "today", label: "今天" },
	{ value: "week", label: "本周" },
	{ value: "month", label: "本月" },
	{ value: "year", label: "今年" },
];
const AUTH = [
	{ value: "signin", label: "登录" },
	{ value: "signup", label: "注册" },
];

function SegmentedFamily({ state }: ExhibitRenderProps) {
	const [scope, setScope] = useState("all");
	const [status, setStatus] = useState("all");
	const [appearance, setAppearance] = useState("light");
	const [view, setView] = useState("grid");
	const [range, setRange] = useState("week");
	const [auth, setAuth] = useState("signin");
	const groupDisabled = state === "disabled";
	return (
		<div className="flex w-full flex-col gap-3">
			<div className="flex items-start gap-6">
				<div className="flex flex-col items-start gap-3">
					<Segmented
						aria-label="文章范围"
						value={scope}
						onValueChange={setScope}
						segments={SCOPES}
						size="default"
					/>
					<Segmented
						aria-label="状态筛选"
						value={status}
						onValueChange={setStatus}
						segments={STATUSES.map(({ value, label, count }) => ({
							value,
							label,
							trailing: (
								<span className="text-12 font-normal tabular-nums text-muted-foreground">
									{count}
								</span>
							),
						}))}
						size="default"
					/>
					<Segmented
						aria-label="外观"
						value={appearance}
						onValueChange={setAppearance}
						segments={APPEARANCES}
						size="default"
					/>
					<Segmented
						aria-label="视图"
						value={view}
						onValueChange={setView}
						segments={VIEWS.map((item) => ({ ...item, title: item.label }))}
						size="default"
					/>
					<Segmented
						aria-label="内容类型"
						value="posts"
						segments={[
							{ value: "posts", label: "文章" },
							{ value: "notes", label: "手记" },
							{ value: "tweets", label: "推文" },
							{ value: "gallery", label: "图集", disabled: true },
						]}
						size="default"
					/>
				</div>
				<Segmented
					aria-label="统计区间"
					value={range}
					onValueChange={setRange}
					segments={RANGES}
					orientation="vertical"
					size="default"
					className="w-35"
				/>
			</div>
			<Segmented
				aria-label="登录或注册"
				value={auth}
				onValueChange={setAuth}
				segments={AUTH}
				size="default"
				block
				disabled={groupDisabled}
			/>
		</div>
	);
}

export const segmentedExhibit: Exhibit = {
	id: "segmented",
	name: "分段控制",
	units: ["segmented"],
	zone: "shelf",
	category: "action",
	footprint: { width: 448, height: 296 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "disabled", label: "禁用" },
	],
	Render: SegmentedFamily,
};
