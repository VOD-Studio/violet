import { useRef, useSyncExternalStore } from "react";

export interface SpringConfig {
	stiffness?: number;
	damping?: number;
	mass?: number;
	precision?: number;
}

const DEFAULT_SPRING: Required<SpringConfig> = {
	stiffness: 380,
	damping: 32,
	mass: 0.8,
	precision: 0.15,
};

export class ScalarSpringStore {
	private current: number;
	private target: number;
	private velocity = 0;
	private config: Required<SpringConfig>;
	private listeners = new Set<() => void>();
	private rafId: number | null = null;
	private lastTime = 0;

	constructor(initial: number, config: SpringConfig = {}) {
		this.current = initial;
		this.target = initial;
		this.config = { ...DEFAULT_SPRING, ...config };
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
			if (this.listeners.size === 0 && this.rafId !== null) {
				cancelAnimationFrame(this.rafId);
				this.rafId = null;
			}
		};
	};

	getSnapshot = () => this.current;

	getServerSnapshot = () => this.target;

	setTarget(newTarget: number) {
		if (this.target === newTarget && this.rafId === null) return;
		this.target = newTarget;
		if (this.rafId === null) {
			this.lastTime = performance.now();
			this.rafId = requestAnimationFrame(this.tick);
		}
	}

	private tick = (now: number) => {
		const dtSeconds = Math.min((now - this.lastTime) / 1000, 0.064);
		this.lastTime = now;

		const displacement = this.current - this.target;
		const springForce = -this.config.stiffness * displacement;
		const dampingForce = -this.config.damping * this.velocity;
		const acceleration = (springForce + dampingForce) / this.config.mass;

		this.velocity += acceleration * dtSeconds;
		this.current += this.velocity * dtSeconds;

		const isAtRest =
			Math.abs(this.current - this.target) < this.config.precision &&
			Math.abs(this.velocity) < this.config.precision;

		if (isAtRest) {
			this.current = this.target;
			this.velocity = 0;
			this.rafId = null;
		} else {
			this.rafId = requestAnimationFrame(this.tick);
		}

		for (const listener of this.listeners) {
			listener();
		}
	};
}

/**
 * 多维联合物理弹簧 Store（驱动坐标、宽高与小尾巴形变）
 */
export class MultiSpringStore<T extends Record<string, number>> {
	private current: T;
	private target: T;
	private velocities: Map<string, number> = new Map();
	private config: Required<SpringConfig>;
	private listeners = new Set<() => void>();
	private rafId: number | null = null;
	private lastTime = 0;
	private snapshotCache: T;

	constructor(initial: T, config: SpringConfig = {}) {
		this.current = { ...initial };
		this.target = { ...initial };
		this.snapshotCache = { ...initial };
		this.config = { ...DEFAULT_SPRING, ...config };
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
			if (this.listeners.size === 0 && this.rafId !== null) {
				cancelAnimationFrame(this.rafId);
				this.rafId = null;
			}
		};
	};

	getSnapshot = () => this.snapshotCache;

	getServerSnapshot = () => this.target;

	setTarget(newTargets: T) {
		let changed = false;
		for (const [key, val] of Object.entries(newTargets)) {
			if ((this.target as Record<string, number>)[key] !== val) {
				changed = true;
				break;
			}
		}
		if (!changed && this.rafId === null) return;

		this.target = { ...newTargets };
		if (this.rafId === null) {
			this.lastTime = performance.now();
			this.rafId = requestAnimationFrame(this.tick);
		}
	}

	private tick = (now: number) => {
		const dtSeconds = Math.min((now - this.lastTime) / 1000, 0.064);
		this.lastTime = now;

		let hasMoving = false;
		const next = { ...this.current } as Record<string, number>;

		for (const [key, targetVal] of Object.entries(this.target as Record<string, number>)) {
			const curVal = next[key] ?? targetVal;
			const v = this.velocities.get(key) ?? 0;

			const displacement = curVal - targetVal;
			const springForce = -this.config.stiffness * displacement;
			const dampingForce = -this.config.damping * v;
			const acceleration = (springForce + dampingForce) / this.config.mass;

			const nextV = v + acceleration * dtSeconds;
			const nextCur = curVal + nextV * dtSeconds;

			const isAtRest =
				Math.abs(nextCur - targetVal) < this.config.precision &&
				Math.abs(nextV) < this.config.precision;

			if (isAtRest) {
				next[key] = targetVal;
				this.velocities.set(key, 0);
			} else {
				next[key] = nextCur;
				this.velocities.set(key, nextV);
				hasMoving = true;
			}
		}

		this.current = next as T;
		this.snapshotCache = { ...next } as T;

		if (!hasMoving) {
			this.rafId = null;
		} else {
			this.rafId = requestAnimationFrame(this.tick);
		}

		for (const listener of this.listeners) {
			listener();
		}
	};
}

export function useSpringValue(target: number, config?: SpringConfig): number {
	const storeRef = useRef<ScalarSpringStore | null>(null);
	if (!storeRef.current) {
		storeRef.current = new ScalarSpringStore(target, config);
	}
	const store = storeRef.current;
	store.setTarget(target);

	return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

export function useMultiSpring<T extends Record<string, number>>(
	targets: T | null,
	config?: SpringConfig,
): T | null {
	const storeRef = useRef<MultiSpringStore<T> | null>(null);

	if (targets && !storeRef.current) {
		storeRef.current = new MultiSpringStore(targets, config);
	}

	const store = storeRef.current;
	if (store && targets) {
		store.setTarget(targets);
	}

	const snapshot = useSyncExternalStore<T | null>(
		store ? store.subscribe : () => () => {},
		store ? store.getSnapshot : () => null,
		store ? store.getServerSnapshot : () => null,
	);

	return targets ? snapshot : null;
}
