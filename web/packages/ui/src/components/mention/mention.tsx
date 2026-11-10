"use client";

import { cn } from "cn";
import { Users } from "lucide-react";
import { useEffect, useRef } from "react";
import { Avatar } from "../avatar/avatar";

/** 一条可提及对象：人、机器人，或带人数的「全体成员」。 */
export interface MentionCandidate {
	/** 用户 ID；「全体成员」用保留值 `all` */
	id: string;
	/** 写进提及占位符的 username 段 */
	username: string;
	/** 列表与提及节点里的可见文字 */
	displayName: string;
	avatarUrl?: string;
	/** 会话角色；所有者显示「管理员」标签 */
	role?: "owner" | "member";
	/** 机器人显示「机器人」标签 */
	isBot?: boolean;
	/** 给出人数即按「全体成员」条目渲染：全体图标加「N 人」，不画头像 */
	memberCount?: number;
}

/**
 * 「全体成员」条目在列表里的标题：占位符与历史消息回显仍是 `@所有人`（与后端 humanize 一致），
 * 只有候选行改称「全体成员」。
 */
export const MENTION_ALL_LABEL = "全体成员";

/**
 * 候选项的 DOM id。输入框的 `aria-activedescendant` 必须指向同一值。
 *
 * 用候选自身的 id 而不是下标：筛选让列表重排后，高亮不会指到别的行。
 */
export function mentionOptionId(listboxId: string, candidateId: string): string {
	return `${listboxId}-${candidateId}`;
}

export interface MentionListProps {
	/** listbox 的 DOM id，输入框的 `aria-controls` 指向它 */
	id: string;
	/** 已筛选、已排序的候选 */
	candidates: readonly MentionCandidate[];
	/** 高亮项下标；键盘导航属于持有焦点的输入框，列表只负责显示与滚进可视区 */
	activeIndex: number;
	onActiveIndexChange: (index: number) => void;
	onSelect: (candidate: MentionCandidate) => void;
	/** 当前查询词，只用于空态文案 */
	query?: string;
	className?: string;
}

/**
 * 输入框下方的提及候选列表：listbox 语义、指针与键盘共用一套高亮，可提及人数写在可访问名称里。
 *
 * 组件不拥有焦点、不解析触发词、不插入文本；Esc 与插入由持有输入的宿主处理。
 */
export function MentionList({
	id,
	candidates,
	activeIndex,
	onActiveIndexChange,
	onSelect,
	query = "",
	className,
}: MentionListProps) {
	const listRef = useRef<HTMLDivElement>(null);
	/**
	 * hover 选中许可：滚动高亮项后置否，鼠标真实移动（mousemove）时恢复。
	 * 否则静止鼠标下的列表滚动会合成 mouseEnter，把方向键选中劫回鼠标悬停项。
	 */
	const allowHover = useRef(true);

	useEffect(() => {
		allowHover.current = false;
		listRef.current?.querySelectorAll('[role="option"]')[activeIndex]?.scrollIntoView({
			block: "nearest",
		});
	}, [activeIndex]);

	return (
		<div className={cn("v-mention", className)}>
			<div aria-hidden="true" className="v-mention__label">
				提及
			</div>
			<div
				aria-label={`提及候选，共 ${candidates.length} 人`}
				className="v-mention__list"
				id={id}
				onMouseMove={() => {
					allowHover.current = true;
				}}
				ref={listRef}
				role="listbox"
			>
				{candidates.map((candidate, index) => {
					const label =
						candidate.memberCount === undefined
							? candidate.displayName
							: MENTION_ALL_LABEL;
					return (
						<button
							aria-selected={index === activeIndex}
							className="v-mention__option"
							id={mentionOptionId(id, candidate.id)}
							key={candidate.id}
							onClick={() => onSelect(candidate)}
							// 点击候选项会先让编辑区失焦，浮层随即关闭、click 打不到——按下时就拦住失焦。
							onMouseDown={(event) => event.preventDefault()}
							onMouseEnter={() => {
								if (allowHover.current) onActiveIndexChange(index);
							}}
							role="option"
							type="button"
						>
							{candidate.memberCount === undefined ? (
								<Avatar
									alt=""
									className="v-mention__avatar"
									name={label}
									size={24}
									src={candidate.avatarUrl}
								/>
							) : (
								<span className="v-mention__all">
									<Users aria-hidden="true" size={14} strokeWidth={2} />
								</span>
							)}
							<span className="v-mention__name">
								{label}
								<span className="v-mention__handle">
									{candidate.memberCount === undefined
										? `@${candidate.username}`
										: `${candidate.memberCount} 人`}
								</span>
							</span>
							{candidate.role === "owner" && (
								<span className="v-mention__tag">管理员</span>
							)}
							{candidate.isBot && <span className="v-mention__tag">机器人</span>}
						</button>
					);
				})}
				{candidates.length === 0 && (
					<p className="v-mention__empty">
						{query ? `没有叫「${query}」的人` : "没有可以提及的成员"}
					</p>
				)}
			</div>
		</div>
	);
}
