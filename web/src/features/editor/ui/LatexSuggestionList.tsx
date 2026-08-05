/**
 * LatexSuggestionList - LaTeX 补全建议下拉
 *
 * 候选命令列表：命令名 + 中文提示，高亮项由键盘导航决定，
 * 点击接受（onMouseDown 阻止 blur 保持输入框焦点）。
 */
import { cn } from "@/shared/lib/utils";
import type { LatexCommand } from "../lib/latex-commands";

export interface LatexSuggestionListProps {
	/** 当前候选命令（已过滤、前缀优先） */
	candidates: LatexCommand[];
	/** 键盘导航高亮下标 */
	activeIndex: number;
	/** 点击接受某条候选 */
	onSelect: (command: LatexCommand) => void;
}

export function LatexSuggestionList({
	candidates,
	activeIndex,
	onSelect,
}: LatexSuggestionListProps) {
	return (
		<ul className="max-h-48 overflow-auto rounded-md border border-edge-hairline bg-popover py-1">
			{candidates.map((cmd, i) => (
				<li key={cmd.name}>
					<button
						type="button"
						// 保持输入框焦点，点击不 blur
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => onSelect(cmd)}
						className={cn(
							"flex w-full items-baseline justify-between gap-3 px-2 py-1 text-left",
							i === activeIndex && "bg-accent",
						)}
					>
						<span className="font-mono text-xs">{cmd.name}</span>
						<span className="shrink-0 text-muted-foreground text-xs">{cmd.hint}</span>
					</button>
				</li>
			))}
		</ul>
	);
}
