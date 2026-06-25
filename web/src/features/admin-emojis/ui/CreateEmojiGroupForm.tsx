import { useCreateEmojiGroup } from "@features/emojis/api/mutations";
import { Button } from "@shared/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@shared/ui/dialog";
import { Input } from "@shared/ui/input";
import { Label } from "@shared/ui/label";
import { useState } from "react";
import { toast } from "sonner";

interface CreateEmojiGroupFormProps {
	onCreated: () => void;
}

const SOURCES = ["system", "bilibili", "custom"] as const;

/**
 * CreateEmojiGroupForm - 新建表情分组表单
 *
 * 字段：name（必填）/ source / sort_order / is_enabled。
 * 用 useCreateEmojiGroup，成功后 toast + onCreated（父关闭弹窗 + 刷新）。
 */
export function CreateEmojiGroupForm({ onCreated }: CreateEmojiGroupFormProps) {
	const [name, setName] = useState("");
	const [source, setSource] = useState<(typeof SOURCES)[number]>("custom");
	const [sortOrder, setSortOrder] = useState("0");
	const [isEnabled, setIsEnabled] = useState(true);
	const createGroup = useCreateEmojiGroup();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const order = Number.parseInt(sortOrder, 10);
		createGroup.mutate(
			{
				name,
				source,
				sort_order: Number.isNaN(order) ? 0 : order,
				is_enabled: isEnabled,
			},
			{
				onSuccess: () => {
					toast.success("分组创建成功");
					onCreated();
				},
				onError: (err) => toast.error(err.message),
			},
		);
	};

	return (
		<form onSubmit={handleSubmit}>
			<DialogHeader>
				<DialogTitle>新建表情分组</DialogTitle>
				<DialogDescription>创建一个表情分组，分组名唯一。</DialogDescription>
			</DialogHeader>
			<div className="space-y-3 py-4">
				<div className="space-y-1">
					<Label>名称 *</Label>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="如：bilibili、custom"
						required
					/>
				</div>
				<div className="space-y-1">
					<Label>来源</Label>
					<div className="flex gap-2">
						{SOURCES.map((s) => (
							<Button
								key={s}
								type="button"
								size="sm"
								variant={source === s ? "default" : "outline"}
								onClick={() => setSource(s)}
							>
								{s}
							</Button>
						))}
					</div>
				</div>
				<div className="flex gap-4">
					<div className="flex-1 space-y-1">
						<Label>排序值</Label>
						<Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
					</div>
					<div className="flex-1 space-y-1">
						<Label>启用</Label>
						<div className="flex gap-2 pt-1.5">
							<Button
								type="button"
								size="sm"
								variant={isEnabled ? "default" : "outline"}
								onClick={() => setIsEnabled(true)}
							>
								启用
							</Button>
							<Button
								type="button"
								size="sm"
								variant={!isEnabled ? "destructive" : "outline"}
								onClick={() => setIsEnabled(false)}
							>
								禁用
							</Button>
						</div>
					</div>
				</div>
			</div>
			<DialogFooter>
				<Button type="submit" disabled={createGroup.isPending}>
					创建
				</Button>
			</DialogFooter>
		</form>
	);
}
