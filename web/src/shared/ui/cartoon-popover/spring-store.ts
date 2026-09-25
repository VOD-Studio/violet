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
	snapTo(value: number) {
		if (this.current === value && this.target === value && this.rafId === null) return;
		this.current = value;
		this.target = value;
		this.velocity = 0;
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		for (const listener of this.listeners) {
			listener();
		}
	}

	private tick = (now: number) => {
		let remaining = Math.min((now - this.lastTime) / 1000, 0.064);
		this.lastTime = now;
		while (remaining > 0) {
			const dt = Math.min(remaining, 0.016);
			remaining -= dt;
			const displacement = this.current - this.target;
			const acceleration =
				(-this.config.stiffness * displacement - this.config.damping * this.velocity) /
				this.config.mass;
			this.velocity += acceleration * dt;
			this.current += this.velocity * dt;
		}
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
 * 多维联合物理弹簧 Store（驱动坐标、宽高与小尾巴形变）。
 */
export class MultiSpringStore<T extends Record<string, number>> {
	private current: T | null;
	private target: T;
	private velocities: Map<string, number> = new Map();
	private config: Required<SpringConfig>;
	private listeners = new Set<() => void>();
	private rafId: number | null = null;
	private lastTime = 0;
	private snapshotCache: T | null;

	constructor(config: SpringConfig = {}) {
		this.current = null;
		this.target = {} as T;
		this.snapshotCache = null;
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

	getServerSnapshot = () => null;

	/** teleport: 跳过物理解算，直接置于目标并清零速度（用于首次出现与重新出现） */
	teleport(next: T) {
		if (this.rafId === null && this.current) {
			let same = true;
			for (const key in next) {
				if (this.current[key] !== next[key] || this.target[key] !== next[key]) {
					same = false;
					break;
				}
			}
			if (same) return;
		}
		this.target = { ...next };
		this.current = { ...next };
		this.snapshotCache = this.current;
		this.velocities.clear();
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		for (const listener of this.listeners) {
			listener();
		}
	}

	setTarget(newTargets: T) {
		// 首次出现：直接落位，不做从旧位置的滑入
		if (!this.current) {
			this.teleport(newTargets);
			return;
		}

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
		let remaining = Math.min((now - this.lastTime) / 1000, 0.064);
		this.lastTime = now;

		if (!this.current) {
			this.rafId = null;
			return;
		}

		const next = { ...this.current } as Record<string, number>;
		while (remaining > 0) {
			const dt = Math.min(remaining, 0.016);
			remaining -= dt;
			for (const key in this.target) {
				const targetVal = this.target[key];
				const curVal = next[key] ?? targetVal;
				const velocity = this.velocities.get(key) ?? 0;
				const acceleration =
					(-this.config.stiffness * (curVal - targetVal) -
						this.config.damping * velocity) /
					this.config.mass;
				const nextVelocity = velocity + acceleration * dt;
				next[key] = curVal + nextVelocity * dt;
				this.velocities.set(key, nextVelocity);
			}
		}

		let hasMoving = false;
		for (const key in this.target) {
			const targetVal = this.target[key];
			const velocity = this.velocities.get(key) ?? 0;
			if (
				Math.abs(next[key] - targetVal) < this.config.precision &&
				Math.abs(velocity) < this.config.precision
			) {
				next[key] = targetVal;
				this.velocities.set(key, 0);
			} else {
				hasMoving = true;
			}
		}
		this.current = next as T;
		this.snapshotCache = this.current;

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

export function useSpringValue(
	target: number,
	config?: SpringConfig,
	options?: { instant?: boolean },
): number {
	const storeRef = useRef<ScalarSpringStore | null>(null);
	if (!storeRef.current) {
		storeRef.current = new ScalarSpringStore(target, config);
	}
	const store = storeRef.current;
	if (options?.instant) {
		store.snapTo(target);
	} else {
		store.setTarget(target);
	}

	return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

export function useMultiSpring<T extends Record<string, number>>(
	targets: T | null,
	config?: SpringConfig,
	options?: { teleport?: boolean },
): T | null {
	const storeRef = useRef<MultiSpringStore<T> | null>(null);
	const configRef = useRef(config);
	configRef.current = config;

	if (targets && !storeRef.current) {
		storeRef.current = new MultiSpringStore<T>(configRef.current);
	}

	const store = storeRef.current;
	if (store && targets) {
		if (options?.teleport) {
			store.teleport(targets);
		} else {
			store.setTarget(targets);
		}
	}

	const snapshot = useSyncExternalStore<T | null>(
		store ? store.subscribe : () => () => {},
		store ? store.getSnapshot : () => null,
		store ? store.getServerSnapshot : () => null,
	);

	return snapshot;
}
