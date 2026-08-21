import { FireworksFX } from "./fireworks";
import { HeartRainFX } from "./heart-rain";
import { type MagicCircleConfig, MagicCircleFX } from "./magic-circle";
import { MeteorsFX } from "./meteors";
import { SpotlightFX } from "./spotlight";
import type { EffectMounts, StageEffect } from "./types";

/** 舞台特效门面:只负责创建、触发、推进和清理，不承载单个特效的绘制细节。 */
export class StageFX {
	private readonly effects: StageEffect[];
	private readonly magicCircle: MagicCircleFX;
	private readonly fireworks: FireworksFX;
	private readonly heartRain: HeartRainFX;
	private readonly meteors: MeteorsFX;
	private readonly spotlight: SpotlightFX;

	constructor(mounts: EffectMounts) {
		this.magicCircle = new MagicCircleFX(mounts);
		this.fireworks = new FireworksFX(mounts);
		this.heartRain = new HeartRainFX(mounts);
		this.meteors = new MeteorsFX(mounts);
		this.spotlight = new SpotlightFX(mounts);
		this.effects = [
			this.magicCircle,
			this.fireworks,
			this.heartRain,
			this.meteors,
			this.spotlight,
		];
	}

	magic(): void {
		this.magicCircle.trigger();
	}
	setMagicPersistent(enabled: boolean, config?: MagicCircleConfig): void {
		this.magicCircle.setPersistent(enabled, config);
	}

	configureMagic(config: MagicCircleConfig): void {
		this.magicCircle.setConfig(config);
	}

	fireworksBurst(): void {
		this.fireworks.trigger();
	}

	hearts(): void {
		this.heartRain.trigger();
	}

	meteorShower(): void {
		this.meteors.trigger();
	}

	spotlightBurst(): void {
		this.spotlight.trigger();
	}

	step(dt: number): void {
		for (const effect of this.effects) effect.step(dt);
	}

	clear(): void {
		for (const effect of this.effects) effect.clear();
	}
}
