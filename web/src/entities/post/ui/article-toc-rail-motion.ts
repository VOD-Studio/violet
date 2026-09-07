import { useReducedMotion } from "motion/react";
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
	clamp,
	getArticleTocRailGeometry,
	getArticleTocRailMarkerX,
} from "./article-toc-rail-geometry";

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
}

const MAX_VELOCITY_BEND = 14;
const SPRING_STIFFNESS = 90;
const SPRING_DAMPING = 2 * Math.sqrt(SPRING_STIFFNESS) * 0.75;

function sameRatios(previous: number[], next: number[]) {
	return (
		previous.length === next.length &&
		previous.every((ratio, index) => Math.abs(ratio - next[index]) < 0.0001)
	);
}

function useHeadingRatios(items: ArticleTocRailItem[], contentRef?: RefObject<HTMLElement | null>) {
	const fallback = useMemo(
		() => items.map((_, index) => (items.length > 1 ? index / (items.length - 1) : 0)),
		[items],
	);
	const [ratios, setRatios] = useState(fallback);

	useLayoutEffect(() => {
		const content = contentRef?.current;
		if (!content) {
			setRatios((current) => (sameRatios(current, fallback) ? current : fallback));
			return;
		}

		const measure = () => {
			const contentTop = content.getBoundingClientRect().top;
			const contentHeight =
				content.offsetHeight || content.getBoundingClientRect().height || 1;
			const next = items.map((item, index) => {
				const heading = document.getElementById(item.id);
				if (!heading || !content.contains(heading)) return fallback[index] ?? 0;
				return clamp(
					(heading.getBoundingClientRect().top - contentTop) / contentHeight,
					0,
					1,
				);
			});
			setRatios((current) => (sameRatios(current, next) ? current : next));
		};

		measure();
		const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
		observer?.observe(content);
		window.addEventListener("resize", measure, { passive: true });
		return () => {
			observer?.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, [contentRef, fallback, items]);

	return ratios;
}

function useArticleReadPercent(
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

/** 驱动目录轨迹、节点和标题标签的逐帧几何。 */
export function useArticleTocRailMotion({
	items,
	activeId,
	active,
	contentRef,
}: UseArticleTocRailMotionOptions) {
	const reduced = useReducedMotion();
	const activeIndex = Math.max(
		0,
		items.findIndex((item) => item.id === activeId),
	);
	const fallbackProgress = items.length > 1 ? (activeIndex / (items.length - 1)) * 100 : 0;
	const readPercent = useArticleReadPercent(contentRef, fallbackProgress);
	const headingRatios = useHeadingRatios(items, contentRef);
	const activeItem = items[activeIndex];
	const activeRootItem = activeItem
		? items.find((item) => item.id === activeItem.topId)
		: undefined;

	const containerRef = useRef<HTMLDivElement>(null);
	const basePathRef = useRef<SVGPathElement>(null);
	const accentPathRef = useRef<SVGPathElement>(null);
	const markerRefs = useRef<Array<SVGCircleElement | null>>([]);
	const labelRef = useRef<HTMLDivElement>(null);
	const activationRef = useRef(0);
	const displayedProgressRef = useRef(0);
	const scrollVelocityRef = useRef(0);
	const previousScrollRef = useRef<number | null>(null);
	const bendRef = useRef(0);
	const bendVelocityRef = useRef(0);
	const activeRef = useRef(active);
	const percentRef = useRef(readPercent);
	const ratiosRef = useRef(headingRatios);
	const reducedRef = useRef(Boolean(reduced));

	activeRef.current = active;
	percentRef.current = readPercent;
	ratiosRef.current = headingRatios;
	reducedRef.current = Boolean(reduced);

	useEffect(() => {
		let frame = 0;
		let previousTime = 0;
		const update = (timestamp: number) => {
			const delta = previousTime === 0 ? 16.67 : timestamp - previousTime;
			previousTime = timestamp;

			const container = containerRef.current;
			const basePath = basePathRef.current;
			const accentPath = accentPathRef.current;
			if (container && basePath && accentPath) {
				const height = container.clientHeight;
				if (height > 0) {
					const targetActivation = activeRef.current ? 1 : 0;
					const response = 1 - Math.exp(-delta / 140);
					const nextActivation = reducedRef.current
						? targetActivation
						: activationRef.current +
							(targetActivation - activationRef.current) * response;
					activationRef.current =
						Math.abs(targetActivation - nextActivation) < 0.002
							? targetActivation
							: nextActivation;

					const targetProgress = (percentRef.current / 100) * height;
					displayedProgressRef.current =
						reducedRef.current || activationRef.current === 0
							? targetProgress
							: displayedProgressRef.current +
								(targetProgress - displayedProgressRef.current) *
									Math.min(1, response * 1.4);

					if (activationRef.current !== 0 || activeRef.current) {
						const scrollY = window.scrollY;
						const instantaneousVelocity =
							previousScrollRef.current === null
								? 0
								: ((scrollY - previousScrollRef.current) / delta) * 1000;
						previousScrollRef.current = scrollY;
						scrollVelocityRef.current +=
							(instantaneousVelocity - scrollVelocityRef.current) *
							Math.min(1, delta / 80);

						const velocityBend = reducedRef.current
							? 0
							: Math.min(
									MAX_VELOCITY_BEND,
									0.012 * Math.abs(scrollVelocityRef.current),
								);
						const seconds = Math.min(delta, 64) / 1000;
						bendVelocityRef.current +=
							(SPRING_STIFFNESS * (velocityBend - bendRef.current) -
								SPRING_DAMPING * bendVelocityRef.current) *
							seconds;
						bendRef.current = reducedRef.current
							? 0
							: Math.max(-4, bendRef.current + bendVelocityRef.current * seconds);

						const progressY = displayedProgressRef.current;
						const { bend, bendRange, path } = getArticleTocRailGeometry({
							activation: activationRef.current,
							dynamicBend: bendRef.current,
							height,
							progressY,
							reduced: reducedRef.current,
							timestamp,
						});

						basePath.setAttribute("d", path);
						accentPath.setAttribute("d", path);
						accentPath.setAttribute(
							"stroke-dashoffset",
							`${0.06 - progressY / height}`,
						);

						markerRefs.current.forEach((marker, index) => {
							const ratio = ratiosRef.current[index];
							if (!marker || ratio === undefined) return;
							const markerY = ratio * height;
							marker.setAttribute("cy", `${markerY}`);
							marker.setAttribute(
								"cx",
								`${getArticleTocRailMarkerX(markerY, progressY, bend, bendRange)}`,
							);
						});

						if (labelRef.current) {
							labelRef.current.style.transform = `translateY(${progressY}px) translateY(-50%)`;
						}
					}
				}
			}
			frame = requestAnimationFrame(update);
		};

		frame = requestAnimationFrame(update);
		return () => cancelAnimationFrame(frame);
	}, []);

	return {
		accentPathRef,
		activeRootItem,
		basePathRef,
		containerRef,
		labelRef,
		markerRefs,
		readPercent,
	};
}
