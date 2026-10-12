import { type RefObject, useEffect, useRef } from "react";

function Scrollbars({ viewport }: { viewport: "document" | RefObject<HTMLDivElement | null> }) {
	const barsRef = useRef<HTMLDivElement>(null);
	const vTrackRef = useRef<HTMLDivElement>(null);
	const hTrackRef = useRef<HTMLDivElement>(null);
	const vThumbRef = useRef<HTMLDivElement>(null);
	const hThumbRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const isDocument = viewport === "document";
		const el = isDocument ? document.scrollingElement : viewport.current;
		const bars = barsRef.current;
		const vTrack = vTrackRef.current;
		const hTrack = hTrackRef.current;
		const vThumb = vThumbRef.current;
		const hThumb = hThumbRef.current;
		if (!(el instanceof HTMLElement) || !bars || !vTrack || !hTrack || !vThumb || !hThumb) {
			return;
		}

		const originalScrollbar = el.getAttribute("data-scrollbar");
		if (isDocument) el.setAttribute("data-scrollbar", "none");
		const scrollTarget = isDocument ? document : el;
		const hoverTarget = isDocument ? bars : el.parentElement;
		let hovering = false;
		let dragging = false;
		let hideTimer: number | undefined;
		let frame = 0;
		let stopDragging: (() => void) | undefined;

		const showThumbs = () => {
			vThumb.style.opacity = "1";
			hThumb.style.opacity = "1";
			clearTimeout(hideTimer);
		};
		const scheduleHide = (delay: number) => {
			clearTimeout(hideTimer);
			hideTimer = window.setTimeout(() => {
				if (!hovering && !dragging) {
					vThumb.style.opacity = "0";
					hThumb.style.opacity = "0";
				}
			}, delay);
		};

		const update = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const {
					scrollTop,
					scrollLeft,
					scrollHeight,
					scrollWidth,
					clientHeight,
					clientWidth,
				} = el;
				const rootOverflow = isDocument ? getComputedStyle(el).overflowY : "";
				const bodyOverflow = isDocument ? getComputedStyle(document.body).overflowY : "";
				const locked =
					rootOverflow === "hidden" ||
					rootOverflow === "clip" ||
					bodyOverflow === "hidden" ||
					bodyOverflow === "clip";
				const canV = !locked && scrollHeight > clientHeight + 1;
				const canH = !locked && scrollWidth > clientWidth + 1;
				vTrack.style.display = canV ? "" : "none";
				hTrack.style.display = canH ? "" : "none";
				if (locked) stopDragging?.();

				if (canV) {
					const trackHeight = vTrack.clientHeight;
					const thumbHeight = Math.min(
						Math.max((clientHeight / scrollHeight) * trackHeight, 24),
						trackHeight,
					);
					vThumb.style.height = `${thumbHeight}px`;
					vThumb.style.transform = `translate3d(0,${(scrollTop / (scrollHeight - clientHeight)) * (trackHeight - thumbHeight)}px,0)`;
				}
				if (canH) {
					const trackWidth = hTrack.clientWidth;
					const thumbWidth = Math.min(
						Math.max((clientWidth / scrollWidth) * trackWidth, 24),
						trackWidth,
					);
					hThumb.style.width = `${thumbWidth}px`;
					hThumb.style.transform = `translate3d(${(scrollLeft / (scrollWidth - clientWidth)) * (trackWidth - thumbWidth)}px,0,0)`;
				}
			});
		};
		const onScroll = () => {
			update();
			showThumbs();
			scheduleHide(800);
		};
		const onMouseEnter = () => {
			hovering = true;
			showThumbs();
		};
		const onMouseLeave = () => {
			hovering = false;
			scheduleHide(400);
		};

		const startDrag = (event: PointerEvent, vertical: boolean) => {
			if (event.button !== 0) return;
			event.preventDefault();
			stopDragging?.();
			dragging = true;
			showThumbs();
			const thumb = vertical ? vThumb : hThumb;
			const startPointer = vertical ? event.clientY : event.clientX;
			const startScroll = vertical ? el.scrollTop : el.scrollLeft;
			const travel = vertical
				? vTrack.clientHeight - vThumb.getBoundingClientRect().height
				: hTrack.clientWidth - hThumb.getBoundingClientRect().width;
			const range = vertical
				? el.scrollHeight - el.clientHeight
				: el.scrollWidth - el.clientWidth;
			const ratio = travel > 0 ? range / travel : 0;
			const move = (next: PointerEvent) => {
				if (next.pointerId !== event.pointerId) return;
				const position =
					startScroll + ((vertical ? next.clientY : next.clientX) - startPointer) * ratio;
				if (vertical) el.scrollTop = position;
				else el.scrollLeft = position;
			};
			const stop = () => {
				thumb.removeEventListener("pointermove", move);
				thumb.removeEventListener("pointerup", finish);
				thumb.removeEventListener("pointercancel", finish);
				thumb.removeEventListener("lostpointercapture", finish);
				if (thumb.hasPointerCapture(event.pointerId))
					thumb.releasePointerCapture(event.pointerId);
				dragging = false;
				stopDragging = undefined;
				scheduleHide(800);
			};
			const finish = (next: PointerEvent) => {
				if (next.pointerId === event.pointerId) stop();
			};
			stopDragging = stop;
			thumb.setPointerCapture(event.pointerId);
			thumb.addEventListener("pointermove", move);
			thumb.addEventListener("pointerup", finish);
			thumb.addEventListener("pointercancel", finish);
			thumb.addEventListener("lostpointercapture", finish);
		};
		const onVPointerDown = (event: PointerEvent) => startDrag(event, true);
		const onHPointerDown = (event: PointerEvent) => startDrag(event, false);

		update();
		scrollTarget.addEventListener("scroll", onScroll, { passive: true });
		hoverTarget?.addEventListener("mouseenter", onMouseEnter);
		hoverTarget?.addEventListener("mouseleave", onMouseLeave);
		vThumb.addEventListener("pointerdown", onVPointerDown);
		hThumb.addEventListener("pointerdown", onHPointerDown);
		const resizeObserver = new ResizeObserver(update);
		resizeObserver.observe(el);
		const content = isDocument ? document.body : el.firstElementChild;
		if (content && content !== el) resizeObserver.observe(content);
		const lockObserver = isDocument ? new MutationObserver(update) : null;
		if (lockObserver) {
			const options = {
				attributes: true,
				attributeFilter: ["style", "class", "data-scroll-locked"],
			};
			lockObserver.observe(el, options);
			lockObserver.observe(document.body, options);
			window.addEventListener("resize", update);
		}

		return () => {
			stopDragging?.();
			cancelAnimationFrame(frame);
			clearTimeout(hideTimer);
			scrollTarget.removeEventListener("scroll", onScroll);
			hoverTarget?.removeEventListener("mouseenter", onMouseEnter);
			hoverTarget?.removeEventListener("mouseleave", onMouseLeave);
			vThumb.removeEventListener("pointerdown", onVPointerDown);
			hThumb.removeEventListener("pointerdown", onHPointerDown);
			resizeObserver.disconnect();
			lockObserver?.disconnect();
			if (isDocument) {
				window.removeEventListener("resize", update);
				if (originalScrollbar === null) el.removeAttribute("data-scrollbar");
				else el.setAttribute("data-scrollbar", originalScrollbar);
			}
		};
	}, [viewport]);

	return (
		<div
			ref={barsRef}
			className={
				viewport === "document"
					? "v-overlay-scrollbars v-overlay-scrollbars--document"
					: "v-overlay-scrollbars"
			}
			aria-hidden="true"
		>
			<div
				ref={vTrackRef}
				className="v-overlay-scrollbars__track v-overlay-scrollbars__track--vertical"
				style={{ display: "none" }}
			>
				<div ref={vThumbRef} className="v-overlay-scrollbars__thumb" />
			</div>
			<div
				ref={hTrackRef}
				className="v-overlay-scrollbars__track v-overlay-scrollbars__track--horizontal"
				style={{ display: "none" }}
			>
				<div ref={hThumbRef} className="v-overlay-scrollbars__thumb" />
			</div>
		</div>
	);
}

export default Scrollbars;
