import { Checkbox, Label } from "@violet/ui";
import { useState } from "react";

const ITEMS = [
	{ id: "notify-email", label: "邮件推送通知" },
	{ id: "notify-sms", label: "短信安全警报" },
	{ id: "notify-browser", label: "浏览器网页通知" },
];

/** 全选与半选联动：父级复选框随子项勾选态切换三态。 */
export function CheckboxTriStateDemo() {
	const [selected, setSelected] = useState<string[]>(["notify-email"]);

	const allSelected = selected.length === ITEMS.length;
	const isIndeterminate = selected.length > 0 && !allSelected;

	const handleSelectAll = () => {
		setSelected(allSelected ? [] : ITEMS.map((item) => item.id));
	};

	const handleToggleItem = (id: string) => {
		setSelected((prev) =>
			prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
		);
	};

	return (
		<div className="flex justify-center">
			<div className="w-full max-w-sm space-y-3 rounded-xl border border-border/70 bg-card/60 p-4">
				<div className="flex items-center gap-2.5 border-b border-border/40 pb-3">
					<Checkbox
						id="select-all"
						variant="primary"
						checked={allSelected ? true : isIndeterminate ? "indeterminate" : false}
						onCheckedChange={handleSelectAll}
					/>
					<Label
						htmlFor="select-all"
						className="cursor-pointer text-sm font-semibold select-none"
					>
						全选全部通知通道 ({selected.length}/{ITEMS.length})
					</Label>
				</div>

				<div className="space-y-2.5 pl-6">
					{ITEMS.map((item) => (
						<div key={item.id} className="flex items-center gap-2.5">
							<Checkbox
								id={item.id}
								variant="primary"
								checked={selected.includes(item.id)}
								onCheckedChange={() => handleToggleItem(item.id)}
							/>
							<Label
								htmlFor={item.id}
								className="cursor-pointer text-sm text-foreground/90 select-none"
							>
								{item.label}
							</Label>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
