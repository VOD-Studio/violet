"use client";

import { type RefCallback, useCallback, useRef } from "react";

const ITEM = "[data-list-highlight-item]";
const OWNER = "[data-list-highlight]";
const DISABLED = ":disabled, [aria-disabled='true'], [data-disabled]";

export type ListHighlightMode = "pointer" | "focus" | "active";

export function isKeyboardFocus(element: Element) {
	try {
		return element.matches(":focus-visible");
	} catch {
		return true;
	}
}

interface HighlightOptions {
	mode?: ListHighlightMode;
	/** Dropdown 的安全区统一判断真正离开，由 clearPointer 清除悬停目标。 */
	manualPointerLeave?: boolean;
}

export function useListHighlight<T extends HTMLElement = HTMLElement>({
	mode = "pointer",
	manualPointerLeave = false,
}: HighlightOptions = {}) {
	const clearRef = useRef<(() => void) | null>(null);
	const clearPointer = useCallback(() => clearRef.current?.(), []);
	const ref: RefCallback<T> = useCallback(
		(root) => {
			if (!root) return;
			root.setAttribute("data-list-highlight", "");
			let hovered: HTMLElement | null = null;
			let focused: HTMLElement | null = null;
			let active: HTMLElement | null = null;
			let visible = false;
			let clearFrame = 0;
			const enabled = (item: HTMLElement | null): item is HTMLElement =>
				item !== null &&
				root.contains(item) &&
				item.closest(OWNER) === root &&
				!item.matches(DISABLED);
			const findItem = (target: EventTarget | null) => {
				const item = target instanceof Element ? target.closest<HTMLElement>(ITEM) : null;
				return enabled(item) ? item : null;
			};
			const measure = () => {
				if (!enabled(active)) return;
				const rect = active.getBoundingClientRect();
				const origin = root.getBoundingClientRect();
				// 包围盒包含浮层出场或展柜缩放，底色仍使用容器自己的 CSS 像素。
				const scaleX = (root.offsetWidth && origin.width / root.offsetWidth) || 1;
				const scaleY = (root.offsetHeight && origin.height / root.offsetHeight) || 1;
				const x = (rect.left - origin.left) / scaleX - root.clientLeft + root.scrollLeft;
				const y = (rect.top - origin.top) / scaleY - root.clientTop + root.scrollTop;
				const radius = getComputedStyle(active).borderRadius;
				root.style.setProperty("--v-list-hl-x", `${x}px`);
				root.style.setProperty("--v-list-hl-y", `${y}px`);
				root.style.setProperty("--v-list-hl-width", `${rect.width / scaleX}px`);
				root.style.setProperty("--v-list-hl-height", `${rect.height / scaleY}px`);
				root.style.setProperty("--v-list-hl-radius", radius);
			};
			const resize =
				typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
			const update = (deferClear = true): boolean => {
				if (!enabled(hovered)) hovered = null;
				if (!enabled(focused)) focused = null;
				let selected: HTMLElement | null = null;
				for (const item of root.querySelectorAll<HTMLElement>(
					'[data-list-highlight-active="true"], [data-state="open"]',
				)) {
					if (item.matches(ITEM) && enabled(item)) {
						selected = item;
						break;
					}
				}
				const next = hovered ?? focused ?? selected;
				// Radix 换项先把焦点还给面板；同帧接管的新项应沿用滑动起点。
				if (!next && active && mode !== "pointer" && deferClear) {
					if (!clearFrame)
						clearFrame = requestAnimationFrame(() => {
							clearFrame = 0;
							update(false);
						});
					return false;
				}
				cancelAnimationFrame(clearFrame);
				clearFrame = 0;
				if (next === active) return false;
				const jump = !visible || (active !== null && !root.contains(active));
				if (active) {
					resize?.unobserve(active);
					if (mode === "pointer") active.removeAttribute("data-highlighted");
				}
				active = next;
				visible = next !== null;
				root.setAttribute("data-list-highlight-visible", String(visible));
				root.setAttribute("data-list-highlight-jump", String(jump));
				if (active) {
					if (mode === "pointer") active.setAttribute("data-highlighted", "");
					resize?.observe(active);
					measure();
				}
				return true;
			};
			const pointer = (event: PointerEvent) => {
				if (mode !== "pointer" || event.pointerType === "touch" || event.defaultPrevented)
					return;
				if (
					event.target instanceof Node &&
					hovered?.contains(event.target) &&
					enabled(hovered)
				)
					return;
				const candidate =
					event.target instanceof Element
						? event.target.closest<HTMLElement>(ITEM)
						: null;
				// 条目间隙保留上一个目标；嵌套列表不接管父列表。
				if (!candidate || candidate.closest(OWNER) !== root) return;
				hovered = enabled(candidate) ? candidate : null;
				update();
			};
			const leave = () => {
				hovered = null;
				update();
			};
			const focus = (event: FocusEvent) => {
				if (mode === "active") return;
				const item = findItem(event.target);
				focused = item && (mode === "focus" || isKeyboardFocus(item)) ? item : null;
				if (focused) hovered = null;
				update();
			};
			const blur = (event: FocusEvent) => {
				if (mode === "active") return;
				const item = findItem(event.relatedTarget);
				focused = item && (mode === "focus" || isKeyboardFocus(item)) ? item : null;
				update();
			};
			clearRef.current = leave;
			const mutations = new MutationObserver(() => {
				if (!update()) measure();
			});
			const initialFocus = findItem(document.activeElement);
			focused =
				mode !== "active" &&
				initialFocus &&
				(mode === "focus" || isKeyboardFocus(initialFocus))
					? initialFocus
					: null;
			update();
			resize?.observe(root);
			mutations.observe(root, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: [
					"disabled",
					"aria-disabled",
					"data-disabled",
					"data-list-highlight-active",
					"data-state",
					"class",
				],
			});
			root.addEventListener("pointerover", pointer);
			root.addEventListener("pointermove", pointer);
			if (!manualPointerLeave) root.addEventListener("pointerleave", leave);
			root.addEventListener("focusin", focus);
			root.addEventListener("focusout", blur);
			return () => {
				cancelAnimationFrame(clearFrame);
				resize?.disconnect();
				mutations.disconnect();
				if (clearRef.current === leave) clearRef.current = null;
				if (mode === "pointer") active?.removeAttribute("data-highlighted");
				root.removeEventListener("pointerover", pointer);
				root.removeEventListener("pointermove", pointer);
				root.removeEventListener("pointerleave", leave);
				root.removeEventListener("focusin", focus);
				root.removeEventListener("focusout", blur);
				root.removeAttribute("data-list-highlight-visible");
				root.removeAttribute("data-list-highlight-jump");
				for (const key of ["x", "y", "width", "height", "radius"])
					root.style.removeProperty(`--v-list-hl-${key}`);
			};
		},
		[mode, manualPointerLeave],
	);
	return { ref, clearPointer };
}
