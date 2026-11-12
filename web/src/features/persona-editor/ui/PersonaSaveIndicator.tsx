import type { PersonaSaveState } from "@features/persona-editor/model/types";
import { iconProps, Spinner } from "@violet/ui";
import { Check, TriangleAlert } from "lucide-react";

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
				<Spinner size={16} aria-hidden="true" />
				正在保存
			</span>
		);
	}
	if (state === "saved") {
		return (
			<span
				className="inline-flex items-center gap-1 text-xs text-muted-foreground"
				role="status"
			>
				<Check {...iconProps(14)} />
				已保存
			</span>
		);
	}
	return (
		<span
			className={
				state === "dirty"
					? "inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
					: "inline-flex items-center gap-1 text-xs text-destructive"
			}
			role="status"
		>
			<TriangleAlert {...iconProps(14)} />
			{state === "dirty" ? "有未保存修改" : state === "conflict" ? "版本冲突" : "保存失败"}
		</span>
	);
}
