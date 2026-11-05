import { ToggleGroup, ToggleGroupItem, ToggleGroupSeparator } from "@violet/ui";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Code,
	Italic,
	List,
	ListOrdered,
	Quote,
	Strikethrough,
	Underline,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

/** 状态区一行：左侧小标签，右侧真实开关组 */
function StateRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-center gap-3">
			<span className="w-14 text-xs text-muted-foreground">{label}</span>
			{children}
		</div>
	);
}

function ToggleGroupFamily({ state }: ExhibitRenderProps) {
	const [formats, setFormats] = useState(["bold", "italic"]);
	const [align, setAlign] = useState("left");
	const [columns, setColumns] = useState(["summary"]);
	const [tools, setTools] = useState(["bold"]);
	const [demo, setDemo] = useState(["italic"]);

	switch (state) {
		case "single":
			return (
				<ToggleGroup type="single" aria-label="对齐" value={align} onValueChange={setAlign}>
					<ToggleGroupItem value="left" aria-label="左对齐" title="左对齐">
						<AlignLeft size={16} />
					</ToggleGroupItem>
					<ToggleGroupItem value="center" aria-label="居中" title="居中">
						<AlignCenter size={16} />
					</ToggleGroupItem>
					<ToggleGroupItem value="right" aria-label="右对齐" title="右对齐">
						<AlignRight size={16} />
					</ToggleGroupItem>
				</ToggleGroup>
			);
		case "text":
			return (
				<ToggleGroup
					type="multiple"
					aria-label="列表显示"
					value={columns}
					onValueChange={setColumns}
				>
					<ToggleGroupItem value="summary">摘要</ToggleGroupItem>
					<ToggleGroupItem value="cover">封面</ToggleGroupItem>
					<ToggleGroupItem value="tags">标签</ToggleGroupItem>
				</ToggleGroup>
			);
		case "toolbar":
			return (
				<ToggleGroup
					type="multiple"
					variant="bare"
					role="toolbar"
					aria-label="编辑工具"
					value={tools}
					onValueChange={setTools}
				>
					<ToggleGroupItem value="bold" aria-label="加粗" title="加粗（⌘B）">
						<Bold size={16} />
					</ToggleGroupItem>
					<ToggleGroupItem value="italic" aria-label="斜体" title="斜体（⌘I）">
						<Italic size={16} />
					</ToggleGroupItem>
					<ToggleGroupSeparator />
					<ToggleGroupItem value="ordered" aria-label="有序列表" title="有序列表">
						<ListOrdered size={16} />
					</ToggleGroupItem>
					<ToggleGroupItem value="bullet" aria-label="无序列表" title="无序列表">
						<List size={16} />
					</ToggleGroupItem>
					<ToggleGroupSeparator />
					<ToggleGroupItem value="quote" aria-label="引用" title="引用">
						<Quote size={16} />
					</ToggleGroupItem>
					<ToggleGroupItem value="code" aria-label="代码" title="代码">
						<Code size={16} />
					</ToggleGroupItem>
				</ToggleGroup>
			);
		case "states":
			return (
				<div className="flex flex-col items-start gap-3">
					<StateRow label="按下">
						<ToggleGroup
							type="multiple"
							aria-label="按下示例"
							value={demo}
							onValueChange={setDemo}
						>
							<ToggleGroupItem value="bold" aria-label="加粗" title="加粗">
								<Bold size={16} />
							</ToggleGroupItem>
							<ToggleGroupItem value="italic" aria-label="斜体" title="斜体">
								<Italic size={16} />
							</ToggleGroupItem>
							<ToggleGroupItem value="underline" aria-label="下划线" title="下划线">
								<Underline size={16} />
							</ToggleGroupItem>
						</ToggleGroup>
					</StateRow>
					<StateRow label="悬停">
						<ToggleGroup type="multiple" aria-label="悬停示例">
							<ToggleGroupItem value="bold" aria-label="加粗" title="加粗">
								<Bold size={16} />
							</ToggleGroupItem>
							<ToggleGroupItem value="italic" aria-label="斜体" title="斜体">
								<Italic size={16} />
							</ToggleGroupItem>
							<ToggleGroupItem value="underline" aria-label="下划线" title="下划线">
								<Underline size={16} />
							</ToggleGroupItem>
						</ToggleGroup>
					</StateRow>
					<StateRow label="键盘聚焦">
						<ToggleGroup type="multiple" aria-label="聚焦示例">
							<ToggleGroupItem value="bold" aria-label="加粗" title="加粗">
								<Bold size={16} />
							</ToggleGroupItem>
							<ToggleGroupItem value="italic" aria-label="斜体" title="斜体">
								<Italic size={16} />
							</ToggleGroupItem>
							<ToggleGroupItem value="underline" aria-label="下划线" title="下划线">
								<Underline size={16} />
							</ToggleGroupItem>
						</ToggleGroup>
					</StateRow>
				</div>
			);
		default:
			return (
				<ToggleGroup
					type="multiple"
					aria-label="文字格式"
					value={formats}
					onValueChange={setFormats}
				>
					<ToggleGroupItem value="bold" aria-label="加粗" title="加粗">
						<Bold size={16} />
					</ToggleGroupItem>
					<ToggleGroupItem value="italic" aria-label="斜体" title="斜体">
						<Italic size={16} />
					</ToggleGroupItem>
					<ToggleGroupItem value="underline" aria-label="下划线" title="下划线">
						<Underline size={16} />
					</ToggleGroupItem>
					<ToggleGroupItem value="strike" aria-label="删除线" title="删除线">
						<Strikethrough size={16} />
					</ToggleGroupItem>
				</ToggleGroup>
			);
	}
}

export const toggleGroupExhibit: Exhibit = {
	id: "toggle-group",
	name: "开关组",
	units: ["toggle-group"],
	zone: "shelf",
	category: "action",
	footprint: { width: 280, height: 168 },
	states: [
		{ id: "multiple", label: "多选" },
		{ id: "single", label: "单选可取消" },
		{ id: "text", label: "带文字" },
		{ id: "toolbar", label: "工具栏" },
		{ id: "states", label: "状态" },
	],
	Render: ToggleGroupFamily,
};
