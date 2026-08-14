import { cn } from "@shared/lib/utils";
import type { ReactNode } from "react";

interface SectionCardProps {
	title: string;
	/** 标题下方的弱化说明行，可选 */
	description?: string;
	/** 卡片右上角动作区（如「修改」按钮），可选 */
	action?: ReactNode;
	children: ReactNode;
	className?: string;
}

/**
 * SectionCard - 个人中心卡片壳
 *
 * 统一五张卡片的标题层级与间距节奏：标题（text-base font-semibold）+
 * 可选描述行（muted）+ 可选右上动作，内容区由各卡片自行组织。
 */
export const SectionCard = ({
	title,
	description,
	action,
	children,
	className,
}: SectionCardProps) => {
	return (
		<div className={cn("rounded-xl border bg-card p-6 shadow-sm", className)}>
			<div className="mb-5 flex items-start justify-between gap-4">
				<div className="min-w-0">
					<h2 className="text-base font-semibold">{title}</h2>
					{description && (
						<p className="mt-1 text-sm text-muted-foreground">{description}</p>
					)}
				</div>
				{action && <div className="shrink-0">{action}</div>}
			</div>
			{children}
		</div>
	);
};
