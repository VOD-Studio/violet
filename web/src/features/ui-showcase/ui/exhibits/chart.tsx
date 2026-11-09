import { MiniBars, Stat } from "@violet/ui";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const WEEK = [
	{ label: "周一", value: 1180 },
	{ label: "周二", value: 960 },
	{ label: "周三", value: 1420 },
	{ label: "周四", value: 1310 },
	{ label: "周五", value: 1560 },
	{ label: "周六", value: 1720 },
	{ label: "周日", value: 1610 },
];

const TREND = [820, 940, 900, 1180, 1320, 1290, 1400];

function StatRow() {
	return (
		<div className="grid w-full max-w-130 grid-cols-3 gap-10">
			<Stat
				label="近 7 天访问"
				value="12,480"
				change={{ direction: "up", value: "18%" }}
				trend={TREND}
			/>
			<Stat label="新评论" value="86" change={{ direction: "up", value: "7%" }} />
			<Stat label="跳出率" value="41%" change={{ direction: "down", value: "3%" }} />
		</div>
	);
}

function Bars() {
	return (
		<div className="w-full max-w-130">
			<MiniBars data={WEEK} unit="访问" />
		</div>
	);
}

function ChartFamily({ state }: ExhibitRenderProps) {
	return (
		<div className="flex size-full flex-col justify-center p-6">
			{state === "bars" ? <Bars /> : <StatRow />}
		</div>
	);
}

export const chartExhibit: Exhibit = {
	id: "chart",
	name: "图表",
	units: ["chart"],
	zone: "content",
	category: "display",
	footprint: { width: 520, height: 280 },
	states: [
		{ id: "stats", label: "统计数字" },
		{ id: "bars", label: "迷你柱状图" },
	],
	Render: ChartFamily,
};
