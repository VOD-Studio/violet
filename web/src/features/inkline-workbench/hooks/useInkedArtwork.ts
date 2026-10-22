import { useEffect, useState } from "react";
import type { InkedArtwork } from "../lib/artwork";
import { type ArtworkKey, loadArtwork } from "../model/artworks";

/** 当前画稿的勾画结果；加载与生成期间为 null，切换画稿时旧结果不会覆盖新结果。 */
export function useInkedArtwork(key: ArtworkKey): InkedArtwork | null {
	const [result, setResult] = useState<{ key: ArtworkKey; artwork: InkedArtwork } | null>(null);
	useEffect(() => {
		let active = true;
		void loadArtwork(key).then((artwork) => {
			if (active) setResult({ key, artwork });
		});
		return () => {
			active = false;
		};
	}, [key]);
	return result?.key === key ? result.artwork : null;
}
