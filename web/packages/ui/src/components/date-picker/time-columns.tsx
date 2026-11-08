"use client";

import { useLayoutEffect, useRef } from "react";
import { ListHighlight, ListHighlightItem } from "../list-highlight";

interface TimeColumnsProps {
	value: string;
	onChange: (time: string) => void;
	isDisabled?: (time: string) => boolean;
	label?: string;
}

export function TimeColumns({ value, onChange, isDisabled, label = "时间" }: TimeColumnsProps) {
	const [hour = "00", minute = "00"] = value.split(":");
	return (
		<div className="v-date-picker__time" role="group" aria-label={label}>
			<TimeColumn
				label={`${label}：时`}
				count={24}
				value={hour}
				onChange={(next) => {
					if (!isDisabled?.(`${next}:${minute}`)) {
						onChange(`${next}:${minute}`);
						return;
					}
					for (let index = 0; index < 60; index++) {
						const candidate = `${next}:${String(index).padStart(2, "0")}`;
						if (!isDisabled(candidate)) {
							onChange(candidate);
							return;
						}
					}
				}}
				isDisabled={(next) => {
					for (let index = 0; index < 60; index++) {
						if (!isDisabled?.(`${next}:${String(index).padStart(2, "0")}`))
							return false;
					}
					return true;
				}}
			/>
			<TimeColumn
				label={`${label}：分`}
				count={60}
				value={minute}
				onChange={(next) => onChange(`${hour}:${next}`)}
				isDisabled={(next) => !!isDisabled?.(`${hour}:${next}`)}
			/>
		</div>
	);
}

interface TimeColumnProps {
	label: string;
	count: number;
	value: string;
	onChange: (value: string) => void;
	isDisabled: (value: string) => boolean;
}

function TimeColumn({ label, count, value, onChange, isDisabled }: TimeColumnProps) {
	const list = useRef<HTMLDivElement>(null);
	const options = Array.from({ length: count }, (_, index) => String(index).padStart(2, "0"));
	const tabValue = isDisabled(value) ? options.find((option) => !isDisabled(option)) : value;
	useLayoutEffect(() => {
		const center = () => {
			const container = list.current;
			const selected = container?.querySelector<HTMLElement>(`[data-value="${value}"]`);
			if (!container || !selected) return;
			// 用相对位置而不是 offsetTop：不依赖谁是 offsetParent，面板定位完成后再校正一次
			const gap =
				selected.getBoundingClientRect().top - container.getBoundingClientRect().top;
			container.scrollTop += gap - (container.clientHeight - selected.offsetHeight) / 2;
		};
		center();
		const frame = requestAnimationFrame(center);
		return () => cancelAnimationFrame(frame);
	}, [value]);
	return (
		<div className="v-date-picker__time-column">
			<span className="v-date-picker__time-label" aria-hidden>
				{label.endsWith("时") ? "时" : "分"}
			</span>
			<div ref={list} className="v-date-picker__time-scroll" role="group" aria-label={label}>
				<ListHighlight>
					<div className="v-date-picker__time-list">
						{options.map((next) => {
							return (
								<ListHighlightItem key={next}>
									<button
										type="button"
										className="v-date-picker__time-option"
										aria-label={`${label} ${next}`}
										aria-pressed={next === value}
										data-value={next}
										tabIndex={next === tabValue ? 0 : -1}
										disabled={isDisabled(next)}
										onClick={() => onChange(next)}
										onKeyDown={(event) => {
											if (
												!["ArrowUp", "ArrowDown", "Home", "End"].includes(
													event.key,
												)
											)
												return;
											event.preventDefault();
											const buttons = Array.from(
												list.current?.querySelectorAll<HTMLButtonElement>(
													"button:not(:disabled)",
												) ?? [],
											);
											const current = buttons.indexOf(event.currentTarget);
											const target =
												event.key === "Home"
													? 0
													: event.key === "End"
														? buttons.length - 1
														: Math.max(
																0,
																Math.min(
																	buttons.length - 1,
																	current +
																		(event.key === "ArrowUp"
																			? -1
																			: 1),
																),
															);
											const button = buttons[target];
											button?.focus();
											button?.click();
										}}
									>
										{next}
									</button>
								</ListHighlightItem>
							);
						})}
					</div>
				</ListHighlight>
			</div>
		</div>
	);
}
