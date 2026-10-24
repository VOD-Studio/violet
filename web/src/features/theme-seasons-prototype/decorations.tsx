/**
 * PROTOTYPE（#645）：两种季节装饰，各占背景层与点缀位。
 *
 * 纹样：背景生命游戏的细胞换成季节纹样（桃花、水纹、桂花、雪花），点缀位是寄语旁的一枚印章。
 * 天光：背景换成季节光线（花雾、树影光斑、斜阳、霜窗），点缀位是寄语上方的节气。
 */
import { cn } from "cn";
import styles from "./decorations.module.css";
import {
	currentSeason,
	currentSolarTerm,
	SEASON_BY_KEY,
	SEASON_TERM,
	type SeasonKey,
} from "./directions";
import { resolveDecoSeason, usePrototype } from "./store";

export function useDecoration(): { season: SeasonKey | null; variant: "pattern" | "light" } {
	const decoPref = usePrototype((state) => state.decoPref);
	const themePref = usePrototype((state) => state.themePref);
	const variant = usePrototype((state) => state.deco);
	if (!import.meta.env.DEV) return { season: null, variant };
	return { season: resolveDecoSeason(decoPref, themePref), variant };
}

/** 背景层：天光。纹样由 useLifeCanvas 按 data-glyph 绘制。 */
export function SeasonLight({ season }: { season: SeasonKey }) {
	return (
		<div aria-hidden className={cn(styles.light, styles[season])}>
			<div className={cn(styles.layer, styles.a)} />
			<div className={cn(styles.layer, styles.b)} />
		</div>
	);
}

/** 点缀位：首页收尾寄语旁。 */
export function ClosingAccent({ placement }: { placement: "above" | "beside" }) {
	const { season, variant } = useDecoration();
	if (!season) return null;
	const term = season === currentSeason() ? currentSolarTerm() : SEASON_TERM[season];
	if (variant === "light" && placement === "above") {
		return <p className="mb-5 font-serif text-xs tracking-[0.6em] text-link">{term}</p>;
	}
	if (variant === "pattern" && placement === "beside") {
		return (
			<span aria-hidden className={styles.seal}>
				<span className="text-lg">{SEASON_BY_KEY[season].label}</span>
				<span className="text-[10px] tracking-[0.2em] [writing-mode:vertical-rl]">
					{term}
				</span>
			</span>
		);
	}
	return null;
}
