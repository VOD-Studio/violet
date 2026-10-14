import { useCallback, useEffect, useRef, useState } from "react";
import { loadPetSdk, randomSeed } from "../lib/sdk";
import { BRANCH_NAMES, ERROR_NAMES, STAGE_INDEX } from "../model/labels";
import type {
	Born,
	Branch,
	BranchOption,
	Outcome,
	PetSdk,
	Pose,
	SimpleAction,
	Sprite,
	Wire,
} from "../model/types";

export type DemoStatus = "loading" | "missing" | "error" | "ready";

/** 逻辑分钟 / 真实秒。结算间隔 250ms,最大档单次间隔 15 分钟,低于规则核心的 30 分钟离开阈值。 */
export const SPEEDS = [1, 10, 60] as const;
const SETTLE_MS = 250;
const FRAME_MS = 400;
const POSE_HOLD_MS = 2400;
const SPRITE_W = 30;
const SPRITE_H = 16;

const ACTION_LOG: Record<SimpleAction, string> = {
	feed: "喂了一顿，饱食回升",
	rest: "睡了一觉，精力恢复",
	play: "一起玩了一会儿",
	heal: "吃了药，好多了",
	wait: "静静陪着它",
};

const LOG_LIMIT = 6;

const ACTION_POSE: Record<SimpleAction, Pose> = {
	feed: "eat",
	rest: "sleep",
	play: "play",
	heal: "observe",
	wait: "idle",
};

function idlePose(outcome: Outcome | null, t: number): Pose {
	if (!outcome) return "idle";
	if (outcome.phase === "dead") return "end";
	if (outcome.phase === "sick") return "sick";
	if (outcome.mood === "tired") return "sleep";
	return t % 8 < 5 ? "idle" : "observe";
}

