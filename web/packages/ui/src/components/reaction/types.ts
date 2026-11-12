import type { ComponentProps, ReactNode } from "react";
import type { EmojiPickerItem } from "../emoji-picker";

/** 可公开展示的最近回应者；self 用于识别并去除名单中的重复本人。 */
export interface ReactionUser {
	name: string;
	self?: boolean;
}

/** 同一回应在 items 与 recentItems 中必须使用相同 ID；组件不解析业务 ID。 */
export interface ReactionItem {
	id: string;
	name: string;
	content: ReactNode;
	count: number;
	self: boolean;
	recentUsers?: readonly ReactionUser[];
}

/** 数据、登录、持久化与请求状态由宿主持有；原生属性与 ref 属于根 div。 */
export interface ReactionBarProps extends Omit<ComponentProps<"div">, "onToggle"> {
	items: readonly ReactionItem[];
	/** 不提供时不触发切换；只读回应仍可聚焦读取名单。 */
	onToggle?: (id: string) => void;
	/** 最多显示前八项；selected 与 items 中的 self 均会阻止重复添加。 */
	recentItems?: readonly EmojiPickerItem[];
	/** 不提供时隐藏添加入口；达到 maxSelected 时仍可聚焦并调用 onLimit。 */
	onAdd?: (id: string) => void;
	/** 提供真实选择面板；选择后调用 close，直接收回原添加按钮，不退回快捷条。 */
	renderPicker?: (context: { close: () => void }) => ReactNode;
	/**
	 * 本人可同时回应的种类上限，已选项始终允许取消。
	 *
	 * @default 无限制
	 */
	maxSelected?: number;
	/**
	 * 超出后显示 +N，展开后可收起；不限制实际回应数据。
	 *
	 * @default 无限制
	 */
	collapseAfter?: number;
	/** 达到上限时，添加入口与未选回应的激活都会触发。 */
	onLimit?: () => void;
	/**
	 * 覆盖上限的提示与读屏说明。
	 *
	 * @default 根据 maxSelected 生成通用上限说明
	 */
	limitMessage?: string;
	/**
	 * 提交中或不可交互；关闭已打开的添加面板，且不转发任何操作。
	 *
	 * @default false
	 */
	disabled?: boolean;
}
