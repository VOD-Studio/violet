/**
 * 文档目录的双栏排版与视觉适配；标题提取、定位和滚动跟踪复用共享 TOC 能力。
 */

import { useNaturalAnchorTop } from "@shared/hooks/use-natural-anchor-top";
import { extractDomToc, type TocItem } from "@shared/hooks/use-toc";
import {
	createContext,
	type ReactNode,
	type RefObject,
	useCallback,
	useContext,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { GuideTocRail } from "./GuideTocRail";

/** 一次目录注册：条目列表 + 正文容器 ref（scrollspy 监听目标） */
export interface GuideTocRegistration {
	items: TocItem[];
	bodyRef: RefObject<HTMLElement | null>;
}

/** 上报目录；传 null 表示当前指南没有页内目录（卸载 / 无标题） */
export type RegisterGuideToc = (registration: GuideTocRegistration | null) => void;

const GuideTocContext = createContext<RegisterGuideToc | null>(null);

/** 上下文缺席时的稳定空实现：正文组件在页面外（测试/预览）挂载也不报错 */
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
 * 「正文 + 右侧目录」双栏布局骨架。
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
						<GuideTocRail
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
