import { type InkedArtwork, inkArtwork, type VectorArtwork } from "../lib/artwork";

export type ArtworkKey = "coffee" | "portrait";

export const ARTWORKS: readonly { key: ArtworkKey; label: string }[] = [
	{ key: "coffee", label: "咖啡少女" },
	{ key: "portrait", label: "人像" },
];

const parse = (module: { default: string }) => JSON.parse(module.default) as VectorArtwork;
const cache = new Map<ArtworkKey, Promise<InkedArtwork>>();

/**
 * 按需加载画稿数据并勾画，同一幅画只生成一次。
 *
 * @remarks 两幅画稿的 JSON 合计约 2 MB，按需拉取，不进页面首包。
 */
export function loadArtwork(key: ArtworkKey): Promise<InkedArtwork> {
	let artwork = cache.get(key);
	if (!artwork) {
		artwork =
			key === "coffee"
				? import("./artworks/coffee-morning.json?raw").then((m) => inkArtwork(parse(m)))
				: Promise.all([
						import("./artworks/portrait.json?raw"),
						import("./artworks/portrait-shadows.json?raw"),
						import("./artworks/portrait-highlights.json?raw"),
					]).then(([base, shadows, highlights]) =>
						// 人像沿用原有的整幅一段播放；阴影与高光作为附加色面叠在原色面上
						inkArtwork(
							parse(base),
							[
								JSON.parse(shadows.default) as VectorArtwork["colors"],
								JSON.parse(highlights.default) as VectorArtwork["colors"],
							],
							false,
						),
					);
		cache.set(key, artwork);
	}
	return artwork;
}
