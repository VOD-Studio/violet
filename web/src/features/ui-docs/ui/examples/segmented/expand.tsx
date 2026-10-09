import { Segmented } from "@violet/ui";
import { BookOpen, Code2, Palette } from "lucide-react";
import { useState } from "react";

const SEGMENTS = [
	{ value: "guide", label: "指南", icon: <BookOpen className="size-4" />, title: "指南" },
	{ value: "api", label: "接口", icon: <Code2 className="size-4" />, title: "接口" },
	{ value: "theme", label: "主题", icon: <Palette className="size-4" />, title: "主题" },
];

const TITLES: Record<string, string> = {
	guide: "从安装到第一个组件",
	api: "属性、事件与键盘契约",
	theme: "令牌与深浅色",
};

/** 等尺寸布局；选中项占满剩余长度，其余收成只剩图标，整体宽度不变。 */
export function SegmentedExpandDemo() {
	const [value, setValue] = useState("guide");

	return (
		<div className="w-full max-w-md space-y-4">
			<Segmented
				aria-label="文档分区"
				itemSize="7rem"
				expandSelected
				value={value}
				onValueChange={setValue}
				segments={SEGMENTS}
			/>
			<h3 className="text-base font-semibold text-foreground" aria-live="polite">
				{TITLES[value]}
			</h3>
		</div>
	);
}