/** 驱动演示页:加载 SDK、孵化、按倍速结算、渲染帧、执行动作。逻辑时间只存在于浏览器内存。 */
export function usePetDemo() {
	const [status, setStatus] = useState<DemoStatus>("loading");
	const [born, setBorn] = useState<Born | null>(null);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const [sprite, setSprite] = useState<Sprite | null>(null);
	const [log, setLog] = useState<string[]>([]);
	const [options, setOptions] = useState<BranchOption[]>([]);
	const [notice, setNotice] = useState<string>("");
	const [speed, setSpeedState] = useState<number>(10);
	const [tick, setTick] = useState(0);
	const [error, setError] = useState("");

	const sdkRef = useRef<PetSdk | null>(null);
	const petRef = useRef<Outcome["pet"] | null>(null);
	const clock = useRef({ real: performance.now(), logical: 0, speed: 10 });
	const seq = useRef(0);
	const override = useRef<{ pose: Pose; until: number } | null>(null);
	const frameT = useRef(0);
	const outcomeRef = useRef<Outcome | null>(null);

	const nowTick = useCallback(() => {
		const c = clock.current;
		return c.logical + Math.floor(((performance.now() - c.real) / 1000) * c.speed);
	}, []);

	const applyOutcome = useCallback((o: Outcome) => {
		petRef.current = o.pet;
		outcomeRef.current = o;
		setOutcome(o);
	}, []);

	const refreshOptions = useCallback(() => {
		const sdk = sdkRef.current;
		const pet = petRef.current;
		if (!sdk || !pet) return;
		const res = sdk.run<{ options: BranchOption[] }>({ op: "evolution_options", pet });
		if (res.ok) setOptions(res.value.options);
	}, []);

	const pushLog = useCallback((text: string) => {
		setLog((prev) => [text, ...prev].slice(0, LOG_LIMIT));
	}, []);

	const fail = useCallback(
		(code: string, message: string) => {
			const text = ERROR_NAMES[code] ?? message;
			setNotice(text);
			pushLog(text);
		},
		[pushLog],
	);

	const hatch = useCallback(() => {
		const sdk = sdkRef.current;
		if (!sdk) return;
		const res: Wire<Born> = sdk.run<Born>({
			op: "birth",
			world: "demo",
			request_id: `birth-${Date.now()}`,
			server_seed: randomSeed(),
			client_seed: randomSeed(),
			born_at: "0",
		});
		if (!res.ok) {
			fail(res.code, res.message);
			return;
		}
		clock.current = { real: performance.now(), logical: 0, speed: clock.current.speed };
		seq.current = 0;
		override.current = null;
		setTick(0);
		setNotice("");
		setLog(["新的生命降生了"]);
		setBorn(res.value);
		applyOutcome({ pet: res.value.pet, phase: "healthy", mood: "content", replayed: false });
		const opts = sdk.run<{ options: BranchOption[] }>({
			op: "evolution_options",
			pet: res.value.pet,
		});
		setOptions(opts.ok ? opts.value.options : []);
	}, [applyOutcome, fail]);

	useEffect(() => {
		let alive = true;
		loadPetSdk()
			.then((sdk) => {
				if (!alive) return;
				sdkRef.current = sdk;
				setStatus("ready");
				hatch();
			})
			.catch((e: unknown) => {
				if (!alive) return;
				const missing = e instanceof Error && e.message === "missing";
				if (!missing) setError(e instanceof Error ? e.message : String(e));
				setStatus(missing ? "missing" : "error");
			});
		return () => {
			alive = false;
		};
	}, [hatch]);

	const send = useCallback(
		(action: SimpleAction | { evolve: { branch: Branch } }) => {
			const sdk = sdkRef.current;
			const pet = petRef.current;
			if (!sdk || !pet) return null;
			const now = Math.max(nowTick(), Number(pet.last_tick));
			seq.current += 1;
			const res = sdk.run<Outcome>({
				op: "act",
				action,
				now: String(now),
				request_id: `${typeof action === "string" ? action : "evolve"}-${seq.current}`,
				pet,
			});
			setTick(now);
			return res;
		},
		[nowTick],
	);

	useEffect(() => {
		if (!born) return;
		const id = setInterval(() => {
			const res = send("wait");
			if (res?.ok) applyOutcome(res.value);
		}, SETTLE_MS);
		return () => clearInterval(id);
	}, [born, send, applyOutcome]);

	useEffect(() => {
		const sdk = sdkRef.current;
		if (!born || !sdk) return;
		const id = setInterval(() => {
			frameT.current += 1;
			const held = override.current && override.current.until > performance.now();
			const pose = held
				? (override.current as { pose: Pose }).pose
				: idlePose(outcomeRef.current, frameT.current);
			const stage = STAGE_INDEX[petRef.current?.growth?.stage ?? "baby"] ?? 0;
			const res = sdk.run<Sprite>({
				op: "sprite",
				species: born.species,
				genes: born.genes,
				pose,
				stage,
				w: SPRITE_W,
				h: SPRITE_H,
				t: String(frameT.current),
			});
			if (res.ok) setSprite(res.value);
		}, FRAME_MS);
		return () => clearInterval(id);
	}, [born]);

	/** 图鉴预览:同一份规则核心,按指定物种、姿态与阶段合成像素帧。 */
	const renderSprite = useCallback(
		(species: number, pose: Pose, stage: number, t: number): Sprite | null => {
			const sdk = sdkRef.current;
			if (!sdk || !born) return null;
			const res = sdk.run<Sprite>({
				op: "sprite",
				species,
				genes: born.genes,
				pose,
				stage,
				w: 14,
				h: SPRITE_H,
				t: String(t),
			});
			return res.ok ? res.value : null;
		},
		[born],
	);

	const act = useCallback(
		(action: SimpleAction) => {
			const res = send(action);
			if (!res) return;
			if (res.ok) {
				applyOutcome(res.value);
				override.current = {
					pose: ACTION_POSE[action],
					until: performance.now() + POSE_HOLD_MS,
				};
				setNotice("");
				pushLog(ACTION_LOG[action]);
				refreshOptions();
			} else {
				fail(res.code, res.message);
			}
		},
		[send, applyOutcome, refreshOptions, pushLog, fail],
	);

	const evolve = useCallback(
		(branch: Branch) => {
			const res = send({ evolve: { branch } });
			if (!res) return;
			if (res.ok) {
				applyOutcome(res.value);
				override.current = { pose: "evolve", until: performance.now() + POSE_HOLD_MS };
				setNotice("");
				pushLog(`进化了，成为「${BRANCH_NAMES[branch].name}」`);
				refreshOptions();
			} else {
				fail(res.code, res.message);
			}
		},
		[send, applyOutcome, refreshOptions, pushLog, fail],
	);

	const setSpeed = useCallback(
		(next: number) => {
			const now = nowTick();
			clock.current = { real: performance.now(), logical: now, speed: next };
			setSpeedState(next);
		},
		[nowTick],
	);

	return {
		status,
		error,
		born,
		outcome,
		sprite,
		log,
		renderSprite,
		options,
		notice,
		speed,
		tick,
		act,
		evolve,
		hatch,
		setSpeed,
	};
}
