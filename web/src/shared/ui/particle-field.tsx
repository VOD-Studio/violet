import { useEffect, useRef } from "react";

interface ParticleFieldProps {
	/** 生成密度倍率（0-1），默认 0.5 */
	density?: number;
	/** 高度占视口百分比，默认 100 */
	heightVh?: number;
}

interface Meteor {
	x: number;
	y: number;
	dx: number;
	dy: number;
	speed: number;
	trail: number;
	jitter: { x: number; y: number }[];
	spacing: number;
	size: number;
	accent: boolean;
	fadeAt: number;
	alpha: number;
}

/**
 * ParticleField — Canvas 粒子流背景
 *
 * 点阵流星从顶部飘落，neon 蓝/紫色系，营造持续流动的背景氛围。
 * 固定定位 z-index -1，不拦截指针事件，隐藏标签页时暂停。
 * prefers-reduced-motion 用户跳过动画。
 */
export function ParticleField({ density = 0.5, heightVh = 100 }: ParticleFieldProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const container = containerRef.current;
		if (!canvas || !container) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		const maxMeteors = Math.max(4, Math.round(10 * density));
		let width = 0;
		let height = 0;
		let isDark = document.documentElement.classList.contains("dark");
		const meteors: Meteor[] = [];

		// 主题变化时更新缓存，避免每帧 DOM 读取
		const themeObserver = new MutationObserver(() => {
			isDark = document.documentElement.classList.contains("dark");
		});
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		const resize = () => {
			const dpr = 1; // 粒子是模糊点阵，1x DPR 视觉无损但合成成本降 4x
			const rect = container.getBoundingClientRect();
			width = rect.width;
			height = rect.height;
			canvas.width = Math.max(1, Math.round(width * dpr));
			canvas.height = Math.max(1, Math.round(height * dpr));
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const spawn = () => {
			const angle = Math.PI / 2 + (Math.random() * 0.5 - 0.1);
			const trail = 5 + Math.floor(Math.random() * 4);
			const jitter: { x: number; y: number }[] = [];
			for (let i = 0; i < trail; i++) {
				jitter.push({ x: (Math.random() - 0.5) * 3.2, y: (Math.random() - 0.5) * 3.2 });
			}
			meteors.push({
				x: width * (0.04 + Math.random() * 0.92),
				y: -24,
				dx: Math.cos(angle),
				dy: Math.sin(angle),
				speed: 150 + Math.random() * 210,
				trail,
				jitter,
				spacing: 9 + Math.random() * 5,
				size: 1.7 + Math.random() * 1.2,
				accent: Math.random() < 0.15,
				fadeAt: height * (0.45 + Math.random() * 0.45),
				alpha: 1,
			});
		};

		let lastTime = 0;
		let spawnTimer = 0;
		let nextSpawn = 400;
		let rafId = 0;
		let running = false;

		const step = (now: number) => {
			const dt = Math.min((now - lastTime) / 1000, 0.05);
			lastTime = now;

			spawnTimer += dt * 1000;
			if (spawnTimer >= nextSpawn) {
				spawnTimer = 0;
				nextSpawn = (380 + Math.random() * 1100) / density;
				if (meteors.length < maxMeteors) spawn();
			}

			const blueRgb = isDark ? "96, 165, 250" : "59, 130, 246";
			const purpleRgb = isDark ? "192, 132, 252" : "168, 85, 247";

			ctx.clearRect(0, 0, width, height);

			for (let m = meteors.length - 1; m >= 0; m--) {
				const meteor = meteors[m];
				meteor.x += meteor.dx * meteor.speed * dt;
				meteor.y += meteor.dy * meteor.speed * dt;
				if (meteor.y > meteor.fadeAt) meteor.alpha -= dt * 2.4;
				if (meteor.alpha <= 0 || meteor.y - meteor.trail * meteor.spacing > height + 30) {
					meteors.splice(m, 1);
					continue;
				}

				const rgb = meteor.accent ? purpleRgb : blueRgb;
				for (let i = 0; i < meteor.trail; i++) {
					const px = meteor.x - meteor.dx * meteor.spacing * i + meteor.jitter[i].x;
					const py = meteor.y - meteor.dy * meteor.spacing * i + meteor.jitter[i].y;
					const falloff = 0.74 ** i;
					const alpha = meteor.alpha * 0.62 * falloff;
					const radius = meteor.size * (i === 0 ? 1.18 : 0.88 ** i);
					if (alpha < 0.015 || py < -10) continue;
					ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
					ctx.beginPath();
					ctx.arc(px, py, radius, 0, Math.PI * 2);
					ctx.fill();
					if (i === 0) {
						ctx.fillStyle = `rgba(${rgb}, ${alpha * 0.22})`;
						ctx.beginPath();
						ctx.arc(px, py, radius * 2.6, 0, Math.PI * 2);
						ctx.fill();
					}
				}
			}

			rafId = requestAnimationFrame(step);
		};

		const start = () => {
			if (running) return;
			running = true;
			lastTime = performance.now();
			rafId = requestAnimationFrame(step);
		};

		const stop = () => {
			running = false;
			if (rafId) cancelAnimationFrame(rafId);
			rafId = 0;
		};

		let resizeRaf = 0;
		const onVisibility = () => {
			if (document.hidden) stop();
			else start();
		};
		const onResize = () => {
			if (resizeRaf) return;
			resizeRaf = requestAnimationFrame(() => {
				resizeRaf = 0;
				resize();
			});
		};

		resize();
		start();
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("resize", onResize);

		return () => {
			stop();
			if (resizeRaf) cancelAnimationFrame(resizeRaf);
			themeObserver.disconnect();
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("resize", onResize);
		};
	}, [density]);

	return (
		<div
			ref={containerRef}
			aria-hidden="true"
			className="pointer-events-none fixed inset-0 -z-10"
			style={{
				height: `${heightVh}vh`,
				maskImage: "linear-gradient(180deg, #000 70%, transparent)",
				WebkitMaskImage: "linear-gradient(180deg, #000 70%, transparent)",
			}}
		>
			<canvas ref={canvasRef} className="size-full" />
		</div>
	);
}
