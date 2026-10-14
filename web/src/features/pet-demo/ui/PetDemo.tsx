import { Button, Segmented } from "@violet/ui";
import { Gamepad2, Hourglass, Moon, Pill, Utensils } from "lucide-react";
import { SPEEDS, usePetDemo } from "../hooks/usePetDemo";
import {
	BRANCH_NAMES,
	MISSING_NAMES,
	MOOD_NAMES,
	PHASE_NAMES,
	RARITY_NAMES,
	SPECIES_NAMES,
	STAGE_NAMES,
} from "../model/labels";
import type { SimpleAction } from "../model/types";
import { PetGallery } from "./PetGallery";
import { PetHatching } from "./PetHatching";
import { PetScene } from "./PetScene";

const SPEED_SEGMENTS = SPEEDS.map((s) => ({
	value: String(s),
	label: s === 1 ? "实时" : s === 10 ? "10 分钟/秒" : "1 小时/秒",
}));

function formatElapsed(minutes: number): string {
	const d = Math.floor(minutes / 1440);
	const h = Math.floor((minutes % 1440) / 60);
	if (d > 0) return `${d} 天 ${h} 小时`;
	return h > 0 ? `${h} 小时 ${minutes % 60} 分` : `${minutes} 分钟`;
}

const METER_CELLS = 10;

/** 十格计量:填充取宠物自己的主色,空格只描边。 */
function Meter({ label, value, color }: { label: string; value: number; color: string }) {
	const filled = Math.ceil((value / 100) * METER_CELLS);
	return (
		<div className="flex items-center gap-3">
			<span className="w-10 text-sm text-muted-foreground">{label}</span>
			<div
				className="flex flex-1 gap-1"
				role="meter"
				aria-label={label}
				aria-valuenow={value}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				{Array.from({ length: METER_CELLS }, (_, i) => (
					<span
						key={i}
						className={`h-3 flex-1 rounded-xs ${i < filled ? "" : "ring-1 ring-border ring-inset"}`}
						style={i < filled ? { backgroundColor: color } : undefined}
					/>
				))}
			</div>
			<span className="w-8 text-right font-mono text-sm tabular-nums">{value}</span>
		</div>
	);
}

/** 与加载完成后同形的占位:蛋在舞台里孵化,右侧只留轮廓。 */
function HatchingPlaceholder() {
	const bar = "h-4 rounded-xs ring-1 ring-border ring-inset";
	return (
		<div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true">
			<section className="space-y-4">
				<div className="rounded-2xl px-4 pt-8 pb-4 ring-1 ring-border">
					<PetHatching />
				</div>
				<p className="text-center text-sm text-muted-foreground" role="status">
					正在唤醒规则核心…
				</p>
			</section>
			<aside className="hidden space-y-8 lg:block" aria-hidden>
				<div className="space-y-3">
					<div className={`${bar} h-8 w-40`} />
					<div className={`${bar} w-56`} />
				</div>
				<div className="space-y-3">
					<div className={bar} />
					<div className={bar} />
				</div>
				<div className="space-y-3">
					<div className={`${bar} w-24`} />
					<div className={`${bar} w-48`} />
					<div className={`${bar} w-40`} />
				</div>
			</aside>
		</div>
	);
}

