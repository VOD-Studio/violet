/**
 * AnnotationLayer - 正文批注角标 + 气泡面板。
 *
 * 角标方案（番茄小说段评式）：角标作为段落最后一个字后面的 inline-block 元素，
 * 直接 append 到块级元素 DOM 末尾（不脱离文档流，自然随段落流动）。
 * 读者读到段末自然看到角标，视线无需跳到段外。
 *
 * 面板方案：点击角标展开批注列表面板，fixed 钉视口右侧（2xl+）或居中（lg 以下），
 * 不占文档流、不挤压正文。
 *
 * AnnotationLayer 也负责给批注块加高亮 class（视觉标记「这段有批注」）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { findBlockElement } from "../lib/extract-blocks";
import type { CandidateBlock } from "../lib/relocate";
import type { LocatedAnnotation } from "../lib/use-annotations";
import { AnnotationCard } from "./AnnotationCard";

/** 高亮块的 class（背景 + 左色条） */
const HIGHLIGHT_CLASS = "annotation-highlight";
/** 注入到段落 DOM 末尾的角标元素 class */
const MARKER_CLASS = "annotation-marker-inline";
/** 角标 dataset key 存 blockId（用于点击时反查） */
const MARKER_DATA_BLOCKID = "data-annotation-blockid";
/**
 * STICKY_TOP_PX 面板粘性钉视口时的 top 偏移（与顶部阅读进度条/导航栏留白）。
 * 当角标向上滚出视口、其 rect.top 小于此值时，面板从「跟随角标」切换为「钉住」。
 */
const STICKY_TOP_PX = 96;

/** 单个批注块（仅记录 React 渲染所需的最小数据） */
interface BlockMarker {
    id: string; // blockId
    annotations: LocatedAnnotation[];
    element: HTMLElement;
}

export interface AnnotationLayerProps {
    /** 正文容器 ref */
    contentRef: React.RefObject<HTMLElement | null>;
    /** located 批注（来自 useAnnotations） */
    located: LocatedAnnotation[];
    /** 候选块列表（保留 prop，暂未直接消费） */
    blocks: CandidateBlock[];
    /** 滚动激活回调（保留兼容，气泡方案下可空） */
    onActiveChange?: (commentId: string | null) => void;
}

