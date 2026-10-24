import { useReducedMotion } from "motion/react";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

import {
	clamp,
	getArticleTocRailGeometry,
	getArticleTocRailMarkerX,
} from "./article-toc-rail-geometry";

import { useArticleHeadingRatios } from "./use-article-heading-ratios";

/** 阅读轨迹对应的标题节点；topId 指向所属顶层章节，用于收起态标签。 */
export interface ArticleTocRailItem {
	id: string;
	title: string;
	depth: number;
	topId: string;
}

interface UseArticleTocRailMotionOptions {
	items: ArticleTocRailItem[];
	activeId: string | null;
	active: boolean;
	contentRef?: RefObject<HTMLElement | null>;
	readPercent: number;
}

const MAX_VELOCITY_BEND = 14;
const SPRING_STIFFNESS = 90;
const SPRING_DAMPING = 2 * Math.sqrt(SPRING_STIFFNESS) * 0.75;

/** 文章正文从进入视口到读完的百分比，供阅读轨和悬停目录共用。 */
export function useArticleReadPercent(
	contentRef: RefObject<HTMLElement | null> | undefined,
	fallback: number,
) {
	const [percent, setPercent] = useState(() => Math.floor(clamp(fallback, 0, 100)));

	useEffect(() => {
		const content = contentRef?.current;
		if (!content) {
			setPercent(Math.floor(clamp(fallback, 0, 100)));
			return;
		}

		let frame = 0;
		const update = () => {
			frame = 0;
			const scrollY = window.scrollY;
			const contentTop = content.getBoundingClientRect().top + scrollY;
			const contentHeight =
				content.offsetHeight || content.getBoundingClientRect().height || 1;
			const viewportTravel = Math.min(scrollY, window.innerHeight);
			const next = Math.floor(
				clamp(((scrollY - contentTop + viewportTravel) / contentHeight) * 100, 0, 100),
			);
			setPercent((current) => (current === next ? current : next));
		};
		const schedule = () => {
			if (frame === 0) frame = requestAnimationFrame(update);
		};

		update();
		const observer =
			typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
		observer?.observe(content);
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule, { passive: true });
		return () => {
			if (frame !== 0) cancelAnimationFrame(frame);
			observer?.disconnect();
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
		};
	}, [contentRef, fallback]);

	return percent;
}

/**
 * 驱动阅读轨迹、节点与标签，在进度和弹簧全部收敛后停止排帧。
 *
 * @remarks 滚动、尺寸及目录输入变化重新唤醒；减弱动态时直接对齐目标，
 * 页面隐藏时暂停。容器高度在尺寸事件中缓存，动画帧不重新测量布局。
 */
