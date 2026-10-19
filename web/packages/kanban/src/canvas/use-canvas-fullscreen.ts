import {
	type CSSProperties,
	type RefObject,
	useCallback,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { Viewport } from "../core/index.ts";
import { useInertOutside } from "./use-inert-outside.ts";

interface FullscreenOptions {
	root: RefObject<HTMLDivElement | null>;
	content: RefObject<HTMLDivElement | null>;
	getViewport: () => Viewport;
	onLayoutChange: (fullscreen: boolean) => void;
	onChange: (fullscreen: boolean) => void;
}

interface FullscreenState {
	fullscreen: boolean;
	placeholderStyle: CSSProperties | undefined;
	changeFullscreen: (next: boolean) => void;
}

interface InlineSnapshot {
	style: CSSProperties;
	x: number;
	y: number;
	trigger: HTMLElement | null;
	rect: DOMRect;
	borderX: number;
	borderY: number;
	viewport: Viewport;
	presented: string;
}

const EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const FULL_CLIP = "inset(0px 0px 0px 0px)";
const transform = (x: number, y: number, scale: number) =>
	`translate(${x}px, ${y}px) scale(${scale})`;
const clip = (rect: DOMRect) =>
	`inset(${Math.max(0, rect.top)}px ${Math.max(0, window.innerWidth - rect.right)}px ${Math.max(0, window.innerHeight - rect.bottom)}px ${Math.max(0, rect.left)}px)`;

/** 内容从页面原位展开并原路收回；仅动画 transform、裁剪与透明度，不逐帧重排看板。 */
export function useCanvasFullscreen(options: FullscreenOptions): FullscreenState {
	const { root, content } = options;
	const [fullscreen, setFullscreen] = useState(false);
	const requested = useRef(false);
	const animations = useRef<Animation[]>([]);
	const inline = useRef<InlineSnapshot | null>(null);
	const latest = useRef(options);
	latest.current = options;

	const cancelAnimations = useCallback(() => {
		for (const animation of animations.current) {
			animation.onfinish = null;
			animation.cancel();
		}
		animations.current = [];
	}, []);

	const transition = useCallback(
		(entering: boolean, firstFrame = false) => {
			const node = root.current;
			const body = content.current;
			const saved = inline.current;
			if (!node || !body || !saved) return;
			const backdrop = node.querySelector<HTMLElement>(".v-kanban-canvas__backdrop");
			const controls = node.querySelector<HTMLElement>(".v-kanban-canvas__controls");
			const destination = entering ? latest.current.getViewport() : saved.viewport;
			const fromTransform = firstFrame ? saved.presented : getComputedStyle(body).transform;
			const fromClip = firstFrame ? clip(saved.rect) : getComputedStyle(node).clipPath;
			const fromBackdrop = firstFrame
				? "0"
				: backdrop
					? getComputedStyle(backdrop).opacity
					: "1";
			const fromControls = firstFrame
				? "0"
				: controls
					? getComputedStyle(controls).opacity
					: "1";
			cancelAnimations();
			const finish = () => {
				if (entering) {
					cancelAnimations();
				} else {
					// 收回动画持有终帧，React 恢复页面布局后才释放，避免回弹到全屏位置。
					setFullscreen(false);
					latest.current.onChange(false);
				}
			};
			if (
				typeof node.animate !== "function" ||
				(typeof matchMedia === "function" &&
					matchMedia("(prefers-reduced-motion: reduce)").matches)
			) {
				finish();
				return;
			}
			const animate = (element: HTMLElement, frames: Keyframe[]) => {
				const animation = element.animate(frames, {
					duration: entering ? 250 : 300,
					easing: EASING,
					fill: "forwards",
				});
				animations.current.push(animation);
				return animation;
			};
			animate(body, [
				{ transform: fromTransform },
				{
					transform: transform(
						destination.x + (entering ? 0 : saved.rect.left + saved.borderX),
						destination.y + (entering ? 0 : saved.rect.top + saved.borderY),
						destination.scale,
					),
				},
			]);
			if (backdrop)
				animate(backdrop, [{ opacity: fromBackdrop }, { opacity: entering ? 1 : 0 }]);
			if (controls)
				animate(controls, [{ opacity: fromControls }, { opacity: entering ? 1 : 0 }]);
			animate(node, [
				{ clipPath: fromClip === "none" ? FULL_CLIP : fromClip },
				{ clipPath: entering ? FULL_CLIP : clip(saved.rect) },
			]).onfinish = finish;
		},
		[cancelAnimations, content, root],
	);

	const changeFullscreen = useCallback(
		(next: boolean) => {
			if (requested.current === next) return;
			requested.current = next;
			const node = root.current;
			const body = content.current;
			if (!node || !body) return;
			if (!next) {
				transition(false);
				return;
			}
			const style = getComputedStyle(node);
			const bodyRect = body.getBoundingClientRect();
			const scale =
				body.offsetWidth > 0
					? bodyRect.width / body.offsetWidth
					: latest.current.getViewport().scale;
			inline.current = {
				style: {
					width: node.offsetWidth,
					height: node.offsetHeight,
					margin: style.margin,
					flex: style.flex,
					alignSelf: style.alignSelf,
					gridArea: style.gridArea,
				},
				x: window.scrollX,
				y: window.scrollY,
				trigger:
					document.activeElement instanceof HTMLElement ? document.activeElement : null,
				rect: node.getBoundingClientRect(),
				borderX: Number.parseFloat(style.borderLeftWidth) || 0,
				borderY: Number.parseFloat(style.borderTopWidth) || 0,
				viewport: latest.current.getViewport(),
				presented: transform(bodyRect.left, bodyRect.top, scale),
			};
			setFullscreen(true);
			latest.current.onChange(true);
		},
		[content, root, transition],
	);

	useInertOutside(root, fullscreen);

	useLayoutEffect(() => {
		if (!fullscreen) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, [fullscreen]);

	useLayoutEffect(() => {
		const saved = inline.current;
		if (!saved) return;
		latest.current.onLayoutChange(fullscreen);
		if (fullscreen) {
			transition(true, true);
			return;
		}
		cancelAnimations();
		inline.current = null;
		if (saved.trigger?.isConnected) saved.trigger.focus({ preventScroll: true });
		if (window.scrollX !== saved.x || window.scrollY !== saved.y)
			window.scrollTo({ left: saved.x, top: saved.y, behavior: "instant" });
	}, [cancelAnimations, fullscreen, transition]);

	useLayoutEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (requested.current && event.key === "Escape" && !event.defaultPrevented) {
				event.preventDefault();
				changeFullscreen(false);
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			cancelAnimations();
		};
	}, [cancelAnimations, changeFullscreen]);

	return {
		fullscreen,
		placeholderStyle: fullscreen ? inline.current?.style : undefined,
		changeFullscreen,
	};
}
