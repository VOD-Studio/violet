import {
    Children,
    cloneElement,
    isValidElement,
    type ReactElement,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from "react";
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/base/tooltip";

interface CellWithTooltipProps {
    /** 单元格内容 */
    children: ReactNode;
    /** tooltip 文本，提供即开启；省略号截断时自动用 children 文本兜底 */
    tooltip?: string;
    /** 开启省略号截断 */
    ellipsis?: boolean;
}

/**
 * 从 React 节点中递归提取纯文本，用于无显式 tooltip 时的省略号兜底提示。
 */
function extractText(node: ReactNode): string {
    if (node == null) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractText).join("");
    if (isValidElement(node)) {
        const element = node as ReactElement<{ children?: ReactNode }>;
        return extractText(element.props.children);
    }
    return "";
}

/**
 * 检测元素内容是否溢出容器。
 * 挂载及尺寸变化时比较 scrollWidth 与 clientWidth。
 */
function useOverflow<T extends HTMLElement>(onOverflow: (overflowing: boolean) => void) {
    const ref = useRef<T>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const check = () => {
            onOverflow(element.scrollWidth > element.clientWidth);
        };
        check();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(check);
            observer.observe(element);
            return () => observer.disconnect();
        }
    }, [onOverflow]);

    return ref;
}

/**
 * 文本节点测量包装器，用于无显式 tooltip 时判断是否需要兜底提示。
 */
function TextMeasure({
    children,
    onOverflow,
}: {
    children: string;
    onOverflow: (overflowing: boolean) => void;
}) {
    const ref = useOverflow<HTMLSpanElement>(onOverflow);
    return <span ref={ref}>{children}</span>;
}

/**
 * 单一 React 元素测量包装器：追加截断类名并监听溢出状态。
 * 用于 button 等自定义 cell，使其内部文本显示省略号的同时能检测到真实溢出。
 */
function ElementMeasure({
    children,
    onOverflow,
}: {
    children: ReactElement<{ className?: string }>;
    onOverflow: (overflowing: boolean) => void;
}) {
    const ref = useOverflow<HTMLElement>(onOverflow);
    return cloneElement(children, {
        ref,
        className: cn(children.props.className, "min-w-0 max-w-full truncate"),
    } as Record<string, unknown>);
}

/**
 * 将子节点包装为可测量溢出的形式。
 * - 单一有效 React 元素：追加截断类名并挂载 ref
 * - 文本/数字：包入测量 span
 * - 其他：保持原样，由外层 span 兜底截断
 */
function wrapMeasurableChild(
    child: ReactNode,
    onOverflow: (overflowing: boolean) => void,
): ReactNode {
    const onlyChild = Children.only(child);
    if (isValidElement(onlyChild)) {
        return (
            <ElementMeasure onOverflow={onOverflow}>
                {onlyChild as ReactElement<{ className?: string }>}
            </ElementMeasure>
        );
    }
    if (typeof onlyChild === "string" || typeof onlyChild === "number") {
        return <TextMeasure onOverflow={onOverflow}>{String(onlyChild)}</TextMeasure>;
    }
    return child;
}

/**
 * CellWithTooltip - 单元格内容 + 悬停 tooltip
 *
 * ellipsis 开启时内容单行截断，悬停显示 tooltip。
 * 显式提供 tooltip 时始终显示；未提供时仅在内容真实溢出时显示，避免文字已完整展示仍弹提示。
 */
export function CellWithTooltip({ children, tooltip, ellipsis }: CellWithTooltipProps) {
    const textContent = extractText(children);
    const autoTip = ellipsis ? textContent : undefined;
    const tip = tooltip ?? autoTip;
    const hasTip = tip != null && tip !== "";

    const [overflowing, setOverflowing] = useState(false);
    const showTooltip = hasTip && (tooltip != null || overflowing);

    if (!ellipsis) {
        if (!showTooltip) return children;
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline cursor-default">{children}</span>
                </TooltipTrigger>
                <TooltipContent side="top" align="center" sideOffset={6}>
                    {tip}
                </TooltipContent>
            </Tooltip>
        );
    }

    let content: ReactNode;
    try {
        content = wrapMeasurableChild(children, setOverflowing);
    } catch {
        // Children.only 失败时回退到原样渲染
        content = children;
    }

    return (
        <span className="block min-w-0 truncate">
            {showTooltip ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="inline min-w-0 cursor-default align-bottom">
                            {content}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" sideOffset={6}>
                        {tip}
                    </TooltipContent>
                </Tooltip>
            ) : (
                content
            )}
        </span>
    );
}
