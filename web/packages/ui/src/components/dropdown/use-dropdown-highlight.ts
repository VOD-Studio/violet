import type * as React from "react";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

interface HighlightGeometry {
	x: number;
	y: number;
	width: number;
	height: number;
	radius: string;
	visible: boolean;
}

const DISABLED_SELECTOR = ":disabled, [aria-disabled='true'], [data-disabled]";

export const isKeyboardFocus = (element: Element) => {
	try {
		return element.matches(":focus-visible");
	} catch {
		return true;
	}
};

/** 单个底色跟随当前菜单项，测量只发生在项切换或布局变化时。 */
export function useDropdownHighlight(innerRef: RefObject<HTMLDivElement | null>) {
	const [geometry, setGeometry] = useState<HighlightGeometry | null>(null);
	const [animated, setAnimated] = useState(false);
	const hovered = useRef<HTMLElement | null>(null);
	const focused = useRef<HTMLElement | null>(null);
	const active = useRef<HTMLElement | null>(null);
	const observerRef = useRef<ResizeObserver | null>(null);
	const attributeObserverRef = useRef<MutationObserver | null>(null);

	const measure = useCallback(() => {
		const item = active.current;
		const inner = innerRef.current;
		if (!item?.isConnected || !inner || item.matches(DISABLED_SELECTOR)) {
			setGeometry((previous) =>
				previous?.visible ? { ...previous, visible: false } : previous,
			);
			return;
		}
		const bounds = item.getBoundingClientRect();
		const origin = inner.getBoundingClientRect();
		const next = {
			x: bounds.left - origin.left,
			y: bounds.top - origin.top,
			width: bounds.width,
			height: bounds.height,
			radius: getComputedStyle(item).borderRadius,
			visible: true,
		};
		setGeometry((previous) =>
			previous?.visible &&
			previous.x === next.x &&
			previous.y === next.y &&
			previous.width === next.width &&
			previous.height === next.height &&
			previous.radius === next.radius
				? previous
				: next,
		);
	}, [innerRef]);

	const update = useCallback(() => {
		if (
			hovered.current &&
			(!hovered.current.isConnected || hovered.current.matches(DISABLED_SELECTOR))
		) {
			hovered.current = null;
		}
		if (
			focused.current &&
			(!focused.current.isConnected || focused.current.matches(DISABLED_SELECTOR))
		) {
			focused.current = null;
		}
		const next = hovered.current ?? focused.current;
		if (active.current === next) return;
		if (active.current) observerRef.current?.unobserve(active.current);
		attributeObserverRef.current?.disconnect();
		active.current = next;
		if (next) {
			observerRef.current?.observe(next);
			attributeObserverRef.current?.observe(next, {
				attributes: true,
				attributeFilter: ["disabled", "aria-disabled", "data-disabled"],
			});
		}
		measure();
	}, [measure]);

	const findItem = useCallback(
		(target: EventTarget | null) => {
			const item =
				target instanceof Element ? target.closest<HTMLElement>(".v-dropdown__item") : null;
			return item &&
				item.closest(".v-dropdown__inner") === innerRef.current &&
				!item.matches(DISABLED_SELECTOR)
				? item
				: null;
		},
		[innerRef],
	);

	const pointer = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (event.pointerType === "touch") return;
			if (
				event.target instanceof Node &&
				hovered.current?.contains(event.target) &&
				!hovered.current.matches(DISABLED_SELECTOR)
			)
				return;
			const item = findItem(event.target);
			if (!item) {
				const candidate =
					event.target instanceof Element
						? event.target.closest(".v-dropdown__item")
						: null;
				if (candidate?.closest(".v-dropdown__inner") !== innerRef.current) return;
			}
			hovered.current = item;
			update();
		},
		[findItem, innerRef, update],
	);

	const leave = useCallback(() => {
		hovered.current = null;
		update();
	}, [update]);

	const focus = useCallback(
		(event: React.FocusEvent<HTMLDivElement>) => {
			const item = findItem(event.target);
			focused.current = item && isKeyboardFocus(item) ? item : null;
			if (focused.current) hovered.current = null;
			update();
		},
		[findItem, update],
	);

	const blur = useCallback(
		(event: React.FocusEvent<HTMLDivElement>) => {
			const item = findItem(event.relatedTarget);
			focused.current = item && isKeyboardFocus(item) ? item : null;
			update();
		},
		[findItem, update],
	);

	useEffect(() => {
		const inner = innerRef.current;
		if (!inner) return;
		const observer = new ResizeObserver(measure);
		const attributes = new MutationObserver(update);
		observerRef.current = observer;
		attributeObserverRef.current = attributes;
		observer.observe(inner);
		if (active.current) {
			observer.observe(active.current);
			attributes.observe(active.current, {
				attributes: true,
				attributeFilter: ["disabled", "aria-disabled", "data-disabled"],
			});
		}
		return () => {
			observer.disconnect();
			attributes.disconnect();
			observerRef.current = null;
			attributeObserverRef.current = null;
		};
	}, [innerRef, measure, update]);

	const measured = geometry !== null;
	useEffect(() => {
		if (!measured || animated) return;
		let second = 0;
		const first = requestAnimationFrame(() => {
			second = requestAnimationFrame(() => setAnimated(true));
		});
		return () => {
			cancelAnimationFrame(first);
			cancelAnimationFrame(second);
		};
	}, [measured, animated]);

	return { geometry, animated, pointer, leave, focus, blur };
}
