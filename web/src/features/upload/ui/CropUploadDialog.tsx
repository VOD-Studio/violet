import { withCrop } from "@shared/lib/crop-url";
import { CropPreview } from "@shared/ui/image-cropper/CropPreview";
import { ImageCropper } from "@shared/ui/image-cropper/ImageCropper";
import { Button, Modal } from "@violet/ui";
import { TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useChunkedUpload } from "@/features/upload/hooks/use-chunked-upload";
import { type CropRect, cropImageToBlob } from "@/features/upload/lib/crop-image";

export type CropUploadResult =
	| { kind: "static"; url: string } // 静态图:重编码上传,URL 干净
	| { kind: "gif"; url: string }; // GIF:原 URL + ?crop=,保留动画

/** 弹窗里的取景预览：按选区实时渲染，展示在不同展示框里的样子。 */
export interface CropPreviewSpec {
	label: string;
	/** 展示框宽高比（宽 ÷ 高） */
	aspect: number;
	/** 圆形预览（头像） */
	round?: boolean;
}

export interface CropUploadDialogProps {
	/** 本地新选文件(头像/素材库上传场景);与 srcUrl 二选一 */
	file?: File;
	/** 已有素材 URL(封面选择场景,静态图会重新裁剪上传);与 file 二选一 */
	srcUrl?: string;
	/** 选区宽高比;undefined 自由(素材库) */
	aspect?: number;
	/** 上传用途,透传 useChunkedUpload */
	purpose: "avatar" | "cover" | "material";
	/** 上传后文件名(静态图扩展名按 webp 定) */
	fileNameBase?: string;
	/** 弹窗标题；缺省按 GIF / 静态图给通用标题 */
	title?: string;
	/** 标题下的一句说明 */
	description?: string;
	/** 确认按钮文案 */
	confirmLabel?: string;
	/** 取景预览；仅在有选区时显示 */
	previews?: readonly CropPreviewSpec[];
	/** 静态图输出宽度上限(px)，超过则等比缩小后上传 */
	outputMaxWidth?: number;
	/** 选区原图像素宽度低于该值时提示分辨率偏低 */
	minSelectionWidth?: number;
	/** 选区面积占原图比例低于该值时提示比例差异大（锁定比例时才有意义） */
	minSelectionShare?: number;
	open: boolean;
	onOpenChange: (v: boolean) => void;
	onConfirm: (result: CropUploadResult) => void | Promise<void>;
}

/**
 * CropUploadDialog - 选区上传编排弹窗。
 *
 * 两种图片来源:
 * - file(本地新选):GIF 需上传原图拿 url 再拼坐标
 * - srcUrl(已有素材):GIF 直接用该 url 拼坐标(无需上传)
 *
 * 判定 GIF 分流:
 * - 静态图:canvas 重编码 WebP → useChunkedUpload 上传,真裁剪
 * - GIF:拼 ?crop= 坐标,保留动画(不重编码)
 *
 * 依赖方向:features/upload → shared/ui(image-cropper/modal),合法。
 */
