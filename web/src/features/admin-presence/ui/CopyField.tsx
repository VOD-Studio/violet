import { Button } from "@violet/ui";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { copyText } from "@/shared/lib/clipboard";

/**
 * 只读的等宽值与复制按钮，用于上报地址与设备凭证。
 */
export function CopyField({ label, value }: { label: string; value: string }) {
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		if (await copyText(value)) {
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		} else {
			toast.error("复制失败，请手动选择文本");
		}
	};
	return (
		<div className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/60 py-1 pr-1 pl-3">
			<code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground select-all">
				{value}
			</code>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				aria-label={`复制${label}`}
				onClick={copy}
				className="shrink-0"
			>
				{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
			</Button>
		</div>
	);
}
