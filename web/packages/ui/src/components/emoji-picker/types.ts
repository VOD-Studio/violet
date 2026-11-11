import type { ComponentProps, ReactNode } from "react";

/** 由宿主提供内容与插入文本的表情；ID 在同一 section 内唯一。 */
export interface EmojiPickerItem {
	id: string;
	name: string;
	content: ReactNode;
	/** 系统表情用 [名称]、自定义表情用 [名称:ID]，颜文字传原文；组件不改写。 */
	placeholder: string;
	aliases?: readonly string[];
	/** 提供原因后仍可导航和预览，但不能选值。 */
	disabledReason?: string;
	/** 已回应项显示对勾并阻止重复选值；同一面板可同时标记多个已回应项。 */
	selected?: boolean;
}

/** 同一密度的表情集合；action 是宿主的上传等操作，不参与选值。 */
export interface EmojiPickerSection {
	id: string;
	label: string;
	/** small 为十列小格，large 为五列大格，text 为三列颜文字。 */
	density: "small" | "large" | "text";
	items: readonly EmojiPickerItem[];
	/** 上传等操作位于视觉第一格，保留自身焦点行为，且在 listbox DOM 之外。 */
	action?: ReactNode;
	emptyMessage?: string;
}

/** 分组顺序、最近使用与收藏的可见性由宿主决定。 */
export interface EmojiPickerGroup {
	id: string;
	label: string;
	icon?: ReactNode;
	sections: readonly EmojiPickerSection[];
}

/** 无业务请求或持久化的选择面板；原生属性与 ref 属于根 div。 */
export interface EmojiPickerPanelProps extends Omit<ComponentProps<"div">, "onSelect"> {
	groups: readonly EmojiPickerGroup[];
	/** 无效 ID 回退到首组；不会因此自动触发 onGroupChange。 */
	activeGroup: string;
	onGroupChange: (id: string) => void;
	onSelect: (item: EmojiPickerItem) => void;
	/** 当前分组的滚动位置，单位 px；未传时使用组件挂载期间的逐组记录。 */
	scrollTop?: number;
	/** 关闭时卸载面板的宿主可按组保存，重新打开后通过 scrollTop 恢复。 */
	onScrollTopChange?: (value: number) => void;
	/**
	 * 加载与错误状态不显示旧选项。
	 *
	 * @default ready
	 */
	status?: "ready" | "loading" | "error";
	errorMessage?: string;
	/** 提供后显示重试按钮；组件不会自动发起重试。 */
	onRetry?: () => void;
}