export function CropUploadDialog({
	file,
	srcUrl,
	aspect,
	purpose,
	fileNameBase = "cropped",
	title,
	description,
	confirmLabel = "确认",
	previews,
	outputMaxWidth,
	minSelectionWidth,
	minSelectionShare,
	open,
	onOpenChange,
	onConfirm,
}: CropUploadDialogProps) {
	const [rect, setRect] = useState<CropRect | undefined>(undefined);
	const [busy, setBusy] = useState(false);
	const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | undefined>();
	const { uploadFile } = useChunkedUpload({ purpose });

	const [previewSrc, setPreviewSrc] = useState(srcUrl ?? "");
	const isGif =
		file?.type === "image/gif" || srcUrl?.split("?")[0].toLowerCase().endsWith(".gif");

	useEffect(() => {
		if (!file) {
			setPreviewSrc(srcUrl ?? "");
			return;
		}
		const objectUrl = URL.createObjectURL(file);
		setPreviewSrc(objectUrl);
		return () => URL.revokeObjectURL(objectUrl);
	}, [file, srcUrl]);

	const handleConfirm = useCallback(async () => {
		if (!previewSrc) {
			toast.error("缺少待裁剪图片");
			return;
		}
		setBusy(true);
		try {
			if (isGif) {
				// GIF:不重编码。本地文件需先上传拿 url,已有 srcUrl 直接用
				let url = srcUrl;
				if (file) {
					const result = await uploadFile(file);
					url = result.url;
				}
				if (!url) throw new Error("GIF 上传未返回 URL");
				await onConfirm(
					rect ? { kind: "gif", url: withCrop(url, rect) } : { kind: "gif", url },
				);
			} else if (rect) {
				// 静态图有选区:canvas 重编码 WebP 上传
				const blob = await cropImageToBlob(previewSrc, rect, 0.9, outputMaxWidth);
				const croppedFile = new File([blob], `${fileNameBase}.webp`, {
					type: "image/webp",
				});
				const result = await uploadFile(croppedFile);
				await onConfirm({ kind: "static", url: result.url });
			} else if (file) {
				// 无选区:直接上传原文件
				const result = await uploadFile(file);
				await onConfirm({ kind: "static", url: result.url });
			} else if (srcUrl) {
				// 已有素材无选区:直接用原 URL
				await onConfirm({ kind: "static", url: srcUrl });
			}
			onOpenChange(false);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "上传失败");
		} finally {
			setBusy(false);
		}
	}, [
		previewSrc,
		rect,
		isGif,
		file,
		srcUrl,
		fileNameBase,
		outputMaxWidth,
		uploadFile,
		onConfirm,
		onOpenChange,
	]);

	const selectionPx =
		rect && naturalSize
			? { w: Math.round(rect.w * naturalSize.w), h: Math.round(rect.h * naturalSize.h) }
			: undefined;
	const smallShare =
		!!(rect && minSelectionShare && aspect !== undefined) &&
		rect.w * rect.h < (minSelectionShare ?? 0);
	const lowResolution = !!(selectionPx && minSelectionWidth && selectionPx.w < minSelectionWidth);

	return (
		<Modal
			open={open}
			onOpenChange={(nextOpen) => {
				if (!busy) onOpenChange(nextOpen);
			}}
			title={title ?? (isGif ? "选取显示区域" : "裁剪图片")}
			description={
				description ?? (isGif ? "GIF 保留动画，选区只决定显示哪一部分" : undefined)
			}
			size="lg"
			footer={
				<div className="flex w-full items-center gap-3">
					<p
						className={
							lowResolution
								? "mr-auto flex min-w-0 items-center gap-1.5 text-xs text-warning"
								: "mr-auto min-w-0 truncate text-xs text-muted-foreground tabular-nums"
						}
					>
						{lowResolution && <TriangleAlert className="size-3.5 shrink-0" />}
						{selectionPx
							? lowResolution
								? `选区仅 ${selectionPx.w}×${selectionPx.h}px，在大屏上可能偏糊`
								: `选区 ${selectionPx.w}×${selectionPx.h}px`
							: null}
					</p>
					<Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
						取消
					</Button>
					{rect && aspect === undefined && (
						<Button variant="ghost" onClick={() => setRect(undefined)} disabled={busy}>
							清除选区
						</Button>
					)}
					<Button onClick={handleConfirm} disabled={busy}>
						{busy ? "处理中..." : confirmLabel}
					</Button>
				</div>
			}
		>
			{previewSrc ? (
				<div className="flex flex-col gap-4">
					<div className="rounded-xl bg-muted/40 p-3 ring-1 ring-border ring-inset">
						<ImageCropper
							src={previewSrc}
							aspect={aspect}
							rect={rect}
							onChange={setRect}
							onImageSize={setNaturalSize}
						/>
					</div>
					{smallShare && rect && (
						<p className="flex items-start gap-1.5 text-xs text-muted-foreground">
							<TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
							选区只占原图的 {Math.round(rect.w * rect.h * 100)}%
							，这张图比例与横幅差别较大，可换一张更宽的图，或不设封面、使用头像背景。
						</p>
					)}
					{previews && previews.length > 0 && (
						<div className="flex flex-col gap-2">
							<span className="text-xs font-medium text-muted-foreground">
								取景预览
							</span>
							<div className="flex items-end gap-4">
								{previews.map((preview) => (
									<figure
										key={preview.label}
										className="flex min-w-0 flex-col gap-1.5"
										style={{
											flex: preview.round ? "0 0 4rem" : preview.aspect,
										}}
									>
										<CropPreview
											src={previewSrc}
											rect={rect}
											aspect={preview.aspect}
											round={preview.round}
										/>
										<figcaption className="text-center text-xs text-muted-foreground">
											{preview.label}
										</figcaption>
									</figure>
								))}
							</div>
						</div>
					)}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">无可用图片源</p>
			)}
		</Modal>
	);
}
