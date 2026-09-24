import type { ComponentPropsWithoutRef, ReactNode, RefObject } from "react";

/**
 * 期望对齐方向与对齐方式
 */
export type CartoonPopoverSide = "top" | "bottom" | "left" | "right";
export type CartoonPopoverAlign = "start" | "center" | "end";

/**
 * 触发方式：
 * - click: 仅点击触发
 * - hover: 仅鼠标悬停触发
 * - both: 点击与悬停均可触发
 */
export type CartoonTriggerMode = "click" | "hover" | "both";

/**
 * 卡通气泡形态风格：
 * - speech: 经典漫画对白气泡（带平滑三角形小尾巴）
 * - sticker: 卡通贴纸气泡（无尾巴，饱满圆角）
 */
export type CartoonBubbleStyle = "speech" | "sticker";

/**
 * 卡通色彩变体
 */
export type CartoonBubbleVariant = "default" | "brand" | "amber" | "mint" | "rose" | "sky" | "dark";

/**
 * 投影风格
 */
export type CartoonShadowStyle = "soft" | "comic";

/**
 * 单个气泡动画类型
 */
export type CartoonAnimationType = "fade";

/**
 * 根组件状态与受控参数
 */
export interface CartoonPopoverProps {
	/** 是否受控打开 */
	open?: boolean;
	/** 默认打开状态（非受控） */
	defaultOpen?: boolean;
	/** 打开状态变更回调 */
	onOpenChange?: (open: boolean) => void;
	/**
	 * 触发方式
	 * @default "click"
	 */
	triggerMode?: CartoonTriggerMode;
	/**
	 * 快捷开启悬停显示（等价于 triggerMode="both"）
	 * @default false
	 */
	openOnHover?: boolean;
	/**
	 * 悬停打开防抖延迟（毫秒）
	 * @default 80
	 */
	hoverDelay?: number;
	/**
	 * 离开关闭延迟（毫秒），允许鼠标移入气泡操作
	 * @default 150
	 */
	closeDelay?: number;
	/** 子组件 */
	children: ReactNode;
}

/**
 * 上下文内部接口
 */
export interface CartoonPopoverContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
	triggerRef: RefObject<HTMLElement | null>;
	contentRef: RefObject<HTMLDivElement | null>;
	popoverId: string;
	triggerMode: CartoonTriggerMode;
	hoverDelay: number;
	closeDelay: number;
	handleMouseEnter: () => void;
	handleMouseLeave: () => void;
}

/**
 * 触发器组件参数
 */
export interface CartoonPopoverTriggerProps extends ComponentPropsWithoutRef<"button"> {
	/** 是否将属性直接注入子元素而不是作为 button 渲染 */
	asChild?: boolean;
	children: ReactNode;
}

/**
 * 内容面板组件参数
 */
export interface CartoonPopoverContentProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
	/**
	 * 期望显示在触发器的哪一侧
	 * @default "bottom"
	 */
	side?: CartoonPopoverSide;
	/**
	 * 相对触发器的对齐方式
	 * @default "center"
	 */
	align?: CartoonPopoverAlign;
	/**
	 * 气泡与触发器的间距（像素）
	 * @default 14
	 */
	sideOffset?: number;
	/**
	 * 视口防溢出边缘保留边距（像素）
	 * @default 8
	 */
	collisionPadding?: number;
	/**
	 * 气泡形态
	 * @default "speech"
	 */
	bubbleStyle?: CartoonBubbleStyle;
	/**
	 * 色彩变体
	 * @default "default"
	 */
	variant?: CartoonBubbleVariant;
	/**
	 * 投影风格
	 * @default "soft"
	 */
	shadowStyle?: CartoonShadowStyle;
	/**
	 * 是否显示气泡小尾巴
	 * @default true
	 */
	showArrow?: boolean;
	/**
	 * 是否显示卡通弧形高光条
	 * @default true
	 */
	showShine?: boolean;
	/**
	 * 可选快捷标题；传入时自动渲染卡通头部
	 */
	title?: ReactNode;
	/**
	 * 可选副标题或描述
	 */
	description?: ReactNode;
	/**
	 * 头部与正文之间是否显示虚线分隔
	 * @default false
	 */
	divided?: boolean;
	/**
	 * 是否显示右上角卡通关闭按钮
	 * @default false
	 */
	showClose?: boolean;
	/**
	 * 挂载的目标 DOM 容器，默认 document.body
	 */
	container?: HTMLElement | null;
}

/**
 * 头部容器参数
 */
export interface CartoonPopoverHeaderProps extends ComponentPropsWithoutRef<"div"> {
	/** 是否显示底部虚线分隔 */
	divided?: boolean;
	children?: ReactNode;
}

/**
 * 标题参数
 */
export interface CartoonPopoverTitleProps extends ComponentPropsWithoutRef<"h4"> {
	children: ReactNode;
}

/**
 * 描述参数
 */
export interface CartoonPopoverDescriptionProps extends ComponentPropsWithoutRef<"p"> {
	children: ReactNode;
}

/**
 * 关闭按钮参数
 */
export interface CartoonPopoverCloseProps extends ComponentPropsWithoutRef<"button"> {
	children?: ReactNode;
}

/**
 * 连续平滑移动 Popover 群组参数
 */
export interface CartoonPopoverGroupProps {
	/**
	 * 气泡与触发器的间距（像素）
	 * @default 14
	 */
	sideOffset?: number;
	/**
	 * 鼠标离开整排群组的收起延迟（毫秒）
	 * @default 180
	 */
	closeDelay?: number;
	/** 整体外层类名 */
	className?: string;
	children: ReactNode;
}

/**
 * 群组内单个触发条目参数
 */
export interface CartoonPopoverItemProps {
	/** 条目唯一标识 */
	value: string;
	children: ReactNode;
}
