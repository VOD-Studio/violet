import type { Season } from "@shared/lib/theme-preference";
import { Button, Segmented } from "@violet/ui";
import { cn } from "cn";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCaseFit } from "../hooks/use-case-fit";
import { CATEGORIES } from "../model/category";
import { CASE_PADDING, type Exhibit, exhibitStatus, STATUS_LABEL, ZONES } from "../model/exhibit";
import type { ShowcaseSearch } from "../model/search";
import { CaseFitBadge } from "./CaseFitBadge";
import { plateNumber } from "./ExhibitCase";
import { ExhibitStage } from "./ExhibitStage";
import { type ShowcaseAppearance, ShowcaseScope } from "./ShowcaseScope";
import { ShowcaseToolbar } from "./ShowcaseToolbar";
import styles from "./showcase.module.css";

export interface InspectorProps {
	exhibit: Exhibit;
	/** 馆藏编号，从 1 开始 */
	number: number;
	total: number;
	appearance: ShowcaseAppearance;
	/** 工具栏上显示的季节；自定义主题且未选季节时为空串 */
	season: Season | "";
	outline: boolean;
	onChange: (patch: Partial<ShowcaseSearch>) => void;
	onStep: (offset: -1 | 1) => void;
	onClose: () => void;
}

const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/** 舞台里仍展开着的浮层：触发器的展开态，或挂在 Popper 外壳里、处于打开态的内容。 */
const OPEN_OVERLAY = [
	'[aria-expanded="true"]',
	...["open", "delayed-open", "instant-open"].map(
		(state) => `[data-radix-popper-content-wrapper] > [data-state="${state}"]`,
	),
].join(", ");

/** 打开期间让页面其余部分不可聚焦、不可滚动；之后由 Portal 新增的浮层不受影响。 */
function useModalIsolation(ref: React.RefObject<HTMLElement | null>) {
	useEffect(() => {
		let own = ref.current;
		while (own?.parentElement && own.parentElement !== document.body) own = own.parentElement;
		const isolated = Array.from(document.body.children).filter(
			(element): element is HTMLElement =>
				element instanceof HTMLElement && element !== own && !element.inert,
		);
		for (const element of isolated) element.inert = true;
		const root = document.documentElement;
		const overflow = root.style.overflow;
		root.style.overflow = "hidden";
		return () => {
			for (const element of isolated) element.inert = false;
			root.style.overflow = overflow;
		};
	}, [ref]);
}

/**
 * 检视台：全屏走近一件展品，切换状态、占地框、明暗、季节与减弱动态。
 *
 * @remarks Esc 先交给展品里展开的浮层收起；←/→ 在展品舞台与输入控件之外才切换上一件、下一件。
 */
export function Inspector(props: InspectorProps) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	return mounted ? createPortal(<InspectorDialog {...props} />, document.body) : null;
}

