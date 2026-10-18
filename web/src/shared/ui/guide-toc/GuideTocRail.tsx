/**
 * 文档页右侧目录栏：标题跟踪与定位由共享 hook 处理；这里仅决定显示形态。
 */
import { handleTocLinkClick, type TocItem, useTocNavigation } from "@shared/hooks/use-toc";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

interface GuideTocRailProps {
	/** 目录条目（空数组时整栏不渲染） */
	items: TocItem[];
	/** 正文容器 ref，用于滚动高亮定位 */
	bodyRef: RefObject<HTMLElement | null>;
	/** 附加类名 */
	className?: string;
	/** 同排正文列的文档顶位：目录吸附位与之对齐，初始即贴住 */
	anchorTop: number | null;
}

export function GuideTocRail({ items, bodyRef, className, anchorTop }: GuideTocRailProps) {
	const { activeId, navigateTo } = useTocNavigation(bodyRef, items);
	const reduced = useReducedMotion();
	const railRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

	useEffect(() => {
		const body = bodyRef.current;
		const list = listRef.current;
		if (!body || !list) return;
		const rows = items
			.map((item) => ({
				heading: body.querySelector<HTMLElement>(`[id="${CSS.escape(item.id)}"]`),
				item: list.querySelector<HTMLAnchorElement>(
					`a[href="#${encodeURIComponent(item.id)}"]`,
				)?.parentElement,
			}))
			.filter((row): row is { heading: HTMLElement; item: HTMLLIElement } =>
				Boolean(row.heading && row.item),
			);

		// 竖线覆盖视口内可见的首个到最后一个标题；无可见标题时保留上一段范围
		const measure = () => {
			let first: HTMLLIElement | null = null;
			let last: HTMLLIElement | null = null;
			for (const { heading, item } of rows) {
				if (!heading) continue;
				const box = heading.getBoundingClientRect();
				if (box.bottom > 0 && box.top < window.innerHeight) {
					if (!first) first = item;
					last = item;
				}
			}
			if (first && last) {
				setIndicator({
					top: first.offsetTop,
					height: last.offsetTop + last.offsetHeight - first.offsetTop,
				});
			}
		};

		measure();
		let frame = 0;
		const schedule = () => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				measure();
			});
		};
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule, { passive: true });
		return () => {
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			if (frame) cancelAnimationFrame(frame);
		};
	}, [bodyRef, items]);

	useLayoutEffect(() => {
		if (!activeId) return;
		const rail = railRef.current;
		const active = listRef.current?.querySelector<HTMLElement>(
			`a[href="#${encodeURIComponent(activeId)}"]`,
		);
		if (!rail || !active) return;
		const railBox = rail.getBoundingClientRect();
		const activeBox = active.getBoundingClientRect();
		// 活动条目越过目录中线即提前滚至居中，向上滚出顶界也回滚
		if (activeBox.top < railBox.top || activeBox.bottom > railBox.top + railBox.height / 2) {
			rail.scrollTo({
				top: rail.scrollTop + activeBox.top - railBox.top - railBox.height / 2,
				behavior: reduced ? "instant" : "smooth",
			});
		}
	}, [activeId, reduced]);

	if (items.length === 0) return null;

	return (
		<nav
			aria-label="页内目录"
			className={cn("hidden w-56 shrink-0 flex-col xl:sticky xl:flex", className)}
			style={
				anchorTop === null
					? undefined
					: {
							top: anchorTop,
							maxHeight: `calc(100dvh - ${anchorTop}px - 2rem)`,
						}
			}
		>
			<p className="mb-3 flex-none text-xs font-medium tracking-wide text-muted-foreground">
				目录
			</p>
			<div ref={railRef} className="scrollbar-none min-h-0 flex-1 overflow-y-auto pb-8">
				<ul ref={listRef} className="relative border-l border-border/60">
					{indicator && (
						<span
							aria-hidden="true"
							className="pointer-events-none absolute top-0 -left-px w-0.5 bg-primary"
							style={{
								transform: `translateY(${indicator.top}px)`,
								height: indicator.height,
								transition: reduced
									? undefined
									: "transform var(--transition-feedback, 160ms ease-out), height var(--transition-feedback, 160ms ease-out)",
							}}
						/>
					)}
					{items.map((item) => {
						const active = item.id === activeId;
						return (
							<li key={item.id}>
								<a
									href={`#${encodeURIComponent(item.id)}`}
									onClick={(event) =>
										handleTocLinkClick(event, item.id, navigateTo)
									}
									aria-current={active ? "location" : undefined}
									className={cn(
										"block py-1.5 pr-2 text-xs leading-5 motion-safe:transition-colors",
										item.level === 2
											? "pl-3"
											: item.level === 3
												? "pl-7"
												: "pl-11",
										active
											? "font-medium text-foreground"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{item.text}
								</a>
							</li>
						);
					})}
				</ul>
			</div>
		</nav>
	);
}
