import { cn } from "cn";
import { useCaseFit } from "../hooks/use-case-fit";
import { CASE_PADDING, type Exhibit, exhibitStatus, STATUS_LABEL } from "../model/exhibit";
import { CaseFitBadge } from "./CaseFitBadge";
import { ExhibitStage } from "./ExhibitStage";
import styles from "./showcase.module.css";

export interface ExhibitCaseProps {
	exhibit: Exhibit;
	/** 馆藏编号，从 1 开始 */
	number: number;
	total: number;
	outline: boolean;
	onOpen: () => void;
}

/** 两位数的铭牌编号。 */
export const plateNumber = (value: number) => String(value).padStart(2, "0");

/**
 * 展柜：柜内按占地陈列可操作的真实组件，柜下台座的铭牌是走近入口。
 */
export function ExhibitCase({ exhibit, number, total, outline, onOpen }: ExhibitCaseProps) {
	const [ref, fit] = useCaseFit<HTMLDivElement>();
	const { width, height } = exhibit.footprint;
	const slug = exhibit.units.join(" / ");
	const status = exhibitStatus(exhibit);
	return (
		<figure
			data-exhibit={exhibit.id}
			data-footprint-width={width}
			data-footprint-height={height}
			data-status={status}
			className={cn(
				"m-0 flex min-w-0 flex-col",
				exhibit.zone === "banner" && "col-span-full",
			)}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: 点柜内空白走近只是指针便捷入口，键盘入口是下方铭牌 */}
			<div
				ref={ref}
				data-case=""
				className={cn(
					styles.case,
					"flex cursor-zoom-in overflow-auto rounded-t-2xl outline-1 -outline-offset-1 outline-rule2",
				)}
				style={{ padding: CASE_PADDING }}
				onClick={(event) => {
					if (event.target === event.currentTarget) onOpen();
				}}
			>
				<div className="mx-auto cursor-auto self-center">
					<ExhibitStage
						exhibit={exhibit}
						state={exhibit.states?.[0]?.id ?? "default"}
						outline={outline}
					/>
				</div>
			</div>
			<figcaption>
				<button
					type="button"
					data-plinth=""
					aria-label={`走近 ${exhibit.name}`}
					onClick={onOpen}
					className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-5 gap-y-1.5 rounded-b-lg bg-foreground px-5 py-2.5 text-left text-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-nowrap"
				>
					<span className="shrink-0 font-mono text-12 tracking-widest opacity-70">
						№ {plateNumber(number)} / {plateNumber(total)}
					</span>
					<span className="flex min-w-0 items-baseline gap-2 sm:flex-1 sm:justify-center">
						<b className="shrink-0 text-14 font-semibold">{exhibit.name}</b>
						<span className="truncate font-mono text-12 opacity-70" title={slug}>
							{slug}
						</span>
					</span>
					<span className="flex shrink-0 items-center gap-3">
						<span className="text-12 opacity-70">{STATUS_LABEL[status]}</span>
						<CaseFitBadge fit={fit} />
					</span>
				</button>
			</figcaption>
		</figure>
	);
}
