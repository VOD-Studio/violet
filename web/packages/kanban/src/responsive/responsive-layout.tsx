import {
	type HTMLAttributes,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";

/** 容器宽度小于它（px）算窄屏：大致是平板竖屏与手机的分界。 */
export const DEFAULT_NARROW_BREAKPOINT = 768;

/** 当前用的是哪一份内容。 */
export type ResponsiveLayoutKind = "wide" | "narrow";

/** `ResponsiveLayout` 的属性；其余 `div` 属性落在根节点。 */
export interface ResponsiveLayoutProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
	/**
	 * 宽屏内容。容器宽度不小于阈值时渲染；服务端渲染与客户端水合的首次渲染也是它，
	 * 量到宽度后立即换成该用的那份。
	 */
	children: ReactNode;
	/** 窄屏内容。 */
	narrow: ReactNode;
	/**
	 * 阈值（px）：容器宽度小于它算窄屏。
	 * @default 768
	 */
	breakpoint?: number;
	/** 用的内容变化时调用，首次量到宽度后若是窄屏也会调用一次。 */
	onLayoutChange?: (layout: ResponsiveLayoutKind) => void;
}

/**
 * 按自身宽度二选一渲染：宽屏内容（通常是画布里的看板）或窄屏内容（通常是 `layout="switcher"` 的看板）。
 *
 * 量的是这个容器的宽度而不是窗口，所以放在侧栏或弹窗里也对。两份内容不会同时挂载，
 * 切换会让内容重新挂载，需要延续的状态（选中、显示的列）请由使用方持有并作为受控属性传入。
 * 页面滚动条随布局出现又消失、恰好让宽度跨过阈值时会来回切换，给页面设 `scrollbar-gutter: stable` 即可避免。
 */
export function ResponsiveLayout({
	children,
	narrow,
	breakpoint = DEFAULT_NARROW_BREAKPOINT,
	onLayoutChange,
	className,
	...rest
}: ResponsiveLayoutProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [layout, setLayout] = useState<ResponsiveLayoutKind>("wide");
	const latest = useRef(onLayoutChange);
	latest.current = onLayoutChange;

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const measure = () => {
			// 容器不可见（display: none）时宽度为 0，不是真的窄：保持现状
			const width = element.offsetWidth;
			if (width > 0) setLayout(width < breakpoint ? "narrow" : "wide");
		};
		measure();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [breakpoint]);

	const previous = useRef<ResponsiveLayoutKind>("wide");
	useEffect(() => {
		if (previous.current === layout) return;
		previous.current = layout;
		latest.current?.(layout);
	}, [layout]);

	return (
		<div
			ref={ref}
			className={className ? `v-kanban-responsive ${className}` : "v-kanban-responsive"}
			data-layout={layout}
			{...rest}
		>
			{layout === "narrow" ? narrow : children}
		</div>
	);
}
