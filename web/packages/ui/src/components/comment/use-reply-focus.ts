import { useLayoutEffect, useRef } from "react";

const EDITABLE_SELECTOR = [
	"input:not([type])",
	"input[type='text']",
	"input[type='search']",
	"input[type='email']",
	"input[type='url']",
	"input[type='tel']",
	"input[type='number']",
	"input[type='password']",
	"textarea",
	"[contenteditable='']",
	"[contenteditable='true']",
	"[contenteditable='plaintext-only']",
].join(",");

function firstEditable(root: HTMLElement) {
	return Array.from(root.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)).find((element) => {
		if (
			element.matches(":disabled, [readonly]") ||
			element.closest("[hidden], [inert], [aria-hidden='true']")
		) {
			return false;
		}
		for (
			let ancestor: HTMLElement | null = element;
			ancestor;
			ancestor = ancestor.parentElement
		) {
			const style = getComputedStyle(ancestor);
			if (style.display === "none" || style.visibility === "hidden") {
				return false;
			}
			if (ancestor === root) {
				break;
			}
		}
		return true;
	});
}

export function useReplyFocus(open: boolean, onReply: (() => void) | undefined) {
	const formRef = useRef<HTMLDivElement>(null);
	const replyButtonRef = useRef<HTMLButtonElement>(null);
	const ownsFocus = useRef(false);
	const lastFocused = useRef<HTMLElement | null>(null);

	useLayoutEffect(() => {
		if (!open) {
			const previous = lastFocused.current;
			if (
				ownsFocus.current &&
				previous &&
				!previous.isConnected &&
				document.activeElement === document.body
			) {
				replyButtonRef.current?.focus({ preventScroll: true });
			}
			ownsFocus.current = false;
			lastFocused.current = null;
			return;
		}

		const form = formRef.current;
		if (!form) {
			return;
		}
		const onFocus = (event: FocusEvent) => {
			const target = event.target;
			ownsFocus.current = target instanceof HTMLElement && form.contains(target);
			if (ownsFocus.current && target instanceof HTMLElement) {
				lastFocused.current = target;
			}
		};
		const onBlur = (event: FocusEvent) => {
			const target = event.target;
			if (event.relatedTarget !== null || !(target instanceof HTMLElement)) {
				return;
			}
			// Chromium 在卸载前派发 focusout；提交完成后才能区分主动失焦与节点移除。
			queueMicrotask(() => {
				if (target.isConnected && !form.contains(document.activeElement)) {
					ownsFocus.current = false;
				}
			});
		};
		const onPointerDown = (event: PointerEvent) => {
			if (event.target instanceof Node && !form.contains(event.target)) {
				ownsFocus.current = false;
			}
		};
		const onWindowBlur = () => {
			ownsFocus.current = false;
		};

		document.addEventListener("focusin", onFocus);
		document.addEventListener("focusout", onBlur);
		document.addEventListener("pointerdown", onPointerDown, true);
		window.addEventListener("blur", onWindowBlur);
		firstEditable(form)?.focus({ preventScroll: true });
		const active = document.activeElement;
		if (active instanceof HTMLElement && form.contains(active)) {
			ownsFocus.current = true;
			lastFocused.current = active;
		}

		return () => {
			document.removeEventListener("focusin", onFocus);
			document.removeEventListener("focusout", onBlur);
			document.removeEventListener("pointerdown", onPointerDown, true);
			window.removeEventListener("blur", onWindowBlur);
		};
	}, [open]);

	const cancel = () => {
		// Safari 指针点击按钮不保证聚焦；显式取消仍应回到原回复入口。
		ownsFocus.current = true;
		lastFocused.current = formRef.current;
		onReply?.();
	};

	return { formRef, replyButtonRef, cancel };
}
