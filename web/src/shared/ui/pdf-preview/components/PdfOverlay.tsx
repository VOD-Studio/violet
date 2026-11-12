/**
 * PDF 加载/错误遮罩
 */

import { Button, iconProps } from "@violet/ui";
import { CircleAlert, RotateCcw } from "lucide-react";

import type { PdfLoadStatus } from "../types/pdf-preview-types";

interface PdfOverlayProps {
	loadStatus: PdfLoadStatus;
	onRetry: () => void;
}

export function PdfOverlay({ loadStatus, onRetry }: PdfOverlayProps) {
	if (loadStatus === "loading") {
		return (
			<div className="flex h-80 items-center justify-center">
				<div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
			</div>
		);
	}

	if (loadStatus === "error") {
		return (
			<div className="flex h-80 flex-col items-center justify-center gap-3 text-muted-foreground">
				<CircleAlert className="size-6 text-red-500" />
				<p className="text-sm">PDF 加载失败</p>
				<Button type="button" variant="outline" size="sm" onClick={onRetry}>
					<RotateCcw {...iconProps(14)} />
					重试
				</Button>
			</div>
		);
	}

	return null;
}
