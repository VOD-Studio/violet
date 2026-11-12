import { useLayoutEffect, useRef } from "react";
import { displayCount, reducedMotion } from "./presentation";
import type { ReactionEntry } from "./use-reaction-presence";

interface PresenceMotionOptions {
	entry: ReactionEntry;
	onSettle: (id: string, exiting: boolean) => void;
	onFocusExit: (id: string) => void;
}

export function useReactionEntryMotion({ entry, onSettle, onFocusExit }: PresenceMotionOptions) {
	const ref = useRef<HTMLSpanElement>(null);
	const snapshot = useRef<{ width: number; opacity: string; margin: string } | null>(null);
	const { entering, exiting, item } = entry;

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element || (!entering && !exiting)) {
			return;
		}
		if (exiting) {
			onFocusExit(item.id);
		}
		const reduced = reducedMotion(element);
		let duration = 200;
		if (reduced) {
			duration = 100;
		} else if (exiting) {
			duration = 160;
		}
		const naturalWidth = element.firstElementChild?.getBoundingClientRect().width ?? 0;
		const from = snapshot.current;
		snapshot.current = null;
		const frames: Keyframe[] = [
			{ opacity: from?.opacity ?? (exiting ? "1" : "0") },
			{ opacity: exiting ? 0 : 1 },
		];
		if (!reduced) {
			frames[0].width = `${from?.width ?? (exiting ? naturalWidth : 0)}px`;
			frames[0].marginInlineEnd = from?.margin ?? (exiting ? "0px" : "-6px");
			frames[1].width = `${exiting ? 0 : naturalWidth}px`;
			frames[1].marginInlineEnd = exiting ? "-6px" : "0px";
		}
		const animation = element.animate?.(frames, {
			duration,
			easing: "cubic-bezier(0.32, 0.72, 0, 1)",
			fill: "both",
		});
		const timer = window.setTimeout(() => {
			animation?.cancel();
			snapshot.current = null;
			onSettle(item.id, exiting);
		}, duration);
		return () => {
			window.clearTimeout(timer);
			if (animation && animation.playState !== "idle") {
				const style = getComputedStyle(element);
				snapshot.current = {
					width: element.getBoundingClientRect().width,
					opacity: style.opacity,
					margin: style.marginInlineEnd,
				};
			}
			animation?.cancel();
		};
	}, [entering, exiting, item.id, onSettle, onFocusExit]);

	return ref;
}

export function useReactionCountMotion(count: number) {
	const ref = useRef<HTMLSpanElement>(null);
	const previous = useRef(count);
	useLayoutEffect(() => {
		const before = previous.current;
		previous.current = count;
		const element = ref.current;
		if (!element || displayCount(before) === displayCount(count)) {
			return;
		}
		const frames: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
		const reduced = reducedMotion(element);
		if (!reduced) {
			frames[0].transform = `translateY(${count > before ? 8 : -8}px)`;
			frames[1].transform = "translateY(0)";
		}
		const animation = element.animate?.(frames, {
			duration: reduced ? 100 : 180,
			easing: "cubic-bezier(0.32, 0.72, 0, 1)",
		});
		return () => animation?.cancel();
	}, [count]);
	return ref;
}

export function useReactionSelfMotion(self: boolean) {
	const ref = useRef<HTMLButtonElement>(null);
	const previous = useRef(self);
	useLayoutEffect(() => {
		const changed = previous.current !== self;
		previous.current = self;
		const element = ref.current;
		if (!element || !changed || !self) {
			return;
		}
		let frames: Keyframe[] = [{ opacity: 0.6 }, { opacity: 1 }];
		const reduced = reducedMotion(element);
		if (!reduced) {
			const target = "var(--selected)";
			frames = [
				{ backgroundColor: "color-mix(in oklab, var(--selected) 70%, var(--link))" },
				{ backgroundColor: target },
			];
		}
		const animation = element.animate?.(frames, {
			duration: reduced ? 100 : 400,
			easing: "ease-out",
		});
		return () => animation?.cancel();
	}, [self]);
	return ref;
}