export function AnnotationLayer({ contentRef, located, blocks }: AnnotationLayerProps) {
    const [, forceRender] = useState(0);
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
    const [panelVisible, setPanelVisible] = useState(false);
    /** 面板当前 top（视口坐标，px）。null 表示用默认 sticky 顶部。 */
    const [panelTop, setPanelTop] = useState<number | null>(null);
    /** markers 仅存数据（用于面板渲染查找），角标本身是 DOM 注入的不进 React 树 */
    const markersRef = useRef<BlockMarker[]>([]);

    void blocks; // 保留 prop 兼容，本期未直接消费

    // 1. 按 blockId 分组批注 + 找对应 DOM 元素 + 注入角标 + 加高亮 class。
    // biome-ignore lint/correctness/useExhaustiveDependencies: handleMarkerClickById 是 stable 的 ref 函数（useCallback 无 deps），effect 故意依赖 [contentRef, located, currentUserId]
    useEffect(() => {
        const root = contentRef.current;
        if (!root) {
            markersRef.current = [];
            forceRender((n) => n + 1);
            return;
        }

        // 清理旧角标 + 旧高亮
        root.querySelectorAll(`.${MARKER_CLASS}`).forEach((el) => {
            el.remove();
        });
        root.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
            el.classList.remove(HIGHLIGHT_CLASS);
        });

        if (located.length === 0) {
            markersRef.current = [];
            forceRender((n) => n + 1);
            return;
        }

        let cancelled = false;
        (async () => {
            // 按 blockId 分组
            const groupByBlock = new Map<string, LocatedAnnotation[]>();
            for (const ann of located) {
                const list = groupByBlock.get(ann.result.blockId) ?? [];
                list.push(ann);
                groupByBlock.set(ann.result.blockId, list);
            }

            const next: BlockMarker[] = [];
            for (const [blockId, anns] of groupByBlock) {
                if (cancelled) return;
                const el = await findBlockElement(root, blockId);
                if (el && !cancelled) {
                    el.classList.add(HIGHLIGHT_CLASS);

                    // 注入角标到段落末尾
                    const marker = document.createElement("button");
                    marker.className = MARKER_CLASS;
                    marker.setAttribute(MARKER_DATA_BLOCKID, blockId);
                    marker.setAttribute("aria-label", `${anns.length} 条批注`);
                    marker.title = `${anns.length} 条批注`;
                    marker.type = "button";
                    marker.innerHTML = renderMarkerIcon(anns.length);
                    marker.addEventListener("click", (e) => {
                        e.stopPropagation();
                        handleMarkerClickById(blockId);
                    });
                    el.appendChild(marker);

                    next.push({ id: blockId, annotations: anns, element: el });
                }
            }
            if (cancelled) return;
            markersRef.current = next;
            forceRender((n) => n + 1);
        })();

        return () => {
            cancelled = true;
            // 卸载时清理注入的角标
            root.querySelectorAll(`.${MARKER_CLASS}`).forEach((el) => {
                el.remove();
            });
        };
    }, [contentRef, located]);

    /** 点击角标：展开/收起面板。展开瞬间把面板顶部对齐到角标水平线。 */
    const handleMarkerClickById = useCallback((blockId: string) => {
        setActiveBlockId((cur) => {
            const next = cur === blockId ? null : blockId;
            setPanelVisible(next !== null);
            // 初次展开：面板 top 跟随角标（同一水平线）；收起时复位为 null。
            if (next !== null) {
                const marker = markersRef.current.find((m) => m.id === next);
                const markerEl = marker?.element.querySelector(`.${MARKER_CLASS}`);
                if (markerEl) {
                    const rect = markerEl.getBoundingClientRect();
                    // 角标在视口上方已滚出 → 直接钉 sticky；否则对齐角标顶部。
                    setPanelTop(rect.top > STICKY_TOP_PX ? rect.top : STICKY_TOP_PX);
                }
            } else {
                setPanelTop(null);
            }
            return next;
        });
    }, []);

    // 滚动跟随：角标在视口内时面板 top 跟角标同水平线；
    // 角标滚到 STICKY_TOP_PX 以上（即将滚出顶部）时面板粘性钉住；
    // 角标滚出视口底部时面板也粘性钉住（避免面板跟着飞下去）。
    // 用 rAF 节流，避免 scroll 高频触发 setState。
    useEffect(() => {
        if (!activeBlockId || !panelVisible) return;
        const marker = markersRef.current.find((m) => m.id === activeBlockId);
        const markerEl = marker?.element.querySelector(`.${MARKER_CLASS}`);
        if (!markerEl) return;

        let rafId = 0;
        const update = () => {
            rafId = 0;
            const rect = markerEl.getBoundingClientRect();
            // 角标顶部相对视口的 y。角标在视口内（>STICKY_TOP_PX）→ 跟随；否则钉 sticky。
            // 角标完全滚出底部（rect.bottom < 0 不可能，因为角标在段落末尾；这里只关心顶部）
            setPanelTop(rect.top > STICKY_TOP_PX ? rect.top : STICKY_TOP_PX);
        };
        const onScroll = () => {
            if (rafId === 0) rafId = requestAnimationFrame(update);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        update(); // 立即同步一次，避免首帧闪烁
        return () => {
            window.removeEventListener("scroll", onScroll);
            if (rafId !== 0) cancelAnimationFrame(rafId);
        };
    }, [activeBlockId, panelVisible]);

    // 当前展开的批注组
    const activeMarker = activeBlockId
        ? markersRef.current.find((m) => m.id === activeBlockId)
        : null;

    return (
        <>
            {/* 批注列表面板：点角标后展开。
                定位策略（与角标同水平线起跳 + 顶部粘性）：
                  - panelTop 状态由滚动监听更新：角标 rect.top > STICKY_TOP_PX 时跟随角标顶部；
                    角标滚到 STICKY_TOP_PX 以上时钉住，避免面板跟着滚出视口。
                  - 2xl+ 钉右侧空白区（right-4），lg 以下居中（translate-x-1/2）。
                  - top 用 inline style（优先级覆盖 Tailwind 断点），左右用 Tailwind 断点。 */}
            {activeMarker && panelVisible && (
                <div
                    style={{ top: panelTop ?? STICKY_TOP_PX }}
                    className={
                        "fixed z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-edge-hairline bg-card p-3 shadow-xl " +
                        "2xl:right-4 2xl:left-auto 2xl:translate-x-0 " +
                        "left-1/2 -translate-x-1/2"
                    }
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                            {activeMarker.annotations.length} 条批注
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveBlockId(null);
                                setPanelVisible(false);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="关闭"
                        >
                            ×
                        </button>
                    </div>
                    {activeMarker.annotations.map((ann) => (
                        <AnnotationCard
                            key={ann.comment.id}
                            comment={ann.comment}
                            selectedText={ann.result.selectedText}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

/**
 * renderMarkerIcon 生成段评角标 SVG（chat-bubble 风格）：
 *   - 对话气泡外形：圆角矩形 + 左下角直角三角尾巴（一体描边 path，颜色 currentColor）
 *   - 评论数居中：超过 99 显示「99+」；数字字号随位数自适应（保证不溢出气泡）
 *
 * 整体设计原则：比文字略大（1.15em）、低对比、行内紧贴段末、配色统一。
 * 返回 HTML 字符串供 DOM 注入（角标不是 React 组件，是 innerHTML）。
 */
function renderMarkerIcon(count: number): string {
    // 评论数显示文本：超过 99 显示 99+
    const label = count > 99 ? "99+" : String(count);
    // 数字字号随位数自适应：1 位数最大，2 位数中，3 位（99+）最小，避免溢出气泡
    const fontSize = label.length >= 3 ? 5 : label.length === 2 ? 6 : 7;

    const stroke = "currentColor";
    const sw = 1.1; // 描边粗细
    // 对话气泡外形 path（圆角矩形 + 左下直角三角尾巴，一体绘制）：
    //   气泡主体：x 0.5→15.5，y 2→11.5，圆角 3.5
    //   尾巴：从底边 (5,11.5) 经 (5.5,11.5) 下伸到 (4,14.5) 形成左下直角三角形
    const bubblePath =
        "M4 2 H12 A3.5 3.5 0 0 1 15.5 5.5 V8 A3.5 3.5 0 0 1 12 11.5 H7.5 L4 14.5 L4.5 11.5 H4 A3.5 3.5 0 0 1 0.5 8 V5.5 A3.5 3.5 0 0 1 4 2 Z";
    const bubble = `<path d="${bubblePath}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" />`;
    // 评论数居中（与描边同色）
    const countText = `<text x="8" y="6.8" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="600" fill="${stroke}">${label}</text>`;

    return `<svg class="annotation-marker-svg" viewBox="-1 -3 18 19" aria-hidden="true">
        ${bubble}
        ${countText}
    </svg>`;
}

export default AnnotationLayer;
