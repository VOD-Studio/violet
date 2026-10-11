import { parseVectorArtwork } from "@features/lab/sketch/lib/vector-artwork";
import type { BenchScene } from "@features/lab/sketch/model/scenes";
import source from "./coffee-morning.json?raw";

const artwork = parseVectorArtwork(source);
const paper: number[] = [];
const outlines: number[] = [];
const details: number[] = [];
const colors: number[] = [];

artwork.scene.items.forEach((item, index) => {
	if (item.id === "paper") paper.push(index);
	else if (item.strokeRole !== "none") outlines.push(index);
	else if (item.fill === "solid") details.push(index);
	else colors.push(index);
});

/** 色面仍叠在线稿下方，播放则先描线、后上色。 */
export const illustrationDrawing: BenchScene = {
	...artwork.scene,
	animationPhases: [paper, [...outlines, ...details], colors],
};

export const illustrationPalette = artwork.palette;
