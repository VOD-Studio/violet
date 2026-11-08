"use client";

import { PickerPanel } from "../../lib/picker-panel";
import { ListHighlight, ListHighlightItem } from "../list-highlight";
import { Calendar } from "./calendar";
import {
	addMonths,
	formatPickerValue,
	isAllowed,
	orderRange,
	parsePickerValue,
	rangePresets,
} from "./date-utils";
import { TimeColumns } from "./time-columns";
import type { DateRangePickerProps } from "./types";
import type { DateRangeState } from "./use-date-range";

interface DateRangePanelProps {
	state: DateRangeState;
	props: DateRangePickerProps;
	panelId: string;
	calendarId: string;
}

export function DateRangePanel({ state, props, panelId, calendarId }: DateRangePanelProps) {
	const { mode = "date", presets, container, collisionBoundary } = props;
	const { picker } = state;
	const startDate = parsePickerValue(state.pending.start ?? "", mode);
	const endDate = parsePickerValue(state.pending.end ?? "", mode);
	const options = presets ?? rangePresets(mode);
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
				aria-label="选择日期范围"
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
					{options.length > 0 && (
						<ListHighlight>
							<div className="v-date-picker__presets">
								{options.map((preset) => (
									<ListHighlightItem key={preset.label}>
										<button
											type="button"
											className="v-date-picker__preset"
											disabled={!state.validRange(preset.value)}
											onClick={() => {
												state.commit(preset.value);
												picker.setOpen(false);
											}}
										>
											{preset.label}
										</button>
									</ListHighlightItem>
								))}
							</div>
						</ListHighlight>
					)}
					<div className="v-date-picker__calendars">
						{[0, 1].map((offset) => (
							<Calendar
								key={offset}
								id={picker.months && offset ? `${calendarId}-second` : calendarId}
								month={addMonths(picker.month, offset)}
								onMonthChange={(month) => {
									picker.setMonth(addMonths(month, -offset));
									picker.setActive(month);
								}}
								active={picker.active}
								keyboard={picker.keyboard}
								months={picker.months}
								onMonthsChange={(next, month) => {
									picker.setMonth(month);
									picker.changeMonths(next, month);
								}}
								range={{ start: startDate, end: endDate }}
								preview={state.selecting ? state.preview : null}
								onPreview={state.selecting ? state.setPreview : undefined}
								isDisabled={picker.dayDisabled}
								onSelect={state.choose}
								previous={offset === 0}
								next={offset === 1}
							/>
						))}
					</div>
				</div>
				{mode === "datetime" && (
					<div
						className="v-date-picker__range-times"
						data-presets={options.length > 0 || undefined}
					>
						{(["start", "end"] as const).map((side) => {
							const date = side === "start" ? startDate : endDate;
							const label = side === "start" ? "开始时间" : "结束时间";
							return (
								<div key={side} className="v-date-picker__endpoint-time">
									<div className="v-date-picker__endpoint-head">
										<span>{label}</span>
										<strong>
											{date ? formatPickerValue(date, "time") : "未设置"}
										</strong>
									</div>
									{date ? (
										<TimeColumns
											label={label}
											value={formatPickerValue(date, "time")}
											isDisabled={(time) => {
												const next = parsePickerValue(
													`${formatPickerValue(date, "date")}T${time}`,
													mode,
												);
												return !next || !isAllowed(next, state.constraints);
											}}
											onChange={(time) => {
												const range = {
													...state.pending,
													[side]: `${formatPickerValue(date, "date")}T${time}`,
												};
												state.setPending(range);
												state.setText({
													start: range.start ?? "",
													end: range.end ?? "",
												});
											}}
										/>
									) : (
										<p className="v-date-picker__time-empty">先选择日期</p>
									)}
								</div>
							);
						})}
					</div>
				)}
				<div className="v-date-picker__footer">
					<span className="v-date-picker__summary" role="status" aria-live="polite">
						{state.selecting
							? state.announcement
							: state.pending.start || state.pending.end
								? `${state.pending.start?.replace("T", " ") ?? "不限"} 至 ${state.pending.end?.replace("T", " ") ?? "不限"}`
								: "点一个起点"}
					</span>
					<button
						type="button"
						className="v-date-picker__action"
						onClick={() => picker.setOpen(false)}
					>
						取消
					</button>
					<button
						type="button"
						className="v-date-picker__confirm"
						disabled={!state.validRange(state.pending)}
						onClick={() => {
							state.commit(orderRange(state.pending));
							state.input.current?.focus({ preventScroll: true });
							picker.setOpen(false);
						}}
					>
						确定
					</button>
				</div>
			</div>
		</PickerPanel>
	);
}
