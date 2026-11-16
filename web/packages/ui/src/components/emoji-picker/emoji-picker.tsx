"use client";

import { cn } from "cn";
import { useCallbackRef, useComposedRefs } from "radix-ui/internal";
import { type ReactNode, useCallback, useId, useMemo, useRef } from "react";
import { Button } from "../button";
import { ScrollArea } from "../scroll-area";
import { Skeleton } from "../skeleton";
import { EmojiPreview } from "./emoji-preview";
import { EmojiSection, EmojiSectionExtras } from "./emoji-section";
import { EmojiTabs } from "./emoji-tabs";
import { emojiCells } from "./navigation";
import type { EmojiPickerPanelProps } from "./types";
import { useEmojiNavigation } from "./use-emoji-navigation";

/** 按分组浏览和选择表情；浮层开关、插入与最近记录由宿主管理。 */
export function EmojiPickerPanel({
	groups,
	activeGroup,
	onGroupChange,
	onSelect,
	allowSelected = false,
	scrollTop,
	onScrollTopChange,
	status = "ready",
	errorMessage = "请检查网络连接后重新加载。",
	onRetry,
	className,
	ref,
	...props
}: EmojiPickerPanelProps) {
	const id = useId();
	const root = useRef<HTMLDivElement>(null);
	const viewport = useRef<HTMLDivElement>(null);
	const composedRef = useComposedRefs(root, ref);
	const selectItem = useCallbackRef(onSelect);
	const group = groups.find((entry) => entry.id === activeGroup) ?? groups[0];
	const groupId = group?.id ?? "";
	const { cells, cellsByKey, sections } = useMemo(() => {
		const cells = emojiCells(group?.sections ?? []);
		return {
			cells,
			cellsByKey: new Map(cells.map((cell) => [cell.key, cell])),
			sections:
				group?.sections.map((section, index) => ({
					section,
					row: index * 2 + 2,
					cells: cells.filter((cell) => cell.section === section),
				})) ?? [],
		};
	}, [group]);
	const navigation = useEmojiNavigation({
		root,
		viewport,
		groupId,
		cells,
		cellsByKey,
		allowSelected,
		status,
		scrollTop,
		onScrollTopChange,
		onSelect: selectItem,
	});
	const { preview, activeKey } = navigation;
	const optionId = useCallback((key: string) => `${id}-option-${encodeURIComponent(key)}`, [id]);
	const hasOptions = status === "ready" && cells.length > 0;
	const activeId = activeKey && cellsByKey.has(activeKey) ? optionId(activeKey) : undefined;
	const previewCell = preview.preview ? cellsByKey.get(preview.preview.key) : undefined;
	const changeGroup = (value: string) => {
		preview.hide(true);
		onGroupChange(value);
	};

	return (
		<div
			{...props}
			ref={composedRef}
			className={cn("v-emoji-picker", className)}
			data-slot="emoji-picker-panel"
		>
			<EmojiTabs groups={groups} activeGroup={groupId} id={id} onGroupChange={changeGroup} />
			<ScrollArea
				ref={viewport}
				id={`${id}-grid`}
				aria-label={group ? `${group.label}表情浏览区` : "表情浏览区"}
				aria-busy={status === "loading"}
				tabIndex={hasOptions ? -1 : 0}
				className="v-emoji-picker__viewport"
				viewportClassName="v-emoji-picker__grid"
				onScroll={navigation.handleScroll}
				onWheel={navigation.allowHover}
				onTouchMove={navigation.allowHover}
				onMouseLeave={navigation.hidePreview}
				onBlur={navigation.hidePreview}
			>
				<EmojiPanelState status={status} errorMessage={errorMessage} onRetry={onRetry}>
					<div
						key={groupId}
						className="v-emoji-picker__group"
						style={{
							gridTemplateRows: `repeat(${Math.max(1, sections.length)}, auto auto)`,
						}}
					>
						{hasOptions && (
							<div
								role="listbox"
								aria-label={`${group?.label ?? ""}表情`}
								aria-multiselectable="true"
								aria-activedescendant={activeId}
								tabIndex={0}
								className="v-emoji-picker__listbox"
								style={{ gridRow: `1 / span ${sections.length * 2}` }}
								onKeyDown={navigation.handleKeyDown}
							>
								{sections.map(({ section, cells, row }) => (
									<EmojiSection
										key={section.id}
										section={section}
										cells={cells}
										row={row}
										activeKey={activeKey}
										allowSelected={allowSelected}
										optionId={optionId}
										optionRefs={navigation.options}
										onHighlight={navigation.highlight}
										onSelect={selectItem}
									/>
								))}
							</div>
						)}
						{sections.map(({ section, row }) => (
							<EmojiSectionExtras
								key={section.id}
								section={section}
								row={row}
								labelRefs={navigation.labels}
							/>
						))}
						{sections.length === 0 && (
							<p className="v-emoji-picker__empty">还没有表情</p>
						)}
					</div>
				</EmojiPanelState>
			</ScrollArea>
			<EmojiPreview
				preview={preview.preview}
				cell={previewCell}
				visible={preview.visible && status === "ready" && previewCell !== undefined}
			/>
		</div>
	);
}

interface EmojiPanelStateProps extends Pick<EmojiPickerPanelProps, "errorMessage" | "onRetry"> {
	status: NonNullable<EmojiPickerPanelProps["status"]>;
	children: ReactNode;
}

function EmojiPanelState({ status, errorMessage, onRetry, children }: EmojiPanelStateProps) {
	if (status === "loading") {
		return (
			<div className="v-emoji-picker__loading" role="status">
				<p>正在加载表情</p>
				<div className="v-emoji-picker__items" data-density="small" aria-hidden="true">
					{Array.from({ length: 30 }, (_, index) => (
						<Skeleton className="v-emoji-picker__skeleton" key={index} />
					))}
				</div>
			</div>
		);
	}
	if (status === "error") {
		return (
			<div className="v-emoji-picker__empty" role="alert">
				<b>表情没有加载出来</b>
				<span>{errorMessage}</span>
				{onRetry && (
					<Button
						variant="outline"
						size="sm"
						className="v-emoji-picker__retry"
						onClick={onRetry}
					>
						重新加载
					</Button>
				)}
			</div>
		);
	}
	return children;
}
