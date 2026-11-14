/** Fictional gradient scenes for the gallery: no photos, avatars, or third-party assets. */
const palettes = {
	dusk: ["#2b1b3d", "#d9485f", "#ffb86b"],
	lagoon: ["#0b3954", "#087e8b", "#bfd7ea"],
	meadow: ["#1f3b2d", "#6a994e", "#f2e8cf"],
	ink: ["#1b1b2f", "#6c5b7b", "#f8b195"],
} as const;

export type Scene = keyof typeof palettes;

/** Full scene size in pixels; strips are slices of this canvas. */
export const SCENE = { width: 1440, height: 800 } as const;

/** Root-relative address served by the example renderer, e.g. `/gallery/dusk-0-1440.svg`. */
export function sceneUrl(scene: Scene, from = 0, width: number = SCENE.width): string {
	return `/gallery/${scene}-${from}-${width}.svg`;
}

/** Builds the SVG for an address returned by `sceneUrl`, or `undefined` for anything else. */
export function sceneSvg(pathname: string): string | undefined {
	const match = /^\/gallery\/(\w+)-(\d+)-(\d+)\.svg$/.exec(pathname);
	const colors = match && palettes[match[1] as Scene];
	if (!match || !colors) return undefined;
	const [sky, hill, sun] = colors;
	const [from, width] = [Number(match[2]), Number(match[3])];
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${SCENE.height}" viewBox="${from} 0 ${width} ${SCENE.height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="${sun}"/></linearGradient></defs><rect width="${SCENE.width}" height="${SCENE.height}" fill="url(#g)"/><circle cx="980" cy="430" r="150" fill="${sun}" opacity=".85"/><path d="M0 560 C260 430 520 640 800 520 S1250 470 1440 540 V800 H0Z" fill="${hill}" opacity=".78"/><path d="M0 660 C300 580 560 740 900 640 S1300 610 1440 670 V800 H0Z" fill="${sky}" opacity=".9"/></svg>`;
}