export function useArticleTocRailMotion({
	items,
	activeId,
	active,
	contentRef,
	readPercent,
}: UseArticleTocRailMotionOptions) {
	const reduced = useReducedMotion();
	const activeIndex = Math.max(
		0,
		items.findIndex((item) => item.id === activeId),
	);
	const headingRatios = useArticleHeadingRatios(items, contentRef);
	const activeItem = items[activeIndex];
	const activeRootItem = activeItem
		? items.find((item) => item.id === activeItem.topId)
		: undefined;

	const containerRef = useRef<HTMLDivElement>(null);
	const basePathRef = useRef<SVGPathElement>(null);
	const accentPathRef = useRef<SVGPathElement>(null);
	const markerRefs = useRef<Array<SVGCircleElement | null>>([]);
	const labelRef = useRef<HTMLDivElement>(null);
	const wakeRef = useRef(() => {});
	const inputs = useMemo(
		() => ({ active, activeId, headingRatios, items, readPercent, reduced: Boolean(reduced) }),
		[active, activeId, headingRatios, items, readPercent, reduced],
	);
	const inputsRef = useRef(inputs);

	const hasItems = items.length > 0;
	useEffect(() => {
		const container = containerRef.current;
		const basePath = basePathRef.current;
		const accentPath = accentPathRef.current;
		if (!hasItems || !container || !basePath || !accentPath) return;
		let height = container.clientHeight;
		let frame = 0;
		let previousTime = 0;
		let activation = 0;
		let progressY = 0;
		let scrollVelocity = 0;
		let bend = 0;
		let bendVelocity = 0;
		let scrollY = window.scrollY;
		let previousScroll = scrollY;
		const setAttribute = (element: SVGElement, name: string, value: string) => {
			if (element.getAttribute(name) !== value) element.setAttribute(name, value);
		};
		const update = (timestamp: number) => {
			frame = 0;
			if (document.hidden || height <= 0) return;
			const { active, headingRatios, readPercent, reduced } = inputsRef.current;
			const delta = previousTime === 0 ? 16.67 : clamp(timestamp - previousTime, 1, 64);
			previousTime = timestamp;
			const targetActivation = active ? 1 : 0;
			const response = 1 - Math.exp(-delta / 140);
			activation = reduced
				? targetActivation
				: activation + (targetActivation - activation) * response;
			if (Math.abs(targetActivation - activation) < 0.002) activation = targetActivation;
			const targetProgress = (clamp(readPercent, 0, 100) / 100) * height;
			progressY =
				reduced || activation === 0
					? targetProgress
					: progressY + (targetProgress - progressY) * Math.min(1, response * 1.4);
			if (Math.abs(targetProgress - progressY) < 0.05) progressY = targetProgress;

			const instantaneousVelocity = ((scrollY - previousScroll) / delta) * 1000;
			previousScroll = scrollY;
			scrollVelocity += (instantaneousVelocity - scrollVelocity) * Math.min(1, delta / 80);
			if (Math.abs(scrollVelocity) < 0.05) scrollVelocity = 0;
			if (reduced || activation === 0) {
				scrollVelocity = 0;
				bend = 0;
				bendVelocity = 0;
			} else {
				const targetBend = Math.min(MAX_VELOCITY_BEND, 0.012 * Math.abs(scrollVelocity));
				const seconds = delta / 1000;
				bendVelocity +=
					(SPRING_STIFFNESS * (targetBend - bend) - SPRING_DAMPING * bendVelocity) *
					seconds;
				bend = Math.max(-4, bend + bendVelocity * seconds);
				if (
					scrollVelocity === 0 &&
					Math.abs(bend) < 0.002 &&
					Math.abs(bendVelocity) < 0.02
				) {
					bend = 0;
					bendVelocity = 0;
				}
			}
			const geometry = getArticleTocRailGeometry({
				activation,
				dynamicBend: bend,
				height,
				progressY,
			});
			setAttribute(basePath, "d", geometry.path);
			setAttribute(accentPath, "d", geometry.path);
			setAttribute(accentPath, "stroke-dashoffset", `${0.06 - progressY / height}`);
			markerRefs.current.forEach((marker, index) => {
				const ratio = headingRatios[index];
				if (!marker || ratio === undefined) return;
				const markerY = ratio * height;
				setAttribute(marker, "cy", `${markerY}`);
				setAttribute(
					marker,
					"cx",
					`${getArticleTocRailMarkerX(markerY, progressY, geometry.bend, geometry.bendRange)}`,
				);
			});
			const transform = `translateY(${progressY}px) translateY(-50%)`;
			if (labelRef.current && labelRef.current.style.transform !== transform) {
				labelRef.current.style.transform = transform;
			}
			if (
				activation !== targetActivation ||
				progressY !== targetProgress ||
				scrollVelocity !== 0 ||
				bend !== 0 ||
				bendVelocity !== 0
			) {
				frame = requestAnimationFrame(update);
			} else previousTime = 0;
		};
		const wake = () => {
			if (!frame && !document.hidden && height > 0) frame = requestAnimationFrame(update);
		};
		wakeRef.current = wake;
		const measure = () => {
			const nextHeight = container.clientHeight;
			if (nextHeight === height) return;
			height = nextHeight;
			wake();
		};
		const onScroll = () => {
			scrollY = window.scrollY;
			wake();
		};
		const onVisibility = () => {
			if (document.hidden) {
				if (frame) cancelAnimationFrame(frame);
				frame = 0;
				previousTime = 0;
			} else {
				scrollY = window.scrollY;
				previousScroll = scrollY;
				measure();
				wake();
			}
		};
		const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
		observer?.observe(container);
		window.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("resize", measure, { passive: true });
		document.addEventListener("visibilitychange", onVisibility);
		wake();
		return () => {
			if (frame) cancelAnimationFrame(frame);
			wakeRef.current = () => {};
			observer?.disconnect();
			window.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", measure);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [hasItems]);

	useEffect(() => {
		inputsRef.current = inputs;
		wakeRef.current();
	}, [inputs]);

	return {
		accentPathRef,
		activeRootItem,
		basePathRef,
		containerRef,
		labelRef,
		markerRefs,
	};
}
