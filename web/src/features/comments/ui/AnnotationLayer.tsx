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
    /** 当前登录用户 id（用于判断「我是否评论过该段」→ 角标右上角对号） */
    currentUserId?: string;
    /** 滚动激活回调（保留兼容，气泡方案下可空） */
    onActiveChange?: (commentId: string | null) => void;
}

export function AnnotationLayer({
    contentRef,
    located,
    blocks,
    currentUserId,
}: AnnotationLayerProps) {
    const [, forceRender] = useState(0);
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
    const [panelVisible, setPanelVisible] = useState(false);
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
                    // 「我是否评论过该段」：后端 CommentDTO 无 created_by/is_mine 字段，
                    // 用「该块有 status=pending 的评论」近似（pending 一定是当前用户的，
                    // 因为 ListByPost 只返回 approved ∪ 自己的 pending）。
                    // 契约缺口：approved 后无法判断，待后端补 is_mine 字段后精确化。
                    const hasMine = currentUserId
                        ? anns.some((a) => a.comment.status === "pending")
                        : false;
                    marker.innerHTML = renderMarkerIcon(anns.length, hasMine);
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
    }, [contentRef, located, currentUserId]);

    /** 点击角标：展开/收起面板 */
    const handleMarkerClickById = useCallback((blockId: string) => {
        setActiveBlockId((cur) => {
            const next = cur === blockId ? null : blockId;
            setPanelVisible(next !== null);
            return next;
        });
    }, []);

    // 当前展开的批注组
    const activeMarker = activeBlockId
        ? markersRef.current.find((m) => m.id === activeBlockId)
        : null;

    return (
        <>
            {/* 批注列表面板：点角标后展开。
                2xl+ 钉视口右侧（right-4 top-24），浮在正文右侧空白区，不占文档流、不挤压文本；
                lg 以下居中弹窗（右侧无空白区）。fixed 相对视口，滚动不需重新定位。 */}
            {activeMarker && panelVisible && (
                <div
                    className={
                        "fixed z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-lg border border-edge-hairline bg-card p-3 shadow-xl " +
                        "2xl:right-4 2xl:top-24 2xl:left-auto 2xl:translate-x-0 " +
                        "left-1/2 top-24 -translate-x-1/2"
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
 * renderMarkerIcon 生成段评角标 SVG（chat-bubble 风格，参考 Lucide chat-bubble-outline）：
 *   - 对话气泡外形：圆角矩形 + 左下角直角三角尾巴（一体描边 path，颜色 currentColor）
 *   - 评论数居中：超过 99 显示「99+」；数字字号随位数自适应（保证不溢出气泡）
 *   - hasMine=true 时右上角对号徽章：实心 currentColor 圆（配色与气泡描边统一），
 *     徽章外圈描页面背景色（mask 效果）把气泡右上角「咬掉一块」→ 视觉断开
 *
 * 整体设计原则：比文字略小（0.95em）、低对比、行内紧贴段末、配色统一。
 * 返回 HTML 字符串供 DOM 注入（角标不是 React 组件，是 innerHTML）。
 */
function renderMarkerIcon(count: number, hasMine: boolean): string {
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

    // 对号徽章：实心 currentColor 圆（配色与气泡描边一致），
    // 背景色描边（stroke-width 1.6）形成切口断开气泡边框，白色对号 path。
    const checkBadge = hasMine
        ? `<circle cx="14" cy="1.5" r="3.8" fill="none" stroke="${stroke}" stroke-width="1.1" />
           <path d="M12.3 1.5 L13.4 2.6 L15.7 0.3" stroke="${stroke}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" fill="none" />`
        : "";

    return `<svg class="annotation-marker-svg" viewBox="-1 -3 18 19" aria-hidden="true">
        ${bubble}
        ${countText}
        ${checkBadge}
    </svg>`;
}

export default AnnotationLayer;
