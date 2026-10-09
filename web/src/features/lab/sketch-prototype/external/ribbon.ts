import type { Command, Pen } from "@violet/sketch";
import { geometryFromCommands } from "@violet/sketch";

/** 外部实现仅依赖公开几何与 Pen 契约，不注册到生成器或渲染器。 */
export const externalRibbonPen: Pen = {
	id: "external:ribbon",
	generate(geometry, context) {
		const commands: Command[] = [];
		const phase = context.random("ribbon-phase", 0) * Math.PI * 2;
		const amplitude = context.width * 1.6;
		for (const contour of context.sample(geometry, 4)) {
			const left: number[][] = [],
				right: number[][] = [];
			for (const point of contour.points) {
				const taper = contour.closed ? 1 : Math.sin(Math.PI * point.u);
				const shift = Math.sin(point.s / 14 + phase) * amplitude * taper;
				const half = context.width * (0.3 + 0.45 * (1 + Math.cos(point.s / 23))) * taper;
				left.push([
					point.x - point.ty * (shift + half),
					point.y + point.tx * (shift + half),
				]);
				right.push([
					point.x - point.ty * (shift - half),
					point.y + point.tx * (shift - half),
				]);
			}
			if (!left.length) continue;
			context.budget.addCommands(left.length + right.length + 1);
			commands.push({ op: "M", values: left[0] });
			for (let i = 1; i < left.length; i++) commands.push({ op: "L", values: left[i] });
			for (let i = right.length - 1; i >= 0; i--)
				commands.push({ op: "L", values: right[i] });
			commands.push({ op: "Z", values: [] });
		}
		return [
			{
				geometry: geometryFromCommands(commands),
				mode: "fill",
				role: context.strokeRole,
				reveal: geometry,
				revealWidth: context.width * 7 + 4,
			},
		];
	},
};
