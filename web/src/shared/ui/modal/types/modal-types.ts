import type { ReactNode } from "react";

/**
 * Modal 统一尺寸档位
 *
 * 收敛散落的任意 max-w 值（历史里的 sm:max-w-[500px]/sm:max-w-105/2xl 等）。
 * 值为 Tailwind 任意值写法（项目 Tailwind v4 支持任意数字值）。
 */
export const MODAL_SIZES = {
    /** 小：约 28rem（448px），确认框、简单表单 */
    sm: "sm:max-w-[28rem]",
    /** 中：约 32rem（512px），默认值，多数表单 */
    md: "sm:max-w-[32rem]",
    /** 大：约 42rem（672px），权限树等较宽内容 */
    lg: "sm:max-w-[42rem]",
    /** 超大：约 56rem（896px），表情管理等复杂场景 */
    xl: "sm:max-w-[56rem]",
} as const;

/** 尺寸档位类型 */
export type ModalSize = keyof typeof MODAL_SIZES;

/**
 * ModalProps - 统一 Modal 组件 props
 */
export interface ModalProps {
    /** 受控开关 */
    open: boolean;
    onOpenChange: (open: boolean) => void;

    /** 标题（字符串或自定义节点）。复杂场景可省略自行在 children 渲染 */
    title?: ReactNode;
    /** 副标题/说明 */
    description?: ReactNode;
    /** 中间内容（默认自动可滚）。逃生场景可放任意自定义布局 */
    children?: ReactNode;

    /**
     * 底部操作区。固定在底部、不随内容滚。
     * - 标准：传按钮（submit 按钮用 form={id} 关联到 children 里的 form）。
     * - 无底部：传 null（复杂场景如 Tabs/lightbox）。
     */
    footer?: ReactNode | null;

    /** 尺寸档位，默认 md */
    size?: ModalSize;
    /** 右上角关闭按钮，默认 true */
    showCloseButton?: boolean;
    /**
     * 无样式逃生口：去掉 padding/border/bg，children 完全自管布局。
     * 给 MediaLightbox 这种 lightbox 场景用。
     */
    unstyled?: boolean;
    /**
     * 中间内容区是否自动滚动，默认 true。
     * 设为 false 时内容区为 overflow-hidden（不自动滚），由 children 自管滚动——
     * 给 EmojiManage 这种内部 Tabs 各自滚动的场景用。
     */
    scrollable?: boolean;
    /** 标题是否仅屏幕阅读器可见（lightbox a11y），默认 false */
    titleSrOnly?: boolean;

    /** Radix Root 的 modal（默认 true） */
    modal?: boolean;
    /** 透传 Radix Content 的 onEscapeKeyDown */
    onEscapeKeyDown?: (e: KeyboardEvent) => void;
    /** 透传 Radix Content 的 onInteractOutside */
    onInteractOutside?: (e: Event) => void;
    /** 透传到内容容器的额外 className（lightbox 自定义 max-w/背景等） */
    className?: string;
}
