import { Radio, RadioGroup } from "@violet/ui";
import { useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const VISIBILITY = [
	{ value: "pub", label: "公开" },
	{ value: "login", label: "仅登录可见" },
	{ value: "me", label: "仅自己" },
];

const COMMENTERS = [
	{ value: "all", label: "所有人", description: "登录后即可评论" },
	{ value: "fr", label: "仅友链与订阅者", description: "其余人只能看" },
	{ value: "off", label: "关闭评论", description: "已有评论仍然显示" },
];

const PUBLISH = [
	{ value: "now", label: "立即发布", description: "发布后出现在首页「最近」" },
	{ value: "later", label: "定时发布", description: "到点自动发布，期间只有你能看到" },
	{ value: "draft", label: "存为草稿", description: "不会出现在任何列表里" },
];

/* 状态矩阵的悬停列：未选加深外圈线，已选维持墨色外圈（与组件自身悬停一致） */
const FORCE_HOVER = [
	"[&:not(:has(input:checked))_.v-radio__control]:[box-shadow:inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_50%,transparent)]",
	"[&:has(input:checked)_.v-radio__control]:[box-shadow:inset_0_0_0_5px_var(--foreground)]",
].join(" ");

/* 键盘聚焦列：2px 强调色环，offset 2px */
const FORCE_FOCUS = [
	"[&_.v-radio__control]:[outline:2px_solid_var(--ring)]",
	"[&_.v-radio__control]:[outline-offset:2px]",
].join(" ");

const MATRIX_COLUMNS = [
	{ id: "default", label: "默认", className: "" },
	{ id: "hover", label: "悬停", className: FORCE_HOVER },
	{ id: "focus", label: "聚焦", className: FORCE_FOCUS },
	{ id: "disabled", label: "禁用", className: "" },
];

function RadioFields({ state }: ExhibitRenderProps) {
	const [visibility, setVisibility] = useState("pub");

	if (state === "horizontal") {
		return (
			<RadioGroup legend="评论排序" orientation="horizontal" defaultValue="new">
				<Radio value="new" label="最新" />
				<Radio value="hot" label="最热" />
				<Radio value="old" label="最早" />
			</RadioGroup>
		);
	}

	if (state === "described") {
		return (
			<RadioGroup legend="谁可以评论" defaultValue="all">
				{COMMENTERS.map((option) => (
					<Radio key={option.value} {...option} />
				))}
			</RadioGroup>
		);
	}

	if (state === "card") {
		return (
			<RadioGroup legend="发布方式" appearance="card" defaultValue="now">
				{PUBLISH.map((option) => (
					<Radio key={option.value} {...option} />
				))}
			</RadioGroup>
		);
	}

	if (state === "matrix") {
		return (
			<div className="flex flex-col gap-3">
				{(["unselected", "selected"] as const).map((row) => (
					<div key={row} className="flex items-center gap-4">
						<span className="w-10 shrink-0 text-xs text-muted-foreground">
							{row === "unselected" ? "未选" : "已选"}
						</span>
						<div className="flex items-center gap-6">
							{MATRIX_COLUMNS.map((column) => (
								// 每格一个单选组：原生单选一组只能选一个，矩阵要四格同现选中态
								<RadioGroup
									key={column.id}
									legend={`状态示例·${row === "unselected" ? "未选" : "已选"}·${column.label}`}
									defaultValue={row === "selected" ? column.id : undefined}
									className={column.className}
								>
									<Radio
										value={column.id}
										label={column.label}
										disabled={column.id === "disabled"}
									/>
								</RadioGroup>
							))}
						</div>
					</div>
				))}
			</div>
		);
	}

	return (
		<RadioGroup legend="可见范围" value={visibility} onValueChange={setVisibility}>
			{VISIBILITY.map((option) => (
				<Radio key={option.value} {...option} />
			))}
		</RadioGroup>
	);
}

export const radioExhibit: Exhibit = {
	id: "radio",
	name: "单选",
	units: ["radio"],
	zone: "field",
	category: "form",
	footprint: { width: 600, height: 176 },
	states: [
		{ id: "default", label: "竖排" },
		{ id: "horizontal", label: "横排" },
		{ id: "described", label: "带说明" },
		{ id: "card", label: "选项卡片" },
		{ id: "matrix", label: "状态" },
	],
	Render: RadioFields,
};
