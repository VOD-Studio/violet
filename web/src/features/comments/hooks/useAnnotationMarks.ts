import { getCommentAuthorPresentation } from "@entities/comment/lib/ai-personas";
import { type RefObject, useEffect, useState } from "react";
import { computeBlockId } from "../lib/block-id";
import { extractCandidateBlocks, findBlockElement, getBlockText } from "../lib/extract-blocks";
import { clearMarks, mapLegacyRangeToCarrier, wrapRange } from "../lib/range-marks";
import type { BlockCount } from "../model/types";

const MARK_CLASS = "annotation-mark";

/** 将摘要区间绑定到正文，并在异步公式与可运行块挂载后重新绑定。 */
export function useAnnotationMarks(
	contentRef: RefObject<HTMLElement | null>,
	summary: BlockCount[],
): Map<string, HTMLElement> {
	const [markerMap, setMarkerMap] = useState<Map<string, HTMLElement>>(new Map());

	useEffect(() => {
		const root = contentRef.current;
		if (!root) {
			setMarkerMap(new Map());
			return;
		}
		if (summary.length === 0) {
			clearMarks(root, MARK_CLASS);
			setMarkerMap(new Map());
			return;
		}

		let cancelled = false;
		let applyingMarks = false;
		let pendingCarrierMutation = false;
		let debounceTimer = 0;
		let runGeneration = 0;

		const applyMarks = async () => {
			const generation = ++runGeneration;
			await extractCandidateBlocks(root);
			if (cancelled || generation !== runGeneration) return;

			const nextMap = new Map<string, HTMLElement>();
			applyingMarks = true;
			try {
				clearMarks(root, MARK_CLASS);
				for (const { block_id, ranges } of summary) {
					if (cancelled || generation !== runGeneration) return;
					const el = await findBlockElement(root, block_id);
					if (cancelled || generation !== runGeneration) return;
					if (!el) continue;
					const carrier = getBlockText(el);
					const carrierId = await computeBlockId(carrier);
					if (cancelled || generation !== runGeneration) return;
					// 历史 KaTeX hash 的区间仍按旧 textContent 计长。
					const legacyMatch = carrierId !== null && carrierId !== block_id;
					for (const range of ranges ?? []) {
						const mapped = legacyMatch ? mapLegacyRangeToCarrier(el, range) : range;
						if (mapped.start <= 0 && mapped.end >= carrier.length) continue;
						wrapRange(el, mapped, MARK_CLASS, {
							annotationBlock: block_id,
							...(range.is_ai
								? {
										ai: "true",
										aiPersona:
											getCommentAuthorPresentation(range).personaId ??
											"unknown",
									}
								: {}),
						});
					}
					nextMap.set(block_id, el);
				}
			} finally {
				queueMicrotask(() => {
					if (cancelled || generation !== runGeneration) return;
					applyingMarks = false;
					if (pendingCarrierMutation) {
						pendingCarrierMutation = false;
						scheduleApply();
					}
				});
			}
			if (cancelled || generation !== runGeneration) return;
			setMarkerMap(nextMap);
		};

		const scheduleApply = () => {
			window.clearTimeout(debounceTimer);
			debounceTimer = window.setTimeout(() => {
				void applyMarks();
			}, 50);
		};

		void applyMarks();
		const observer = new MutationObserver((mutations) => {
			if (cancelled) return;
			const carrierDomChanged = mutations.some((mutation) => {
				for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
					if (!(node instanceof Element)) continue;
					if (node.classList.contains(MARK_CLASS) || node.tagName === "MARK") continue;
					if (
						node.classList.contains("katex") ||
						node.classList.contains("katex-display") ||
						node.querySelector(".katex, .katex-display") ||
						node.getAttribute("data-type") === "inline-math" ||
						node.getAttribute("data-type") === "block-math" ||
						node.getAttribute("data-runnable") === "true" ||
						node.querySelector("[data-runnable='true']")
					) {
						return true;
					}
				}
				return false;
			});
			if (!carrierDomChanged) return;
			if (applyingMarks) {
				pendingCarrierMutation = true;
				return;
			}
			scheduleApply();
		});
		observer.observe(root, { childList: true, subtree: true });

		return () => {
			cancelled = true;
			window.clearTimeout(debounceTimer);
			observer.disconnect();
			clearMarks(root, MARK_CLASS);
		};
	}, [contentRef, summary]);

	return markerMap;
}
