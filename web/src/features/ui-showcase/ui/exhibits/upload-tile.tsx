import { UploadTile } from "@violet/ui";
import { useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

function UploadTiles({ state }: ExhibitRenderProps) {
	const input = useRef<HTMLInputElement>(null);
	const [selected, setSelected] = useState("尚未选择图片");
	const [dragActive, setDragActive] = useState(false);
	return (
		<div className="flex flex-col gap-4">
			<input
				ref={input}
				type="file"
				accept="image/*"
				className="hidden"
				aria-label="选择图片"
				onChange={(event) => {
					setSelected(event.currentTarget.files?.[0]?.name ?? "尚未选择图片");
					event.currentTarget.value = "";
				}}
			/>
			<div className="grid grid-cols-3 gap-5">
				<div className="flex w-22 flex-col gap-2">
					<UploadTile
						aria-label="添加图片"
						busy={state === "busy"}
						disabled={state === "disabled"}
						dragActive={state === "drag" || dragActive}
						onClick={() => input.current?.click()}
						onDragOver={(event) => {
							event.preventDefault();
							setDragActive(true);
						}}
						onDragLeave={() => setDragActive(false)}
						onDrop={(event) => {
							event.preventDefault();
							setDragActive(false);
							setSelected(event.dataTransfer.files[0]?.name ?? "尚未选择图片");
						}}
					/>
					<span className="text-xs text-muted-foreground">默认入口</span>
				</div>
				<div className="flex w-22 flex-col gap-2">
					<UploadTile
						dragActive
						aria-label="松开添加图片"
						onClick={() => input.current?.click()}
					/>
					<span className="text-xs text-muted-foreground">拖到上面</span>
				</div>
				<div className="flex w-22 flex-col gap-2">
					<UploadTile busy aria-label="正在上传图片" />
					<span className="text-xs text-muted-foreground">上传中</span>
				</div>
				<div className="flex w-22 flex-col gap-2">
					<UploadTile disabled aria-label="图片已达上限" title="最多添加 4 张图片" />
					<span className="text-xs text-muted-foreground">已达上限</span>
				</div>
			</div>
			<output className="max-w-80 truncate text-xs text-muted-foreground" aria-live="polite">
				{selected}
			</output>
		</div>
	);
}

export const uploadTileExhibit: Exhibit = {
	id: "upload-tile",
	name: "上传格",
	units: ["upload-tile"],
	zone: "shelf",
	category: "form",
	footprint: { width: 360, height: 300 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "drag", label: "拖入" },
		{ id: "busy", label: "忙碌" },
		{ id: "disabled", label: "禁用" },
	],
	Render: UploadTiles,
};
