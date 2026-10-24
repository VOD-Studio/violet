/** 图表完成 Mermaid 与 Inkline 后整体显示，失败保留源码并提供恢复入口。 */

import { EnhancementFailure } from "@shared/ui/deferred-content/DeferredContent";
import { cn } from "cn";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { subscribeThemeRerender } from "@/shared/lib/theme-rerender";
import { CodeCard } from "@/shared/ui/code-preview/components/CodeCard";
import { DiagramFullscreen } from "./DiagramFullscreen";
import { DiagramPlaceholder } from "./DiagramPlaceholder";
import { DiagramViewport } from "./DiagramViewport";
import { extractDiagramLabel } from "./label";
import type { DiagramTheme, RenderMermaidResult } from "./render-mermaid";
import { renderMermaid } from "./render-mermaid";

/**
 * 阅读端图块的原始内容。
 *
 * @remarks source 不接受预渲染 HTML；净化与手绘处理均在渲染管线中完成。
 */
export interface DiagramBlockProps {
	/** 图表格式（首期仅 "mermaid"，预留多格式） */
	format: string;
	/** mermaid 源码（来自 data-source，已 HTML 反转义） */
	source: string;
}

/** 读当前站点主题：<html>.classList 含 dark → dark，否则 light（SSR 安全兜底 light） */
function readCurrentTheme(): DiagramTheme {
	if (typeof document === "undefined") return "light";
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

interface DiagramErrorProps extends DiagramBlockProps {
	cause: unknown;
	onRetry: () => void;
}

function DiagramError({ format, source, cause, onRetry }: DiagramErrorProps) {
	return (
		<>
			<CodeCard code={source} language={format} collapseLines={0} />
			<EnhancementFailure
				error={cause}
				message="图表渲染失败，源码仍可阅读。"
				onRetry={onRetry}
				retryLabel="重试图表"
			/>
		</>
	);
}

/**
 * 展示完整手绘图表，并在局部失败时提供源码与恢复入口。
 *
 * @remarks 调用方在近视口后加载本组件；主题重绘保留上一帧，离开视口不卸载结果。
 * 新渲染或卸载取消旧任务的等待，过期结果不会覆盖当前图表。
 */
export function DiagramBlock({ format, source }: DiagramBlockProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const hostRef = useRef<HTMLDivElement>(null);
	const pendingRender = useRef<AbortController | null>(null);
	/** 全屏打开前保存焦点元素，关闭后回归（PRD 焦点管理） */
	const fullscreenTriggerRef = useRef<HTMLElement | null>(null);
	const [fullscreen, setFullscreen] = useState(false);
	const [result, setResult] = useState<RenderMermaidResult | null>(null);
	/**
	 * 是否已至少成功渲染过一次。
	 * - 区分首加载（result===null && !hasRendered → 显示占位）与主题切换重渲染
	 *   （result===null 但容器内保留旧帧，不显示占位，保留连续视觉）。
	 * - 首次成功挂上后保持 true，fade-in 动画类同帧挂载后永驻：主题切换 result
	 *   进出 null 不会重新挂载类，动画不重播。
	 */
	const [hasRendered, setHasRendered] = useState(false);
	/** 当前 SVG 对应的主题（首渲染取当前主题；之后由主题订阅驱动更新） */
	const themeRef = useRef<DiagramTheme>(readCurrentTheme());
	/** 渲染序号：每渲一次递增，旧序号结果丢弃（防竞态写入过期 SVG） */
	const renderSeqRef = useRef(0);

	// 渲染：source 变化或主题切换时重新 renderMermaid，清理后 SVG 写入容器。
	// 不清空 containerRef：重渲染（主题切换）时保留上一帧 SVG，新 SVG 就绪后覆盖，
	// 避免切主题瞬间整块变白。
	const doRender = useCallback(
		async (t: DiagramTheme) => {
			pendingRender.current?.abort();
			const controller = new AbortController();
			pendingRender.current = controller;
			const seq = ++renderSeqRef.current;
			setResult(null);
			try {
				const r = await renderMermaid(source, t, {
					element: hostRef.current,
					signal: controller.signal,
				});
				if (seq !== renderSeqRef.current || controller.signal.aborted) return;
				setResult(r);
				if ("svg" in r) {
					setHasRendered(true);
				}
			} catch (error) {
				if (!controller.signal.aborted) {
					setResult({
						error: error instanceof Error ? error.message : String(error),
						cause: error,
					});
				}
			}
		},
		[source],
	);
	// 失败态会卸载画布；重试后等待画布重新挂载，再提交已完成且净化过的 SVG，不在此计算图表。
	useLayoutEffect(() => {
		if (result && "svg" in result && containerRef.current) {
			containerRef.current.innerHTML = result.svg;
		}
	}, [result]);

	// 首渲染与 source 变化（用当前主题）
	useEffect(() => {
		void doRender(themeRef.current);
		return () => {
			pendingRender.current?.abort();
			renderSeqRef.current++;
		};
	}, [doRender]);

	// 主题跟随：mermaid 颜色烘焙进 SVG，切主题必须重新 render。
	// 各自治 MutationObserver 会让重渲落在 VT 动画期间，DOM 写入与动画互相放大
	// （实测 VT finished 从 ~500ms 拖到 9.5s）。改注册到 theme-rerender 表，
	// 由主题切换的 VT update 回调统一 await——VT 等重渲完才捕获新帧，
	// 动画期间 DOM 零变化（对齐 rua.plus 的 U/Be 模式）。
	useEffect(
		() =>
			subscribeThemeRerender(async (next) => {
				if (next === themeRef.current) return;
				themeRef.current = next;
				await doRender(next);
			}),
		[doRender],
	);

	const initialLoading = result === null && !hasRendered;
	const errored = result !== null && !("svg" in result);

	// 复制源码：剪贴板 API 不可用（非安全上下文等）时静默降级，不阻塞渲染
	const [copied, setCopied] = useState(false);
	const copySource = async () => {
		try {
			await navigator.clipboard.writeText(source);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			// 剪贴板不可用，忽略
		}
	};

	// 容器结构全程稳定：加载与加载完用同一 DOM，仅内容填充不同。
	// 根容器 block 布局：失败态 CodeCard 在 block 里自然 w-full（不被 flex
	// 收缩为内容宽度）。成功态 DiagramViewport + 居中 wrapper 在块级里仍居中。
	// data-type 与编辑器节点载体同名：批注的 UNANNOTATABLE_SELECTOR 靠它拦截；
	// select-none 使图内文字（SVG text / foreignObject HTML）不可选，从源头
	// 消除划线批注选区与拖拽时的误选。
	return (
		<div ref={hostRef} className="relative my-6" data-type="diagram-block">
			{errored ? null : (
				<div className="flex justify-center">
					<DiagramViewport
						onCopySource={copySource}
						copied={copied}
						exportSvg={result && "svg" in result ? result.svg : undefined}
						onFullscreen={() => {
							fullscreenTriggerRef.current =
								(document.activeElement as HTMLElement) ?? null;
							setFullscreen(true);
						}}
					>
						<div
							ref={containerRef}
							className={cn(
								"flex min-h-64 w-full min-w-max select-none justify-center",
								hasRendered && "motion-safe:animate-diagram-enter",
							)}
							role="img"
							aria-label={extractDiagramLabel(source)}
						/>
					</DiagramViewport>
				</div>
			)}
			{initialLoading ? <DiagramPlaceholder className="absolute inset-0" /> : null}
			{errored ? (
				<DiagramError
					format={format}
					source={source}
					cause={result.cause}
					onRetry={() => void doRender(themeRef.current)}
				/>
			) : null}
			<AnimatePresence>
				{fullscreen && result && "svg" in result ? (
					<DiagramFullscreen
						svg={result.svg}
						label={extractDiagramLabel(source)}
						onClose={() => setFullscreen(false)}
						triggerRef={fullscreenTriggerRef}
					/>
				) : null}
			</AnimatePresence>
		</div>
	);
}
