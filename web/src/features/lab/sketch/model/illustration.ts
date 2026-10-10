import { parseVectorArtwork } from "@features/lab/sketch/lib/vector-artwork";
import source from "./good-morning.json?raw";

/** 人物举牌的矢量画稿及其颜色角色。 */
export const { scene: goodMorningScene, palette: illustrationPalette } = parseVectorArtwork(source);
