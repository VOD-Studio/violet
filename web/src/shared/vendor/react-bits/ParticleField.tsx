import { useEffect, useRef } from "react";

/**
 * ParticleField - 鼠标跟随流体粒子背景（Canvas 2D）
 *
 * spec：左侧视觉区极具极客感的鼠标跟随粒子。
 * - 60 粒子在容器内漂浮，鼠标靠近时被吸引产生流动
 * - Canvas 2D（轻量，避免 Aurora 的 WebGL 重量在左栏叠用）
 * - SSR 安全：仅在 useEffect（client）运行，首屏空 canvas 不影响 hydrate
 * - 颜色读 CSS 变量，自动跟随主题（dark 霓虹冷蓝 / light 墨灰）
 */
export interface ParticleFieldProps {
	/** 粒子数 */
	count?: number;
	className?: string;
}

export default function ParticleField({
	count = 60,
	className,
}: ParticleFieldProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		let raf = 0;
		let w = 0;
		let h = 0;
		const mouse = { x: -9999, y: -9999 };

		const particles = Array.from({ length: count }, () => ({
			x: Math.random(),
			y: Math.random(),
			vx: (Math.random() - 0.5) * 0.0008,
			vy: (Math.random() - 0.5) * 0.0008,
			r: Math.random() * 1.6 + 0.6,
		}));

		// 颜色缓存：仅在挂载与主题切换时读 getComputedStyle，避免每帧 reflow
		let color = "hsl(210 100% 66%)";
		const refreshColor = () => {
			const css = getComputedStyle(document.documentElement)
				.getPropertyValue("--neon-blue")
				.trim();
			// css 形如 "210 100% 66%"
			color = css ? `hsl(${css})` : "hsl(210 100% 66%)";
		};
		refreshColor();
		// 主题切换时（next-themes 切 <html>.dark）重读颜色
		const themeObs = new MutationObserver(refreshColor);
		themeObs.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			w = rect.width;
			h = rect.height;
			canvas.width = w * dpr;
			canvas.height = h * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const onMove = (e: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			mouse.x = e.clientX - rect.left;
			mouse.y = e.clientY - rect.top;
		};
		const onLeave = () => {
			mouse.x = -9999;
			mouse.y = -9999;
		};

		const tick = () => {
			ctx.clearRect(0, 0, w, h);
			for (const p of particles) {
				p.x += p.vx;
				p.y += p.vy;
				if (p.x < 0 || p.x > 1) p.vx *= -1;
				if (p.y < 0 || p.y > 1) p.vy *= -1;

				const px = p.x * w;
				const py = p.y * h;

				// 鼠标吸引（轻微）
				const dx = mouse.x - px;
				const dy = mouse.y - py;
				const dist2 = dx * dx + dy * dy;
				if (dist2 < 14400) {
					const f = 0.02 / Math.max(40, Math.sqrt(dist2));
					p.vx += dx * f * 0.01;
					p.vy += dy * f * 0.01;
				}
				// 阻尼
				p.vx *= 0.99;
				p.vy *= 0.99;

				ctx.beginPath();
				ctx.fillStyle = color;
				ctx.globalAlpha = 0.6;
				ctx.arc(px, py, p.r, 0, Math.PI * 2);
				ctx.fill();
			}
			// 连线（近距离）
			ctx.globalAlpha = 0.12;
			ctx.strokeStyle = color;
			ctx.lineWidth = 0.6;
			for (let i = 0; i < particles.length; i++) {
				for (let j = i + 1; j < particles.length; j++) {
					const a = particles[i];
					const b = particles[j];
					const ax = a.x * w;
					const ay = a.y * h;
					const bx = b.x * w;
					const by = b.y * h;
					const d = Math.hypot(ax - bx, ay - by);
					if (d < 110) {
						ctx.globalAlpha = (1 - d / 110) * 0.15;
						ctx.beginPath();
						ctx.moveTo(ax, ay);
						ctx.lineTo(bx, by);
						ctx.stroke();
					}
				}
			}
			ctx.globalAlpha = 1;
			raf = requestAnimationFrame(tick);
		};

		resize();
		window.addEventListener("resize", resize);
		window.addEventListener("mousemove", onMove);
		canvas.addEventListener("mouseleave", onLeave);
		raf = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("resize", resize);
			window.removeEventListener("mousemove", onMove);
			canvas.removeEventListener("mouseleave", onLeave);
			themeObs.disconnect();
		};
	}, [count]);

	return (
		<canvas
			ref={canvasRef}
			className={className}
			style={{ width: "100%", height: "100%", display: "block" }}
			aria-hidden
		/>
	);
}
