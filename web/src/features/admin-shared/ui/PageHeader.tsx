import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";

export interface PageHeaderProps {
	title: string;
	description?: string;
	action?: {
		label: string;
		onClick: () => void;
	};
	className?: string;
}

/**
 * PageHeader - 后台页面头部
 *
 * 统一标题、描述与右上角操作按钮。
 */
export function PageHeader({ title, description, action, className }: PageHeaderProps) {
	return (
		<div
			className={cn(
				"mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
		>
			<div>
				<h2 className="font-mono text-xl font-bold tracking-tight">{title}</h2>
				{description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
			</div>
			{action ? <Button onClick={action.onClick}>{action.label}</Button> : null}
		</div>
	);
}
