import type { MediaCatalogSource } from "@entities/media/api/queries";
import type { MediaFile } from "@entities/media/model/types";
import { cn } from "cn";
import { ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { MediaPicker } from "./MediaPicker";

export interface AvatarPickerProps {
	/** 当前头像地址；空串表示未设置 */
	value: string;
	/** 选定素材回传原始 MediaFile（id/url 由调用方按需取用）；null 表示清除 */
	onChange: (file: MediaFile | null) => void;
	/** 头像块形状。账号类头像用 circle，角色/卡片类用 square。@default "circle" */
	shape?: "circle" | "square";
	/** 头像块尺寸类名，需自带宽高。@default "size-16" */
	sizeClassName?: string;
	/** 图片替代文本。@default "头像" */
	alt?: string;
	disabled?: boolean;
	/** 素材库弹窗标题。@default "选择头像" */
	pickerTitle?: string;
	/** 素材来源。@default "all" */
	source?: MediaCatalogSource;
	/**
	 * 紧凑形态：表格行内等小尺寸头像用。
	 *
	 * @remarks 角标随头像缩小，悬浮遮罩只压暗不显「更换」（小圆装不下两个字）。
	 * @default false
	 */
	compact?: boolean;
}

/**
 * 头像选择件：点头像块开素材库选图，悬浮遮罩提示更换，右上角角标清除。
 */
export function AvatarPicker({
	value,
	onChange,
	shape = "circle",
	sizeClassName = "size-16",
	alt = "头像",
	disabled = false,
	pickerTitle = "选择头像",
	source = "all",
	compact = false,
}: AvatarPickerProps) {
	const [pickerOpen, setPickerOpen] = useState(false);
	const rounded = shape === "square" ? "rounded-2xl" : "rounded-full";
	const choose = (files: MediaFile[]) => {
		const file = files.find((candidate) => candidate.mime_type.startsWith("image/"));
		if (file) onChange(file);
		setPickerOpen(false);
	};

	return (
		<>
			{/* 清除角标伸出边界，故外层只定位不裁剪，裁剪交给按钮自身 */}
			<div className={cn("group relative shrink-0", sizeClassName)}>
				<button
					type="button"
					disabled={disabled}
					aria-label={value ? "更换头像" : "选择头像"}
					onClick={() => setPickerOpen(true)}
					className={cn(
						"absolute inset-0 grid place-items-center overflow-hidden border border-edge-hairline bg-muted/45 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
						rounded,
					)}
				>
					{value ? (
						<img
							src={value}
							alt={alt}
							className={cn("size-full object-cover", rounded)}
						/>
					) : (
						<ImagePlus className="size-4 text-muted-foreground" />
					)}
					{value && !disabled ? (
						<span
							className={cn(
								"absolute inset-0 grid place-items-center bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100",
								rounded,
							)}
						>
							{compact ? null : "更换"}
						</span>
					) : null}
				</button>
				{value && !disabled ? (
					<button
						type="button"
						aria-label="移除头像"
						onClick={() => onChange(null)}
						className={cn(
							"absolute z-10 grid place-items-center rounded-full bg-destructive text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							compact ? "-top-0.5 -right-0.5 size-3.5" : "-top-1 -right-1 size-5",
						)}
					>
						<X className={compact ? "size-2" : "size-3"} />
					</button>
				) : null}
			</div>

			<MediaPicker
				open={pickerOpen}
				onOpenChange={setPickerOpen}
				onConfirm={choose}
				mediaType="image"
				source={source}
				title={pickerTitle}
			/>
		</>
	);
}
