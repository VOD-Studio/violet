/**
 * 文档目录的双栏排版与视觉适配；标题提取、定位和滚动跟踪复用共享 TOC 能力。
 */
import {
	extractDomToc,
	handleTocLinkClick,
	type TocItem,
	useTocNavigation,
} from "@shared/hooks/use-toc";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import {
	createContext,
	type ReactNode,
	type RefObject,
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useNaturalAnchorTop } from "../model/use-natural-anchor-top";

/** 一次目录注册：条目列表 + 正文容器 ref（scrollspy 监听目标） */
export interface GuideTocRegistration {
	items: TocItem[];
	bodyRef: RefObject<HTMLElement | null>;
}

/** 上报目录；传 null 表示当前指南没有页内目录（卸载 / 无标题） */
export type RegisterGuideToc = (registration: GuideTocRegistration | null) => void;

const GuideTocContext = createContext<RegisterGuideToc | null>(null);

/** 上下文缺席时的稳定空实现：MarkdownGuideDoc 在页面外（测试/预览）挂载也不报错 */
const noopRegister: RegisterGuideToc = () => {};

/**
 * 供正文组件上报目录的注册器。
 *
 * @returns 当前注册函数；无 Provider 时返回稳定 no-op
 */
export function useGuideTocRegistrar(): RegisterGuideToc {
	return useContext(GuideTocContext) ?? noopRegister;
}

/**
 * 目录注册作用域。onRegister 必须引用稳定（useCallback），
 * 注册在正文挂载的 layout effect 中触发，依赖此稳定性避免循环。
 */
export function GuideTocProvider({
	onRegister,
	children,
}: {
	onRegister: RegisterGuideToc;
	children: ReactNode;
}) {
	return <GuideTocContext.Provider value={onRegister}>{children}</GuideTocContext.Provider>;
}

/**
 * 统一从渲染后的正文容器登记目录，混排 JSX 和 Markdown 的页面也能覆盖全部标题。
 *
 * @param contentKey - 正文切换时触发重新提取
 */
export function GuideTocContent({
	children,
	contentKey,
}: {
	children: ReactNode;
	contentKey?: string;
}) {
	const registerToc = useGuideTocRegistrar();
	const bodyRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: contentKey 变更代表正文 DOM 已重渲染，需重新采集标题
	useLayoutEffect(() => {
		const el = bodyRef.current;
		if (!el) return;
		const items = extractDomToc(el);
		registerToc(items.length ? { items, bodyRef } : null);
		return () => registerToc(null);
	}, [contentKey, registerToc]);

	return (
		<div ref={bodyRef} className="[&_h2]:scroll-mt-20 [&_h3]:scroll-mt-20 [&_h4]:scroll-mt-20">
			{children}
		</div>
	);
}

/**
 * 「正文 + 右侧目录」双栏布局骨架，供指南页与文档型卷页复用。
 *
 * 正文组件经 GuideTocContext 上报目录后切换双栏：双栏区域左缘锚定在
 * 无目录时 max-w-4xl 居中版心的左缘，目录出现时版心零位移、可用宽度
 * 只向右生长；无目录（或 xl 以下目录隐藏）回落单栏，排版不变。
 */
export function GuideTocLayout({ children }: { children: ReactNode }) {
	const [toc, setToc] = useState<GuideTocRegistration | null>(null);
	const contentAnchor = useNaturalAnchorTop<HTMLDivElement>();
	const registerToc = useCallback((registration: GuideTocRegistration | null) => {
		setToc(registration);
	}, []);
	const hasToc = toc !== null && toc.items.length > 0;
	return (
		<GuideTocProvider onRegister={registerToc}>
			<div
				className={
					hasToc
						? // 左缘 = max(0, (容器宽-56rem)/2)（即 mx-auto max-w-4xl 的左缘），
							// 宽 = min(剩余宽度, 56rem 正文 + 2.5rem 间距 + 14rem 目录)
							"ml-[max(0px,calc((100%_-_56rem)/2))] w-[min(calc(100%_-_max(0px,calc((100%_-_56rem)/2))),72.5rem)]"
						: "mx-auto w-full max-w-4xl"
				}
			>
				{hasToc ? (
					<div className="flex gap-10">
						<div className="min-w-0 max-w-4xl flex-1" ref={contentAnchor.ref}>
							{children}
						</div>
						<LibraryGuideToc
							anchorTop={contentAnchor.top}
							items={toc.items}
							bodyRef={toc.bodyRef}
						/>
					</div>
				) : (
					children
				)}
			</div>
		</GuideTocProvider>
	);
}

interface LibraryGuideTocProps {
	/** 目录条目（空数组时整栏不渲染） */
	items: TocItem[];
	/** 正文容器 ref，用于滚动高亮定位 */
	bodyRef: RefObject<HTMLElement | null>;
	/** 附加类名 */
	className?: string;
	/** 同排正文列的文档顶位：目录吸附位与之对齐，初始即贴住 */
	anchorTop: number | null;
}

/**
 * 指南页右侧目录：标题跟踪与定位由共享 hook 处理；这里仅决定显示形态。
 */
export function LibraryGuideToc({ items, bodyRef, className, anchorTop }: LibraryGuideTocProps) {
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
