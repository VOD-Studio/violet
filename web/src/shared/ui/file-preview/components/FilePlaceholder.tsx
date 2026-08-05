import { Download } from "lucide-react";
import { Button } from "@/shared/ui/base/button";
import { getFileInfo } from "../utils/mime-utils";

interface FilePlaceholderProps {
	/** 文件完整 URL */
	url: string;
	/** 文件名称 */
	name?: string;
	/** 文件 MIME 类型 */
	mimeType: string;
	/** 额外说明（如"此格式暂不支持预览"） */
	hint?: string;
	/** 自定义类名 */
	className?: string;
}

/**
 * 不可预览文件的占位展示
 * 显示图标、类型标签、说明和下载按钮
 */
export function FilePlaceholder({ url, name, mimeType, hint, className }: FilePlaceholderProps) {
	const { icon: Icon, label } = getFileInfo(mimeType, name);

	function handleDownload() {
		const a = document.createElement("a");
		a.href = url;
		a.download = name ?? "download";
		a.click();
	}

	return (
		<div className={`flex flex-col items-center justify-center gap-4 p-8 ${className ?? ""}`}>
			<div className="flex size-20 items-center justify-center rounded-2xl bg-muted">
				<Icon className="size-10 text-muted-foreground" />
			</div>
			<div className="text-center">
				<p className="text-sm font-medium">{label}</p>
				{name ? (
					<p className="mt-1 max-w-70 truncate text-xs text-muted-foreground">{name}</p>
				) : null}
				{hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
			</div>
			<Button variant="outline" size="sm" onClick={handleDownload}>
				<Download className="mr-1.5 size-3.5" />
				下载文件
			</Button>
		</div>
	);
}
