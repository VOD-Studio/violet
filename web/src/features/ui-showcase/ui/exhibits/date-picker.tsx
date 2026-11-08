import { DatePicker, type DateRange, DateRangePicker } from "@violet/ui";
import { useEffect, useRef, useState } from "react";
import { useStageContainer } from "../../hooks/use-stage-container";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

function DatePickerStage({ state }: ExhibitRenderProps) {
	const { ref, container } = useStageContainer();
	const [open, setOpen] = useState(false);
	const touched = useRef(false);
	const [date, setDate] = useState("2026-11-03");
	const [range, setRange] = useState<DateRange>({ start: "2026-10-28", end: "2026-11-03" });
	const [openRange, setOpenRange] = useState<DateRange>({ start: "2026-11-03" });
	const rangeMode = state === "range" || state === "datetime-range" || state === "open-ended";
	const datetime = state === "datetime" || state === "datetime-range";
	useEffect(() => {
		touched.current = false;
		if (
			!container ||
			state === "variants" ||
			state === "sizes" ||
			state === "states" ||
			typeof IntersectionObserver === "undefined"
		)
			return;
		const observer = new IntersectionObserver((entries) => {
			if (entries.at(-1)?.isIntersecting && !touched.current) setOpen(true);
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [container, state]);
	const floating = { container, collisionBoundary: container, open, onOpenChange: setOpen };
	return (
		<div
			ref={ref}
			className="relative flex size-full flex-col gap-4 px-8 pt-6"
			onPointerDownCapture={() => {
				touched.current = true;
			}}
			onKeyDownCapture={() => {
				touched.current = true;
			}}
		>
			<span className="text-12 text-muted-foreground">
				{rangeMode
					? "统计区间：两端可键入，日历可预览"
					: datetime
						? "发布时间：选日期与时分，确定后提交"
						: "发布日期：键入或选择，↑↓ 换周，PageUp / PageDown 换月"}
			</span>
			{state === "variants" ? (
				<div className="grid w-160 grid-cols-2 gap-4">
					{(["filled", "outline", "underline", "plain"] as const).map((variant) => (
						<DatePicker
							key={variant}
							aria-label={variant}
							variant={variant}
							defaultValue="2026-11-03"
							container={container}
							collisionBoundary={container}
						/>
					))}
					{(["filled", "outline", "underline", "plain"] as const).map((variant) => (
						<DateRangePicker
							key={`range-${variant}`}
							aria-label={`${variant} 区间`}
							variant={variant}
							defaultValue={{ start: "2026-10-28", end: "2026-11-03" }}
							container={container}
							collisionBoundary={container}
						/>
					))}
				</div>
			) : state === "sizes" ? (
				<div className="flex w-80 flex-col gap-4">
					{(["sm", "md", "lg"] as const).map((controlSize) => (
						<DatePicker
							key={controlSize}
							aria-label={controlSize}
							controlSize={controlSize}
							defaultValue="2026-11-03"
							container={container}
							collisionBoundary={container}
						/>
					))}
				</div>
			) : state === "states" ? (
				<div className="grid w-160 grid-cols-2 gap-4">
					<DatePicker aria-label="禁用日期" disabled defaultValue="2026-11-03" />
					<DatePicker aria-label="只读日期" readOnly defaultValue="2026-11-03" />
					<DatePicker
						aria-label="错误日期"
						invalid
						defaultValue="2026-11-03"
						container={container}
						collisionBoundary={container}
					/>
					<DatePicker
						aria-label="必填日期"
						required
						defaultValue="2026-11-03"
						container={container}
						collisionBoundary={container}
					/>
				</div>
			) : rangeMode ? (
				<div className={datetime ? "w-110" : "w-96"}>
					<DateRangePicker
						key={state}
						aria-label="统计区间"
						mode={datetime ? "datetime" : "date"}
						value={state === "open-ended" ? openRange : datetime ? undefined : range}
						defaultValue={
							datetime
								? { start: "2026-11-03T09:30", end: "2026-11-07T18:00" }
								: undefined
						}
						onChange={state === "open-ended" ? setOpenRange : setRange}
						presets={
							state === "open-ended"
								? [
										{ label: "从今天起", value: { start: "2026-11-03" } },
										{ label: "截至今天", value: { end: "2026-11-03" } },
									]
								: undefined
						}
						{...floating}
					/>
				</div>
			) : (
				<div className={datetime ? "w-80" : state === "time" ? "w-56" : "w-72"}>
					<DatePicker
						key={state}
						aria-label="发布日期"
						mode={datetime ? "datetime" : state === "time" ? "time" : "date"}
						value={datetime || state === "time" ? undefined : date}
						defaultValue={
							datetime ? "2026-11-03T09:30" : state === "time" ? "09:30" : undefined
						}
						onChange={setDate}
						min={state === "limited" ? "2026-10-15" : undefined}
						max={state === "limited" ? "2026-11-30" : undefined}
						disabledDate={
							state === "weekdays"
								? (day) => day.getDay() === 0 || day.getDay() === 6
								: undefined
						}
						{...floating}
					/>
				</div>
			)}
		</div>
	);
}

export const datePickerExhibit: Exhibit = {
	id: "date-picker",
	name: "日期选择",
	units: ["date-picker"],
	zone: "stage",
	category: "form",
	footprint: { width: 800, height: 720 },
	states: [
		{ id: "date", label: "单日期 · 展开" },
		{ id: "range", label: "范围 · 双月与预设" },
		{ id: "datetime", label: "日期时间" },
		{ id: "datetime-range", label: "日期时间范围" },
		{ id: "time", label: "仅时间" },
		{ id: "open-ended", label: "开放区间" },
		{ id: "limited", label: "限定范围" },
		{ id: "weekdays", label: "禁用周末" },
		{ id: "variants", label: "四种变体" },
		{ id: "sizes", label: "三种尺寸" },
		{ id: "states", label: "禁用 · 只读 · 错误 · 必填" },
	],
	Render: DatePickerStage,
};
