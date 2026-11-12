import { type PointerEvent, useCallback, useEffect, useRef } from "react";

export function useNumberHold(step: (direction: number) => void, disabled: boolean) {
	const delay = useRef<number | undefined>(undefined);
	const repeat = useRef<number | undefined>(undefined);
	const latestStep = useRef(step);
	latestStep.current = step;
	const stop = useCallback(() => {
		clearTimeout(delay.current);
		clearInterval(repeat.current);
		delay.current = undefined;
		repeat.current = undefined;
	}, []);
	useEffect(() => {
		if (disabled) stop();
	}, [disabled, stop]);
	useEffect(() => {
		window.addEventListener("pointerup", stop);
		window.addEventListener("pointercancel", stop);
		window.addEventListener("blur", stop);
		return () => {
			stop();
			window.removeEventListener("pointerup", stop);
			window.removeEventListener("pointercancel", stop);
			window.removeEventListener("blur", stop);
		};
	}, [stop]);
	const start = (event: PointerEvent<HTMLButtonElement>, direction: number) => {
		if (event.button !== 0 || disabled || event.currentTarget.disabled) return;
		event.preventDefault();
		stop();
		const multiplier = event.shiftKey ? 10 : 1;
		latestStep.current(direction * multiplier);
		delay.current = window.setTimeout(() => {
			repeat.current = window.setInterval(
				() => latestStep.current(direction * multiplier),
				80,
			);
		}, 420);
	};
	return { start, stop };
}