/** 独立电子宠物的浏览器演示:规则核心以 WebAssembly 在本页运行,不访问任何服务。 */
export function PetDemo() {
	const demo = usePetDemo();

	if (demo.status === "loading") {
		return <HatchingPlaceholder />;
	}
	if (demo.status === "missing") {
		return (
			<div className="space-y-2 text-sm">
				<p>尚未同步宠物 SDK 构建产物。在 web 目录执行：</p>
				<p className="font-mono">pnpm pet:sync</p>
				<p className="text-muted-foreground">
					需要 cargo、wasm32-unknown-unknown 目标与 wasm-bindgen，完成后刷新本页。
				</p>
			</div>
		);
	}
	if (demo.status === "error" || !demo.outcome || !demo.born) {
		return <p className="text-sm text-destructive">规则核心加载失败：{demo.error}</p>;
	}

	const { pet, phase, mood } = demo.outcome;
	const dead = phase === "dead";
	const stage = pet.growth?.stage ?? "baby";
	const color = demo.sprite?.palette.b ?? "currentColor";
	const species = SPECIES_NAMES[demo.born.species % SPECIES_NAMES.length];
	const actions: {
		id: SimpleAction;
		label: string;
		icon: React.ReactNode;
		stock?: string;
		off?: boolean;
	}[] = [
		{
			id: "feed",
			label: "喂食",
			icon: <Utensils />,
			stock: `食物 ${pet.food}`,
			off: pet.food === 0,
		},
		{ id: "rest", label: "休息", icon: <Moon /> },
		{ id: "play", label: "玩耍", icon: <Gamepad2 /> },
		{
			id: "heal",
			label: "治疗",
			icon: <Pill />,
			stock: `药品 ${pet.medicine}`,
			off: pet.medicine === 0,
		},
		{ id: "wait", label: "陪伴", icon: <Hourglass /> },
	];

	return (
		<div className="space-y-16">
			<div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<section className="space-y-6">
					<div className="rounded-2xl px-4 pt-8 pb-4 ring-1 ring-border">
						{demo.sprite ? (
							<PetScene
								sprite={demo.sprite}
								label={`${species}，${STAGE_NAMES[stage]}`}
							/>
						) : null}
					</div>

					<div className="flex flex-wrap gap-3">
						{actions.map((a) => (
							<Button
								key={a.id}
								variant="outline"
								leftIcon={a.icon}
								disabled={dead || a.off}
								onClick={() => demo.act(a.id)}
							>
								{a.label}
								{a.stock ? (
									<span className="ml-1 text-xs text-muted-foreground">
										{a.stock}
									</span>
								) : null}
							</Button>
						))}
					</div>

					<p className="min-h-5 text-sm text-destructive" role="status">
						{demo.notice}
					</p>

					<div className="grid gap-8 sm:grid-cols-2">
						<section className="space-y-2">
							<h3 className="text-sm font-medium">时间流速</h3>
							<Segmented
								variant="line"
								value={String(demo.speed)}
								onValueChange={(v) => demo.setSpeed(Number(v))}
								segments={SPEED_SEGMENTS}
								aria-label="时间流速"
							/>
							<p className="text-xs text-muted-foreground">
								调到「1 小时/秒」，几十秒内就能看到饥饿、生病和离世。
							</p>
						</section>

						<section className="space-y-2">
							<h3 className="text-sm font-medium">动态</h3>
							<ul className="space-y-1 text-sm text-muted-foreground">
								{demo.log.map((line, i) => (
									<li
										key={`${i}-${line}`}
										className={i === 0 ? "text-foreground" : undefined}
									>
										{line}
									</li>
								))}
							</ul>
						</section>
					</div>
				</section>

				<aside className="space-y-8">
					<div>
						<div className="flex items-start justify-between gap-4">
							<h2 className="text-2xl font-semibold tracking-tight">{species}</h2>
							<Button variant="ghost" size="xs" onClick={demo.hatch}>
								重新孵化
							</Button>
						</div>
						<p className="mt-1 text-sm text-muted-foreground">
							{STAGE_NAMES[stage]} · {RARITY_NAMES[demo.born.rarity] ?? "未知"} ·
							已陪伴 {formatElapsed(demo.tick)}
						</p>
						<p className="mt-3 text-base">
							{PHASE_NAMES[phase]}
							{dead ? "" : `，${MOOD_NAMES[mood]}`}
						</p>
					</div>

					<div className="space-y-3">
						<Meter label="饱食" value={pet.satiety} color={color} />
						<Meter label="精力" value={pet.energy} color={color} />
						<p className="text-sm text-muted-foreground">经验 {pet.growth?.exp ?? 0}</p>
					</div>

					<section className="space-y-3">
						<h3 className="text-sm font-medium">进化方向</h3>
						{demo.options.length === 0 ? (
							<p className="text-sm text-muted-foreground">已是最终形态。</p>
						) : (
							<ul className="space-y-3">
								{demo.options.map((o) => (
									<li
										key={o.branch}
										className="flex items-start justify-between gap-4"
									>
										<div className="min-w-0">
											<p className="text-sm">{BRANCH_NAMES[o.branch].name}</p>
											<p className="text-xs text-muted-foreground">
												{o.eligible
													? BRANCH_NAMES[o.branch].hint
													: o.missing
															.map(
																(m) =>
																	`${MISSING_NAMES[m.kind] ?? m.kind} ${m.have}/${m.need}`,
															)
															.join(" · ")}
											</p>
										</div>
										{o.eligible && !dead ? (
											<Button
												size="xs"
												variant="primary"
												onClick={() => demo.evolve(o.branch)}
											>
												进化
											</Button>
										) : null}
									</li>
								))}
							</ul>
						)}
					</section>
				</aside>
			</div>
			<PetGallery render={demo.renderSprite} />
		</div>
	);
}
