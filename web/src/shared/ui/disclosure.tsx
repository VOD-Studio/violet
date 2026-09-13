import { cn } from "@shared/lib/utils";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";

interface DisclosureProps {
	/** 折叠行标题，可携带状态色等自定义节点 */
	label: ReactNode;
	/** 标题右侧的次要摘要，弱化显示并随行截断 */
	hint?: ReactNode;
	/** 非受控初始展开态，缺省收起 */
	defaultOpen?: boolean;
	/** 根元素附加类；字号等继承性样式在此覆盖（如 text-xs） */
	className?: string;
	/** 内容区附加类（间距、布局） */
	contentClassName?: string;
	children: ReactNode;
}

/**
 * Disclosure - 折叠区块
 *
 * 摘要行是完整可点行（hover 底色 + focus ring + 旋转箭头），展开/收起走
 * grid-rows 0fr↔1fr 高度过渡（同 NavMenuGroupItem / OAuthProviderCard 先例），
 * 开合不跳布局；visibility 随过渡切换，收起后内容不可聚焦。
 * 按钮与内容统一 px-2 内缩，盒子不越出组件边界，放入任何 overflow-hidden
 * 容器（卡片、日志条目）都不会被裁切。data-state 暴露开合态供测试断言。
 */
export function Disclosure({
	label,
	hint,
	defaultOpen = false,
	className,
	contentClassName,
	children,
}: DisclosureProps) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div className={cn("min-w-0 text-sm", className)} data-state={open ? "open" : "closed"}>
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
				className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left font-medium transition-colors hover:bg-accent/60 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
			>
				<ChevronRight
					className={cn(
						"size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
						open && "rotate-90",
					)}
					aria-hidden="true"
				/>
				<span className="min-w-0 truncate">{label}</span>
				{hint && (
					<span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
						{hint}
					</span>
				)}
			</button>
			<div
				className={cn(
					"grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none",
					open
						? "grid-rows-[1fr] opacity-100 visible"
						: "grid-rows-[0fr] opacity-0 invisible",
				)}
			>
				<div className="min-h-0 overflow-hidden">
					<div className={cn("px-2 pt-2 pb-1", contentClassName)}>{children}</div>
				</div>
			</div>
		</div>
	);
}
