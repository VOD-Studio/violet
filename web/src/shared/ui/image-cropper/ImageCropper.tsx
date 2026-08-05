import { useCallback, useEffect, useState } from "react";
import ReactCrop, { type Crop, type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { CropRect } from "./types";

export interface ImageCropperProps {
	/** 图片源(object URL 或远程 URL) */
	src: string;
	/** 选区宽高比;undefined 为自由比例(可拖拽拉伸) */
	aspect?: number;
	/** 当前选区(受控);父组件设为 undefined 可清除选区 */
	rect?: CropRect | undefined;
	/** 选区变化回调(归一化坐标 0~1) */
	onChange: (rect: CropRect | undefined) => void;
}

/**
 * ImageCropper - 基于 react-image-crop 的选区交互组件。
 *
 * 图片完整显示,用户拖拽选区框(8 个手柄)缩放/移动选区。
 * 输出归一化 CropRect(0~1):react-image-crop 的 percentCrop 本就是 0~100,
 * 除以 100 即归一化,无需图片自然尺寸。
 *
 * 选区清除:父组件将 rect 设为 undefined,内部同步清除 react-image-crop 选区。
 */
export function ImageCropper({ src, aspect, rect, onChange }: ImageCropperProps) {
	const [crop, setCrop] = useState<Crop>();

	// aspect 变化时清空已有选区,避免比例对不上
	useEffect(() => {
		if (aspect !== undefined) {
			setCrop(undefined);
		}
	}, [aspect]);

	// 父组件设 rect 为 undefined 时清除内部选区
	useEffect(() => {
		if (rect === undefined) {
			setCrop(undefined);
		}
	}, [rect]);

	const handleComplete = useCallback(
		(_px: unknown, percent: PercentCrop) => {
			if (percent.width === 0 || percent.height === 0) {
				onChange(undefined);
				return;
			}
			onChange({
				x: percent.x / 100,
				y: percent.y / 100,
				w: percent.width / 100,
				h: percent.height / 100,
			});
		},
		[onChange],
	);

	return (
		// ReactCrop 是 display:inline-block 会收缩到图片宽度并左对齐,
		// 外层用 flex 居中让裁剪区在容器里水平居中,避免窄图贴左留大片空白。
		<div className="flex w-full justify-center">
			<ReactCrop
				crop={crop}
				onChange={(_, percentCrop) => setCrop(percentCrop)}
				onComplete={handleComplete}
				aspect={aspect}
				keepSelection
			>
				<img
					src={src}
					alt="待裁剪"
					crossOrigin="anonymous"
					style={{ maxHeight: "60vh", maxWidth: "100%" }}
				/>
			</ReactCrop>
		</div>
	);
}
