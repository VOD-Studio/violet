import type { PersonaSaveState } from "@features/persona-editor/model/types";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

interface PersonaSaveIndicatorProps {
	state: PersonaSaveState;
}

/** 编辑器当前保存状态的紧凑可访问提示。 */
export function PersonaSaveIndicator({ state }: PersonaSaveIndicatorProps) {
	if (state === "saving") {
		return (
			<span
				className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
				role="status"
			>
				<Loader2 className="size-3.5 animate-spin" />
				正在保存
			</span>
		);
	}
	if (state === "saved") {
		return (
			<span
				className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
				role="status"
			>
				<Check className="size-3.5" />
				已保存
			</span>
		);
	}
	return (
		<span
			className={
				state === "dirty"
					? "inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"
					: "inline-flex items-center gap-1.5 text-xs text-destructive"
			}
			role="status"
		>
			<AlertTriangle className="size-3.5" />
			{state === "dirty" ? "有未保存修改" : state === "conflict" ? "版本冲突" : "保存失败"}
		</span>
	);
}
