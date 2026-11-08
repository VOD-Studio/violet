"use client";

import { PickerPanel } from "../../lib/picker-panel";
import { ListHighlight, ListHighlightItem } from "../list-highlight";
import { CalendarStrip } from "./calendar";
import { formatPickerValue, isAllowed, parsePickerValue } from "./date-utils";
import { TimeColumns } from "./time-columns";
import type { DatePickerProps } from "./types";
import type { DateValueState } from "./use-date-value";

interface DatePanelProps {
	state: DateValueState;
	props: DatePickerProps;
	panelId: string;
	calendarId: string;
}

export function DatePanel({ state, props, panelId, calendarId }: DatePanelProps) {
	const { mode = "date", presets, required, container, collisionBoundary } = props;
	const { picker } = state;
	return (
		<PickerPanel
			ref={picker.panel}
			id={panelId}
			open={picker.open}
			onOpenChange={picker.setOpen}
			anchorRef={picker.anchor}
			container={container}
			collisionBoundary={collisionBoundary}
			className="v-date-picker__panel"
		>
			<div
				role="dialog"
				aria-label={mode === "time" ? "选择时间" : "选择日期"}
				className="v-date-picker__surface"
				onBlur={(event) => {
					const target = event.relatedTarget as Node | null;
					if (
						!event.currentTarget.contains(target) &&
						!picker.anchor.current?.contains(target)
					)
						picker.setOpen(false);
				}}
			>
				<div className="v-date-picker__body">
					{presets?.length ? (
						<ListHighlight>
							<div className="v-date-picker__presets">
								{presets.map((preset) => {
									const date = parsePickerValue(preset.value, mode);
									const unavailable = preset.value
										? !date || !isAllowed(date, state.constraints)
										: !!required;
									return (
										<ListHighlightItem key={preset.label}>
											<button
												type="button"
												className="v-date-picker__preset"
												disabled={unavailable}
												onClick={() => {
													state.commit(
														date ? formatPickerValue(date, mode) : "",
													);
													picker.setOpen(false);
												}}
											>
												{preset.label}
											</button>
										</ListHighlightItem>
									);
								})}
							</div>
						</ListHighlight>
					) : null}
					{mode !== "time" && (
						<CalendarStrip
							count={1}
							id={calendarId}
							month={picker.month}
							onMonthChange={(month) => {
								picker.setMonth(month);
								picker.setActive(month);
							}}
							active={picker.active}
							keyboard={picker.keyboard}
							months={picker.months}
							onMonthsChange={picker.changeMonths}
							selected={state.pendingDate}
							isDisabled={picker.dayDisabled}
							onSelect={state.choose}
						/>
					)}
					{mode !== "date" && (
						<TimeColumns
							value={state.time}
							isDisabled={(next) => {
								const date = state.timeDate(next);
								return !date || !isAllowed(date, state.constraints);
							}}
							onChange={state.changeTime}
						/>
					)}
				</div>
				{mode !== "date" && (
					<div className="v-date-picker__footer">
						<button
							type="button"
							className="v-date-picker__action"
							disabled={!isAllowed(new Date(), state.constraints)}
							onClick={state.now}
						>
							现在
						</button>
						<button
							type="button"
							className="v-date-picker__confirm"
							disabled={
								!state.pendingDate ||
								!isAllowed(state.pendingDate, state.constraints)
							}
							onClick={() => {
								if (state.pendingDate)
									state.commit(formatPickerValue(state.pendingDate, mode));
								state.input.current?.focus({ preventScroll: true });
								picker.setOpen(false);
							}}
						>
							确定
						</button>
					</div>
				)}
			</div>
		</PickerPanel>
	);
}
