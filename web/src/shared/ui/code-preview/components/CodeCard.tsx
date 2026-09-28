/**
 * CodeCard - 静态代码展示卡（shiki 高亮 + 标题栏 + 复制按钮）
 *
 * 接受内联代码字符串渲染只读代码块，跨 feature 复用（文章正文 / 图块降级 /
 * MCP 接入示例 / SDK 文档 / 组件文档页演示）。外边距由调用方通过 className 控制。
 *
 * @remarks 走懒加载消费时与 shiki 高亮链同 chunk 拉取，不进宿主主包。
 */

import { cn } from "cn";
import { Check, ChevronDown, Copy } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { copyText } from "@/shared/lib/clipboard";
import codeScrollbar from "@/shared/ui/code-scrollbar.module.css";
import "../component-code.css";
import { useShikiHighlight } from "../use-shiki-highlight";

export interface CodeCardProps {
	/** 原始代码字符串 */
	code: string;
	/** shiki 语言 ID，未知传 text */
	language: string;
	/** 标题栏文案，缺省显示 language */
	title?: string;
	/** 根容器类名，控制外边距等布局属性 */
	className?: string;
	/**
	 * 高亮与配色主题。dark 恒深底 GitHub 风，light 恒浅底；
	 * 缺省为 auto：卡底走语义 token，token 颜色经 shiki 双主题输出
	 * light-dark() 随站点明暗由 CSS 切换。
	 */
	theme?: "dark" | "light";
	/** 显示 CSS counter 行号 */
	lineNumbers?: boolean;
	/**
	 * 自动折叠阈值，代码行数超过该值时默认收起并可展开，0 关闭折叠。
	 *
	 * @default 12
	 */
	collapseLines?: number;
	/** 标题栏上方的演示区内容 */
	children?: ReactNode;
}

/** 收起态可见高度，约展示 8 行代码 */
const COLLAPSED_HEIGHT_PX = 232;

/** 三种形态的部件配色类：dark/light 恒定配色，auto 随站点语义 token */
interface CardSkin {
	root: string;
	demoBorder: string;
	barBorder: string;
	title: string;
	copy: string;
	check: string;
	spin: string;
	fade: string;
	toggle: string;
	plain: string;
}

const SKINS: Record<"dark" | "light" | "auto", CardSkin> = {
	dark: {
		root: "code-card-dark group relative overflow-hidden rounded-lg border border-edge-hairline bg-[#24292e]",
		demoBorder: "border-white/10",
		barBorder: "border-white/10",
		title: "text-white/70",
		copy: "text-white/60 hover:bg-white/10 hover:text-white",
		check: "text-green-400",
		spin: "border-white/20 border-t-white",
		fade: "from-[#24292e] via-[#24292e]/90",
		toggle: "border-white/15 bg-[#24292e] text-white/85 hover:text-white",
		plain: "text-white/90",
	},
	light: {
		root: "code-card-light group relative overflow-hidden rounded-xl border border-slate-200 bg-white",
		demoBorder: "border-slate-200",
		barBorder: "border-slate-200",
		title: "text-slate-500",
		copy: "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
		check: "text-emerald-600",
		spin: "border-slate-300 border-t-slate-600",
		fade: "from-white via-white/90",
		toggle: "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
		plain: "text-slate-900",
	},
	auto: {
		root: "group relative overflow-hidden rounded-xl border border-border/60 bg-card",
		demoBorder: "border-border/60",
		barBorder: "border-border/60",
		title: "text-muted-foreground",
		copy: "text-muted-foreground hover:bg-muted hover:text-foreground",
		check: "text-success",
		spin: "border-muted-foreground/20 border-t-muted-foreground",
		fade: "from-card via-card/90",
		toggle: "border-border/70 bg-card text-foreground hover:bg-muted",
		plain: "text-foreground",
	},
};

/**
 * CodeCard - 静态代码展示卡
 *
 * @param props - 见 {@link CodeCardProps}
 */
