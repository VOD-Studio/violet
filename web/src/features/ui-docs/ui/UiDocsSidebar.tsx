import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { UI_DOCS_NAV_GROUPS } from "../model/navigation";

/** 当前页面与移动目录关闭回调。 */
export interface UiDocsSidebarProps {
	currentPath: string;
	/** 链接激活后通知移动导航收起目录。 */
	onNavigate?: () => void;
	className?: string;
}

export function UiDocsSidebar({ currentPath, onNavigate, className }: UiDocsSidebarProps) {
	const normalized = currentPath.replace(/\/$/, "");
	const linkClass = (active: boolean) =>
		cn(
			"block rounded-md px-3 py-2 text-sm motion-safe:transition-colors",
			active
				? "bg-accent font-medium text-foreground"
				: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
		);

	return (
		<nav aria-label="组件库文档目录" className={cn("space-y-6", className)}>
			<div className="px-3">
				<p className="text-lg font-semibold text-foreground">violet/ui</p>
				<p className="mt-1 text-xs text-muted-foreground">React 组件库文档</p>
			</div>
			{UI_DOCS_NAV_GROUPS.map((group) => (
				<section key={group.id} className="space-y-2">
					<h2 className="px-3 text-xs font-semibold text-foreground">{group.title}</h2>
					<ul className="space-y-0.5">
						{group.items.map((item) => (
							<li key={item.id}>
								<Link
									to={item.to}
									onClick={onNavigate}
									aria-current={item.to === normalized ? "page" : undefined}
									className={linkClass(item.to === normalized)}
								>
									{item.title}
								</Link>
								{item.children && (
									<ul className="ml-3 border-l border-border pl-2">
										{item.children.map((child) => (
											<li key={child.id}>
												<Link
													to={child.to}
													onClick={onNavigate}
													aria-current={
														child.to === normalized ? "page" : undefined
													}
													className={linkClass(child.to === normalized)}
												>
													{child.title}
												</Link>
											</li>
										))}
									</ul>
								)}
							</li>
						))}
					</ul>
				</section>
			))}
		</nav>
	);
}
