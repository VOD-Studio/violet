/** 演示页用到的 @violetjs/pet 线上协议子集;完整类型见 pet/packages/pet-sdk/src/types.d.ts。 */
export type Pose =
	| "idle"
	| "observe"
	| "eat"
	| "play"
	| "sleep"
	| "startled"
	| "sick"
	| "evolve"
	| "end";

export type Phase = "healthy" | "warned" | "sick" | "dead";
export type Mood = "sick" | "hungry" | "tired" | "happy" | "content";
export type SimpleAction = "feed" | "rest" | "play" | "heal" | "wait";
export type Branch = "curious" | "gentle" | "steady" | "sage" | "guardian" | "wanderer" | "radiant";

export interface PetState {
	id: string;
	satiety: number;
	energy: number;
	food: number;
	medicine: number;
	last_tick: string;
	growth?: { exp: number; stage: string; traits: number[] };
}

export interface Outcome {
	pet: PetState;
	phase: Phase;
	mood: Mood;
	replayed: boolean;
}

export interface BranchOption {
	branch: Branch;
	to_stage: string;
	eligible: boolean;
	missing: { kind: string; have: number; need: number }[];
}

export interface Born {
	id: string;
	species: number;
	genes: number[];
	rarity: number;
	pet: PetState;
}

export interface Sprite {
	w: number;
	h: number;
	/** 每个字符是 palette 的键,`.` 为透明。 */
	rows: string[];
	palette: Record<string, string>;
}

export interface WireError {
	ok: false;
	code: string;
	message: string;
}

export type Wire<T> = { ok: true; value: T } | WireError;

/** public/pet-sdk 下 SDK 入口暴露的同步调用面。 */
export interface PetSdk {
	initPet(module?: string | URL): Promise<unknown>;
	run<T>(command: Record<string, unknown>): Wire<T>;
}
