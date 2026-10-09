import { inkpen, marker } from "./brushes.ts";
import { fineliner } from "./fineliner.ts";

/** 内置笔预设；只用其中一支时直接导入对应的具名导出，未用到的笔不会进入打包结果。 */
export const pens = { fineliner, inkpen, marker } as const;
