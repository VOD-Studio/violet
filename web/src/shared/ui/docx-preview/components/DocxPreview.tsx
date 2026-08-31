/**
 * Word 文档预览主组件（docx-preview）
 *
 * 功能：
 * - .docx 高保真渲染（保留原始排版/样式）
 * - 加载/错误状态 + 重试
 * - 文档区可滚动，白底居中模拟纸张
 * - 下载
 *
 * 注意：仅支持 .docx（OOXML），老式二进制 .doc 不支持（由 FilePreview 占位）。
 */

import { Download } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/base/button";
import { useFilePreviewVariant } from "@/shared/ui/file-preview/file-preview-context";
import { useDocxRender } from "../hooks/useDocxRender";
import type { DocxPreviewProps } from "../types/docx-preview-types";
import { DocxOverlay } from "./DocxOverlay";

export function DocxPreview({ url, name, className }: DocxPreviewProps) {
	const { containerRef, loadStatus, retry } = useDocxRender({ url });
	const viewer = useFilePreviewVariant() === "viewer";

	function handleDownload() {
		const a = document.createElement("a");
		a.href = url;
		a.download = name ?? "document.docx";
		a.click();
	}

	return (
		<div
			className={`flex flex-col overflow-hidden rounded-lg border bg-background ${className ?? ""}`}
		>
			{!viewer ? (
				<div className="flex items-center justify-between border-b px-3 py-1.5">
					<span className="truncate text-xs text-muted-foreground">
						{name ?? "Word 文档"}
					</span>
					<Button
						type="button"
						size="icon-sm"
						variant="ghost"
						onClick={handleDownload}
						title="下载"
					>
						<Download className="size-3.5" />
					</Button>
				</div>
			) : null}

			<div
				className={cn(
					"max-h-[70vh] overflow-auto bg-muted/30 p-4",
					viewer && "max-h-none flex-1",
				)}
			>
				{loadStatus !== "ready" ? (
					<DocxOverlay loadStatus={loadStatus} onRetry={retry} />
				) : null}
				<div
					ref={containerRef}
					className="mx-auto bg-white shadow-md [&_.docx]:mx-auto [&_.docx]:bg-white"
				/>
			</div>
		</div>
	);
}
