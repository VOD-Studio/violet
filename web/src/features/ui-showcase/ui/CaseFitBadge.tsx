import { cn } from "cn";
import { Check, MoveHorizontal, TriangleAlert } from "lucide-react";
import type { CaseFit } from "../hooks/use-case-fit";

const FIT = {
	ok: { label: "完整", Icon: Check, className: "text-success" },
	scroll: { label: "需横向滑动", Icon: MoveHorizontal, className: "text-link" },
	overflow: { label: "溢出", Icon: TriangleAlert, className: "text-destructive" },
} as const;

/** 裁切检查结果；纸片底，放在深色台座上也保持可读。 */
export function CaseFitBadge({ fit, className }: { fit: CaseFit; className?: string }) {
	const { label, Icon, className: tone } = FIT[fit];
	return (
		<span
			data-fit={fit}
			className={cn("inline-flex h-6 items-center rounded-full bg-card px-2", className)}
		>
			{/* 字号与语义色分开写：cn 会把自定义字号 text-12 当成颜色与 tone 合并掉 */}
			<span className={`inline-flex items-center gap-1 text-12 whitespace-nowrap ${tone}`}>
				<Icon aria-hidden="true" className="size-3.5" />
				{label}
			</span>
		</span>
	);
}
