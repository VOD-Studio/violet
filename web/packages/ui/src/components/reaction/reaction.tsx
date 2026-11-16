"use client";

import { cn } from "cn";
import { useComposedRefs } from "radix-ui/internal";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TooltipProvider } from "../tooltip";
import { ReactionAdd } from "./reaction-add";
import { ReactionChip } from "./reaction-chip";
import type { ReactionBarProps } from "./types";
import { useReactionPresence } from "./use-reaction-presence";

/** 宿主受控的回应集合；只管理折叠、快捷选择、名单提示与可打断的展示动效。 */
export function ReactionBar({
	items,
	onToggle,
	recentItems,
	onAdd,
	renderPicker,
	allowSelected = false,
	maxSelected = Number.POSITIVE_INFINITY,
	collapseAfter = Number.POSITIVE_INFINITY,
	onLimit,
	limitMessage,
	disabled = false,
	className,
	children,
	ref,
	onFocusCapture,
	onBlurCapture,
	...props
}: ReactionBarProps) {
	const [root, setRoot] = useState<HTMLDivElement | null>(null);
	const [expanded, setExpanded] = useState(false);
	const focusedId = useRef<string | null>(null);
	const lastFocused = useRef<HTMLElement | null>(null);
	const composedRef = useComposedRefs(ref, setRoot);
	const activeItems = useMemo(() => items.filter((item) => item.count > 0), [items]);
	const selected = useMemo(
		() => new Set(activeItems.filter((item) => item.self).map((item) => item.id)),
		[activeItems],
	);
	const quickItems = useMemo(() => recentItems?.slice(0, 8) ?? [], [recentItems]);
	const threshold = Math.max(0, Math.floor(collapseAfter));
	const hasMore = activeItems.length > threshold;
	const shownItems = useMemo(() => {
		if (expanded || !hasMore) {
			return activeItems;
		}
		return activeItems.slice(0, threshold);
	}, [activeItems, expanded, hasMore, threshold]);
	const { entries, settle } = useReactionPresence(shownItems);
	const limited = selected.size >= maxSelected;

	const focusExit = useCallback(
		(id: string) => {
			if (!root) {
				return;
			}
			const wrappers = Array.from(root.querySelectorAll<HTMLElement>(".v-reaction__entry"));
			const index = wrappers.findIndex((element) => element.dataset.reactionId === id);
			const active = document.activeElement;
			const stillFocused =
				wrappers[index]?.contains(active) ||
				(active === document.body && focusedId.current === id);
			if (!stillFocused) {
				return;
			}
			const remaining = [...wrappers.slice(index + 1), ...wrappers.slice(0, index).reverse()];
			const next = remaining.find((element) => !element.hasAttribute("data-exiting"));
			const target =
				next?.querySelector<HTMLElement>(".v-reaction__chip") ??
				root.querySelector<HTMLElement>(".v-reaction__more, .v-reaction__add");
			if (target) {
				target.focus({ preventScroll: true });
			} else {
				root.focus({ preventScroll: true });
			}
		},
		[root],
	);

	useLayoutEffect(() => {
		const previous = lastFocused.current;
		if (
			!root ||
			!previous ||
			previous.isConnected ||
			document.activeElement !== document.body
		) {
			return;
		}
		const target = root.querySelector<HTMLElement>(
			".v-reaction__entry:not([data-exiting]) .v-reaction__chip, .v-reaction__more, .v-reaction__add",
		);
		(target ?? root).focus({ preventScroll: true });
	});

	return (
		<TooltipProvider delayDuration={0}>
			<div
				{...props}
				ref={composedRef}
				className={cn("v-reaction", className)}
				data-slot="reaction-bar"
				aria-disabled={disabled || props["aria-disabled"]}
				tabIndex={props.tabIndex ?? -1}
				onFocusCapture={(event) => {
					onFocusCapture?.(event);
					lastFocused.current = event.target as HTMLElement;
					const wrapper = (event.target as HTMLElement).closest<HTMLElement>(
						".v-reaction__entry",
					);
					focusedId.current = wrapper?.dataset.reactionId ?? null;
				}}
				onBlurCapture={(event) => {
					onBlurCapture?.(event);
					const next = event.relatedTarget;
					const target = event.target as HTMLElement;
					const leftRoot = next
						? !event.currentTarget.contains(next as Node)
						: target.isConnected && !target.closest("[inert]");
					if (leftRoot) {
						focusedId.current = null;
						lastFocused.current = null;
					}
				}}
			>
				{entries.map((entry) => (
					<ReactionChip
						key={entry.item.id}
						entry={entry}
						container={root}
						disabled={disabled}
						limited={limited}
						onToggle={onToggle}
						onLimit={onLimit}
						onSettle={settle}
						onFocusExit={focusExit}
					/>
				))}
				{hasMore && (
					<button
						type="button"
						className="v-reaction__more"
						aria-expanded={expanded}
						aria-label={
							expanded
								? "收起回应"
								: `展开另外 ${activeItems.length - threshold} 种回应`
						}
						aria-disabled={disabled || undefined}
						onClick={() => {
							if (!disabled) {
								setExpanded((value) => !value);
							}
						}}
					>
						{expanded ? "收起" : `+${activeItems.length - threshold}`}
					</button>
				)}
				{onAdd && (
					<ReactionAdd
						recentItems={quickItems}
						selected={selected}
						allowSelected={allowSelected}
						disabled={disabled}
						limited={limited}
						maxSelected={maxSelected}
						limitMessage={limitMessage}
						container={root}
						onAdd={onAdd}
						onLimit={onLimit}
						renderPicker={renderPicker}
					/>
				)}
				{children}
			</div>
		</TooltipProvider>
	);
}
