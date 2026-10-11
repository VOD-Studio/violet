import { parseVectorArtwork } from "@features/lab/sketch/lib/vector-artwork";
import source from "./coffee-morning.json?raw";
import colors1 from "./coffee-morning-colors-1.json?raw";
import colors2 from "./coffee-morning-colors-2.json?raw";
import colors3 from "./coffee-morning-colors-3.json?raw";
import colors4 from "./coffee-morning-colors-4.json?raw";
import colors5 from "./coffee-morning-colors-5.json?raw";
import colors6 from "./coffee-morning-colors-6.json?raw";

/** 咖啡少女的矢量画稿及其颜色角色。 */
export const { scene: illustrationDrawing, palette: illustrationPalette } = parseVectorArtwork(
	source,
	colors1,
	colors2,
	colors3,
	colors4,
	colors5,
	colors6,
);
