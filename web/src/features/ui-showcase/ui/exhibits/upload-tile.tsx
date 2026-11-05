import { UploadTile } from "@violet/ui";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

function UploadTiles({ state }: ExhibitRenderProps) {
	return (
		<div className="grid grid-cols-3 gap-3">
			<UploadTile
				aria-label="添加图片"
				busy={state === "busy"}
				disabled={state === "disabled"}
			/>
			<UploadTile busy>处理中</UploadTile>
			<UploadTile disabled>不可用</UploadTile>
		</div>
	);
}

export const uploadTileExhibit: Exhibit = {
	id: "upload-tile",
	name: "上传格",
	units: ["upload-tile"],
	zone: "shelf",
	category: "form",
	footprint: { width: 312, height: 96 },
	states: [
		{ id: "default", label: "默认" },
		{ id: "busy", label: "忙碌" },
		{ id: "disabled", label: "禁用" },
	],
	Render: UploadTiles,
};
