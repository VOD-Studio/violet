import type { ComponentProps, ReactNode } from "react";

/** 顶层评论的排序意图；数据顺序由宿主查询决定。 */
export type CommentSort = "latest" | "hot";

/** 正文的公开可见状态；删除态不挂载原文和操作。 */
export type CommentStatus = "visible" | "pending" | "deleted";

/** 单条评论的展示槽；原生属性与 ref 属于根 article。 */
export interface CommentItemProps extends Omit<ComponentProps<"article">, "title"> {
	author: ReactNode;
	/** 传入 Avatar、图片或链接；组件约束为顶层 36px、回复 28px。 */
	avatar: ReactNode;
	/** time 元素的机器可读时间；相对时间文案由 time 槽提供。 */
	dateTime: string;
	time: ReactNode;
	replyTo?: string;
	badges?: ReactNode;
	/** 显示作者环、装饰皇冠与作者标签。 @default false */
	isAuthor?: boolean;
	/** 使用回复的头像尺寸与间距，不接管嵌套关系。 @default false */
	reply?: boolean;
	/** pending 显示仅自己可见说明；deleted 隐去原文、操作与表单。 @default "visible" */
	status?: CommentStatus;
	/** 放入真实 ReactionBar 等操作；组件不创建独立点赞计数。 */
	actions?: ReactNode;
	/** 回复按钮与取消按钮共享的切换意图；省略时不显示这两个按钮。 */
	onReply?: () => void;
	/**
	 * 受控回复表单；出现时聚焦首个可编辑输入，关闭后仅在焦点仍属表单时返回回复按钮。
	 * 宿主负责提交、关闭、错误与草稿，不要再为同一表单添加重复取消入口。
	 */
	replyForm?: ReactNode;
	/** 回复列表或加载区；不自动折叠、去重或改写子节点。 */
	replies?: ReactNode;
	/** 透明度入场的延迟毫秒数；展开回复可传 index * 40，reduce 下忽略。 @default 0 */
	enterDelay?: number;
}

/** 评论区标题与受控排序；原生属性与 ref 属于根 header。 */
export interface CommentHeaderProps extends Omit<ComponentProps<"header">, "title"> {
	title: ReactNode;
	/** 已知数量，包括 0；省略时不显示数量。 */
	count?: number;
	/** 当前排序；不在 SDK 内重新排序 children。 @default "latest" */
	sort?: CommentSort;
	/** 省略时不渲染排序控件；宿主需要更新 sort 并执行真实排序查询。 */
	onSortChange?: (sort: CommentSort) => void;
}

/** 顶层有序列表；直接 children 由宿主提供 li，ref 指向 ol。 */
export type CommentListProps = ComponentProps<"ol">;

/** 带引导线的回复有序列表；直接 children 由宿主提供 li，ref 指向 ol。 */
export type CommentRepliesProps = ComponentProps<"ol">;
