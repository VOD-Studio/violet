import { Button, CodeBlock } from "@violet/ui";
import { cn } from "cn";
import { useFilePreviewVariant } from "@/shared/ui/file-preview/file-preview-context";
import { useCodeSource } from "../hooks/useCodeSource";
import type { CodePreviewProps } from "../types/code-preview-types";
import { inferLanguage } from "../utils/language";

export function CodePreview({ url, name, language, className }: CodePreviewProps) {
	const { source, loadStatus, retry } = useCodeSource(url);
	const viewer = useFilePreviewVariant() === "viewer";
	return (
		<div
			className={cn(
				"min-h-0 overflow-auto rounded-xl",
				viewer ? "flex-1" : "max-h-[70vh]",
				className,
			)}
		>
			{loadStatus === "ready" ? (
				<CodeBlock
					code={source}
					language={language || inferLanguage(name)}
					filename={viewer ? undefined : name}
					collapseLines={0}
				/>
			) : loadStatus === "error" ? (
				<div
					role="alert"
					className="flex min-h-40 flex-col items-center justify-center gap-2 bg-secondary text-muted-foreground"
				>
					<span>代码加载失败</span>
					<Button type="button" variant="outline" size="sm" onClick={retry}>
						重试
					</Button>
				</div>
			) : (
				<div
					role="status"
					className="flex min-h-32 items-center justify-center bg-secondary text-muted-foreground"
				>
					加载代码…
				</div>
			)}
		</div>
	);
}
