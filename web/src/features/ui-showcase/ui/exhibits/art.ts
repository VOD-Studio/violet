/** 离线封面：渐变天空与远山，颜色由色相生成，避免展品依赖网络。 */
export function cover(hue: number) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="oklch(0.88 0.06 ${hue})"/><stop offset="1" stop-color="oklch(0.96 0.02 ${hue})"/></linearGradient></defs><rect width="320" height="200" fill="url(#g)"/><circle cx="230" cy="62" r="24" fill="oklch(0.98 0.01 ${hue})"/><path d="M0 200V140q60-48 120-12t110-20 90 20v72z" fill="oklch(0.72 0.08 ${hue})" opacity=".7"/><path d="M0 200v-36q80-34 160-4t160-12v52z" fill="oklch(0.55 0.09 ${hue})"/></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** 内联 SVG 肖像：纯色底加简化人形，不依赖网络，也不使用真人照片。 */
export function portrait(hue: number, shape: "person" | "bot" = "person") {
	const body =
		shape === "bot"
			? `<rect x="22" y="26" width="52" height="44" rx="12" fill="oklch(0.97 0.02 ${hue})"/><circle cx="38" cy="46" r="5" fill="oklch(0.45 0.1 ${hue})"/><circle cx="58" cy="46" r="5" fill="oklch(0.45 0.1 ${hue})"/><rect x="40" y="58" width="16" height="4" rx="2" fill="oklch(0.45 0.1 ${hue})"/>`
			: `<circle cx="48" cy="38" r="17" fill="oklch(0.97 0.02 ${hue})"/><path d="M14 96c2-20 16-30 34-30s32 10 34 30z" fill="oklch(0.97 0.02 ${hue})"/>`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="oklch(0.62 0.1 ${hue})"/>${body}</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
