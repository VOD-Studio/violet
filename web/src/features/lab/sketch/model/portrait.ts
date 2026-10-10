import { parseVectorArtwork } from "@features/lab/sketch/lib/vector-artwork";
import source from "./portrait.json?raw";
import highlights from "./portrait-highlights.json?raw";
import shadows from "./portrait-shadows.json?raw";

/** 参考照片的人像画稿，不含截图工具栏与窗口边框。 */
export const { scene: portraitDrawing, palette: portraitPalette } = parseVectorArtwork(
	source,
	shadows,
	highlights,
);
