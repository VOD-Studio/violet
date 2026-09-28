/**
 * LibraryGuideToc - 营造法式指南页右侧页内目录（feature 私有）
 *
 * 形态对标组件文档站：正文右栏 sticky 目录轨，h2/h3 两级缩进，
 * 当前阅读节随滚动高亮（scrollspy 纯高亮，不涉及动效，减弱动态无影响）。
 * xl 以下整栏隐藏（hidden xl:block），不挤压正文可读宽度。
 *
 * 注册协议：Markdown 正文组件（markdown-guide.tsx）渲染完成后把
 * { items, bodyRef } 经 GuideTocContext 上报给 LibraryGuidePage，
 * 页面据此切换「正文 + 目录」双栏布局；JSX 指南不上报，布局零变化。
 */
import { useActiveHeading } from "@shared/hooks/use-toc";
import { cn } from "cn";
import { createContext, type ReactNode, type RefObject, useContext } from "react";

/** 目录条目：从渲染后的正文容器提取的 h2/h3 */
export interface GuideTocItem {
	/** 标题层级 */
	level: 2 | 3;
	/** 标题纯文本 */
	text: string;
	/** 标题锚点 id（渲染管线内由项目统一 Slugger 生成） */
	id: string;
}

/** 一次目录注册：条目列表 + 正文容器 ref（scrollspy 监听目标） */
export interface GuideTocRegistration {
	items: GuideTocItem[];
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

interface LibraryGuideTocProps {
	/** 目录条目（空数组时整栏不渲染） */
	items: GuideTocItem[];
	/** 正文容器 ref，用于滚动高亮定位 */
	bodyRef: RefObject<HTMLElement | null>;
	/** 附加类名 */
	className?: string;
}

/**
 * 指南页右侧页内目录：sticky 目录轨 + scrollspy 高亮。
 *
 * 视觉约束：链接 hover 只变色；无卡片容器、无缩放动效。
 */
export function LibraryGuideToc({ items, bodyRef, className }: LibraryGuideTocProps) {
	const activeId = useActiveHeading(bodyRef);

	if (items.length === 0) return null;

	return (
		<nav aria-label="页内目录" className={cn("hidden w-56 shrink-0 xl:block", className)}>
			<div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-8">
				<p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground">目录</p>
				<ul className="border-l border-border/60">
					{items.map((item) => {
						const active = item.id === activeId;
						return (
							<li key={item.id}>
								<a
									href={`#${item.id}`}
									aria-current={active ? "location" : undefined}
									className={cn(
										"-ml-px block border-l-2 py-1.5 pr-2 text-xs leading-5 transition-colors",
										item.level === 2 ? "pl-3" : "pl-7",
										active
											? "border-primary font-medium text-foreground"
											: "border-transparent text-muted-foreground hover:text-foreground",
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
