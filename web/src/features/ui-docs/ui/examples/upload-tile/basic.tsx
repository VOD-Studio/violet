import { Checkbox, Label, UploadTile } from "@violet/ui";
import { useId, useState } from "react";

/** 只记录按钮激活，不执行文件选择或网络上传。 */
export function UploadTileBasicDemo() {
	const id = useId();
	const [count, setCount] = useState(0);
	const [busy, setBusy] = useState(false);
	const [disabled, setDisabled] = useState(false);

	return (
		<div className="w-full max-w-sm space-y-4">
			<div className="grid grid-cols-3 gap-3">
				<UploadTile
					aria-label="添加图片"
					busy={busy}
					disabled={disabled}
					onClick={() => setCount((value) => value + 1)}
				/>
				<UploadTile busy>处理中</UploadTile>
				<UploadTile disabled>不可用</UploadTile>
			</div>
			<div className="flex flex-wrap gap-4 text-sm">
				<div className="flex items-center gap-2">
					<Checkbox
						id={`${id}-busy`}
						checked={busy}
						onCheckedChange={(checked) => setBusy(checked === true)}
					/>
					<Label htmlFor={`${id}-busy`}>忙碌</Label>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox
						id={`${id}-disabled`}
						checked={disabled}
						onCheckedChange={(checked) => setDisabled(checked === true)}
					/>
					<Label htmlFor={`${id}-disabled`}>禁用</Label>
				</div>
			</div>
			<p className="text-sm text-muted-foreground" aria-live="polite">
				按钮已激活 {count} 次；此示例不选择或上传文件。
			</p>
		</div>
	);
}
