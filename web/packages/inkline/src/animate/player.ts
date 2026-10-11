/** 播放器选项；时钟可注入，便于测试与非浏览器环境。 */
export interface PlayerOptions {
	/** 总时长，秒。 */
	duration: number;
	/** 每次时间变化后调用，参数为当前时间，秒。 */
	onFrame(time: number): void;
	/** 自然播放到末尾时调用一次；取消、重新开始或跳转后不会调用旧的完成回调。 */
	onEnd?(): void;
	/** 播放倍率。 @default 1 */
	rate?: number;
	/** 请求下一帧；缺省为 requestAnimationFrame。 */
	raf?: (callback: (now: number) => void) => number;
	cancelRaf?: (handle: number) => void;
	/** 当前毫秒时间；缺省为 performance.now。 */
	now?: () => number;
}

/** 播放控制；不拥有笔画，只维护时间。 */
export interface Player {
	readonly time: number;
	readonly playing: boolean;
	rate: number;
	/** 从当前时间继续；已在末尾时从头开始。 */
	play(): void;
	/** 暂停；时间保持不变，恢复后从原位继续。 */
	pause(): void;
	/** 跳到指定时间（钳制到 [0, duration]），不改变播放状态。 */
	seek(time: number): void;
	/** 回到 0 并开始播放。 */
	restart(): void;
	/** 停止播放并使尚未触发的完成回调失效；时间保持不变。 */
	cancel(): void;
}

/**
 * 创建时间轴播放器：统一时钟，支持播放、暂停、恢复、跳转、变速与取消。
 *
 * @example
 * ```ts
 * const player = createPlayer({ duration: schedule.duration, onFrame: (t) => seekSvg(svg, t) });
 * player.play();
 * ```
 */
export function createPlayer(options: PlayerOptions): Player {
	const raf = options.raf ?? ((cb) => requestAnimationFrame(cb));
	const cancelRaf = options.cancelRaf ?? ((h) => cancelAnimationFrame(h));
	const now = options.now ?? (() => performance.now());
	const { duration } = options;
	let time = 0;
	let playing = false;
	let handle = 0;
	let last = 0;
	// 每次取消、重启或跳转都会递增，使旧的帧回调与完成回调失效。
	let generation = 0;

	const frame = (token: number) => {
		if (token !== generation || !playing) return;
		const current = now();
		time = Math.min(duration, time + ((current - last) / 1000) * player.rate);
		last = current;
		options.onFrame(time);
		if (time >= duration) {
			playing = false;
			options.onEnd?.();
			return;
		}
		handle = raf(() => frame(token));
	};

	const stop = () => {
		generation++;
		playing = false;
		cancelRaf(handle);
	};

	const player: Player = {
		get time() {
			return time;
		},
		get playing() {
			return playing;
		},
		rate: options.rate ?? 1,
		play() {
			if (playing) return;
			if (time >= duration) time = 0;
			playing = true;
			last = now();
			const token = ++generation;
			options.onFrame(time);
			handle = raf(() => frame(token));
		},
		pause: stop,
		cancel: stop,
		seek(next) {
			const resume = playing;
			if (resume) stop();
			time = Math.max(0, Math.min(duration, next));
			options.onFrame(time);
			if (resume) player.play();
		},
		restart() {
			stop();
			time = 0;
			player.play();
		},
	};
	return player;
}