export function CodeCard({
	code,
	language,
	title,
	className,
	theme,
	lineNumbers = false,
	collapseLines = 12,
	children,
}: CodeCardProps) {
	const skin = SKINS[theme ?? "auto"];
	const { html, loading } = useShikiHighlight(code, language, { theme });
	const [copied, setCopied] = useState(false);
	const shouldCollapse = collapseLines > 0 && code.split("\n").length > collapseLines;
	const [expanded, setExpanded] = useState(!shouldCollapse);
	const contentRef = useRef<HTMLDivElement>(null);
	const animationRef = useRef<Animation | null>(null);

	// 同实例换 code（消费方不换 key）时行数变化，需重算折叠初态
	useEffect(() => {
		setExpanded(!shouldCollapse);
	}, [shouldCollapse]);

	const toggleCollapsed = () => {
		const contentBox = contentRef.current;
		const nextOpen = !expanded;
		if (contentBox) {
			const from = contentBox.getBoundingClientRect().height;
			const to = nextOpen
				? Math.max(COLLAPSED_HEIGHT_PX, contentBox.scrollHeight)
				: COLLAPSED_HEIGHT_PX;
			animationRef.current?.cancel();
			if (from !== to && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
				const animation = contentBox.animate(
					[{ height: `${from}px` }, { height: `${to}px` }],
					{ duration: 260, easing: "ease-in-out" },
				);
				animationRef.current = animation;
				animation.onfinish = () => {
					if (animationRef.current === animation) animationRef.current = null;
				};
			}
		}
		setExpanded(nextOpen);
	};

	const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		const ok = await copyText(code);
		if (ok) {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} else {
			console.error("复制代码失败");
		}
	};

	return (
		<div className={cn(skin.root, className)}>
			{children && (
				<div
					className={cn(
						"flex min-h-24 items-center justify-center border-b px-6 py-5 sm:px-10",
						skin.demoBorder,
					)}
				>
					<div className="w-full max-w-2xl">{children}</div>
				</div>
			)}
			{/* 顶部：标题 + 复制按钮 */}
			<div
				className={cn(
					"flex items-center justify-between border-b px-3 py-1.5",
					skin.barBorder,
				)}
			>
				<span className={cn("font-mono text-xs", skin.title)}>
					{(title ?? language) || "text"}
				</span>
				<button
					type="button"
					onClick={handleCopy}
					className={cn(
						"flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
						skin.copy,
					)}
					title="复制代码"
				>
					{copied ? (
						<Check className={cn("size-3.5", skin.check)} />
					) : (
						<Copy className="size-3.5" />
					)}
					{copied ? "已复制" : "复制"}
				</button>
			</div>
			{/* 代码区：shiki 输出 <pre><code>；动画期间 WAAPI height 覆盖类，落位交给类切换 */}
			<div className="relative">
				<div
					ref={contentRef}
					className={cn(
						"relative overflow-hidden",
						!shouldCollapse || expanded ? "h-auto" : "h-58",
					)}
				>
					<div
						className={cn(
							codeScrollbar.scrollbar,
							"overflow-x-auto px-4 py-3 text-sm leading-relaxed",
							lineNumbers && "shiki-line-numbers",
							shouldCollapse && "pb-12",
						)}
					>
						{loading ? (
							<div className="flex h-24 items-center justify-center">
								<div
									className={cn(
										"size-5 animate-spin rounded-full border-2",
										skin.spin,
									)}
								/>
							</div>
						) : html ? (
							<div
								className="shiki-code [&_code]:font-mono! [&_code]:text-sm! [&_pre]:m-0! [&_pre]:bg-transparent! [&_pre]:p-0!"
								// biome-ignore lint/security/noDangerouslySetInnerHtml: shiki codeToHtml 对代码文本做 HTML 实体转义（<script> 渲染为 &#x3C;script&#x3E; 纯文本，实测无裸标签），输出属性仅 class/style/tabindex 受控集合，无 href/src/on*；代码块内容不可能注入可执行 HTML
								dangerouslySetInnerHTML={{ __html: html }}
							/>
						) : (
							// 高亮失败降级：纯文本
							<pre className={skin.plain}>
								<code>{code}</code>
							</pre>
						)}
					</div>
					{/* 收起态渐隐遮罩与卡底同色 */}
					{shouldCollapse && (
						<div
							aria-hidden="true"
							className={cn(
								"pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t to-transparent transition-opacity duration-200",
								skin.fade,
								expanded ? "opacity-0" : "opacity-100",
							)}
						/>
					)}
				</div>
				{shouldCollapse && (
					<button
						aria-expanded={expanded}
						className={cn(
							"absolute bottom-4 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border px-4 py-1.5 text-sm shadow-[0_4px_24px_rgba(0,0,0,0.05)] transition-colors",
							skin.toggle,
						)}
						onClick={toggleCollapsed}
						type="button"
					>
						<ChevronDown
							className={cn(
								"size-4 transition-transform duration-200",
								expanded && "rotate-180",
							)}
						/>
						{expanded ? "收起代码" : "展开代码"}
					</button>
				)}
			</div>
		</div>
	);
}