function InspectorDialog({
	exhibit,
	number,
	total,
	appearance,
	season,
	outline,
	onChange,
	onStep,
	onClose,
}: InspectorProps) {
	const dialogRef = useRef<HTMLDivElement>(null);
	const stageRef = useRef<HTMLDivElement>(null);
	const titleId = useId();
	const states = exhibit.states ?? [{ id: "default", label: "默认" }];
	// 换展品时回到它的陈列态，不经过 effect
	const [selection, setSelection] = useState({ exhibit: exhibit.id, state: states[0].id });
	const state = selection.exhibit === exhibit.id ? selection.state : states[0].id;
	const [fitRef, fit] = useCaseFit<HTMLDivElement>();
	const status = exhibitStatus(exhibit);
	useModalIsolation(dialogRef);

	useEffect(() => {
		dialogRef.current?.focus();
	}, []);

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		const target = event.target as HTMLElement;
		const stage = stageRef.current;
		if (event.key === "Escape") {
			// 展品自己的浮层还开着时，这次 Esc 归它
			if (stage?.querySelector(OPEN_OVERLAY)) return;
			// 展厅里常开的浮层会在文档层先吃掉 Esc 并标记 defaultPrevented；只有舞台内、
			// 或展品挂到作用域上的全屏浮层（焦点不在检视台本身）里的处理才算数
			if (
				event.defaultPrevented &&
				(stage?.contains(target) || !dialogRef.current?.contains(target))
			)
				return;
			event.preventDefault();
			onClose();
			return;
		}
		if (event.defaultPrevented) return;
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		if (stageRef.current?.contains(target) || target.closest(EDITABLE)) return;
		event.preventDefault();
		onStep(event.key === "ArrowLeft" ? -1 : 1);
	};

	return (
		<ShowcaseScope
			appearance={appearance}
			className="fixed inset-0 z-50 bg-background/90 backdrop-blur-xl"
		>
			{/* 滚动放在内层：展品挂到作用域上的全屏浮层才贴住视口，不随检视台滚动 */}
			<div className="size-full overflow-y-auto">
				<div
					ref={dialogRef}
					role="dialog"
					aria-modal="true"
					aria-labelledby={titleId}
					tabIndex={-1}
					onKeyDown={handleKeyDown}
					className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6 px-5 py-6 outline-none sm:px-10"
				>
					<div className="flex items-center justify-between gap-4">
						<p className="font-mono text-12 tracking-widest text-muted-foreground">
							走近 · № {plateNumber(number)} / {plateNumber(total)}
						</p>
						<div className="flex items-center gap-2">
							<Button
								iconOnly
								size="sm"
								variant="secondary"
								aria-label="上一件"
								aria-keyshortcuts="ArrowLeft"
								onClick={() => onStep(-1)}
							>
								<ChevronLeft aria-hidden="true" />
							</Button>
							<Button
								iconOnly
								size="sm"
								variant="secondary"
								aria-label="下一件"
								aria-keyshortcuts="ArrowRight"
								onClick={() => onStep(1)}
							>
								<ChevronRight aria-hidden="true" />
							</Button>
							<Button
								iconOnly
								size="sm"
								variant="secondary"
								aria-label="离开"
								aria-keyshortcuts="Escape"
								onClick={onClose}
							>
								<X aria-hidden="true" />
							</Button>
						</div>
					</div>
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						<h2 id={titleId} className="text-28 font-normal">
							{exhibit.name}
						</h2>
						<span className="font-mono text-12 text-muted-foreground">
							{exhibit.units.join(" / ")}
						</span>
						<span className="rounded-full bg-muted px-2 text-12 text-muted-foreground">
							{STATUS_LABEL[status]}
						</span>
					</div>
					<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
						{states.length > 1 && (
							<div className="-m-1 min-w-0 max-w-full overflow-x-auto scroll-px-1 p-1">
								<Segmented
									aria-label="展品状态"
									size="sm"
									variant="ink"
									value={state}
									onValueChange={(value) =>
										setSelection({ exhibit: exhibit.id, state: value })
									}
									segments={states.map(({ id, label }) => ({ value: id, label }))}
								/>
							</div>
						)}
						<ShowcaseToolbar
							season={season}
							mode={appearance.mode}
							outline={outline}
							reduced={appearance.reduced}
							onChange={onChange}
						/>
					</div>
					<div
						ref={fitRef}
						data-case=""
						className={cn(
							styles.case,
							"flex overflow-auto rounded-2xl outline-1 -outline-offset-1 outline-rule2",
						)}
						style={{ padding: CASE_PADDING }}
					>
						<div ref={stageRef} data-inspector-stage="" className="mx-auto self-center">
							<ExhibitStage exhibit={exhibit} state={state} outline={outline} />
						</div>
					</div>
					<dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-2 text-13">
						<dt className="text-muted-foreground">展区</dt>
						<dd>{ZONES.find((zone) => zone.id === exhibit.zone)?.name}</dd>
						<dt className="text-muted-foreground">用途</dt>
						<dd>
							{CATEGORIES.find((category) => category.id === exhibit.category)?.name}
						</dd>
						<dt className="text-muted-foreground">占地</dt>
						<dd className="font-mono">
							{exhibit.footprint.width} × {exhibit.footprint.height}
							<span className="ml-2 font-sans text-muted-foreground">含展开态</span>
						</dd>
						<dt className="text-muted-foreground">裁切检查</dt>
						<dd>
							<CaseFitBadge fit={fit} className="bg-muted" />
						</dd>
						{exhibit.issue !== undefined && (
							<>
								<dt className="text-muted-foreground">上架工单</dt>
								<dd>
									<a
										href={`https://github.com/VOD-Studio/violet/issues/${exhibit.issue}`}
										target="_blank"
										rel="noreferrer"
										className="font-mono text-link underline-offset-4 hover:underline"
									>
										#{exhibit.issue}
									</a>
								</dd>
							</>
						)}
					</dl>
				</div>
			</div>
		</ShowcaseScope>
	);
}
