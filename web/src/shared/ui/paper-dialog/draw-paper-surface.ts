interface Edge {
	length: number;
	x: number;
	y: number;
	tx: number;
	ty: number;
}

interface Profile {
	depths: Float32Array;
	bands: Float32Array;
}

function randomSequence(seed: number) {
	return () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 4294967296;
	};
}

function noiseField(length: number, wavelength: number, random: () => number) {
	const values = Array.from({ length: Math.ceil(length / wavelength) + 2 }, random);
	return (position: number) => {
		const scaled = position / wavelength;
		const index = Math.floor(scaled);
		const fraction = scaled - index;
		const blend = fraction * fraction * (3 - 2 * fraction);
		return values[index] * (1 - blend) + values[index + 1] * blend;
	};
}

/** 静态绘制错位底层纸与主纸面；尺寸与线宽均为 CSS 像素。 */
export function drawPaperSurface(
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	color: string,
) {
	context.clearRect(0, 0, width, height);
	// 含画布四周 32px 外扩，主纸保持原视觉位置；外扩供底层纸旋转错位不裁剪。
	const inset = Math.min(38, width / 4, height / 4);

	const paintSheet = (edgeInset: number, seed: number, darken: number, dimBands: number) => {
		const edges: Edge[] = [
			{ length: width - 2 * edgeInset, x: edgeInset, y: edgeInset, tx: 1, ty: 0 },
			{ length: height - 2 * edgeInset, x: width - edgeInset, y: edgeInset, tx: 0, ty: 1 },
			{
				length: width - 2 * edgeInset,
				x: width - edgeInset,
				y: height - edgeInset,
				tx: -1,
				ty: 0,
			},
			{ length: height - 2 * edgeInset, x: edgeInset, y: height - edgeInset, tx: 0, ty: -1 },
		];
		const step = 0.6;
		const profiles: Profile[] = edges.map((edge, index) => {
			const random = randomSequence(7183 + seed + index * 193);
			const coarse = noiseField(edge.length, 46, random);
			const mid = noiseField(edge.length, 11, random);
			const fine = noiseField(edge.length, 3.2, random);
			const density = noiseField(edge.length, 17, random);
			const pockets: { center: number; left: number; right: number; depth: number }[] = [];
			for (let position = 30; position < edge.length - 24; position += 42 + random() * 88) {
				pockets.push({
					center: position,
					left: 6 + random() * 14,
					right: 4 + random() * 9,
					depth: 0.6 + random() * 1.4,
				});
			}
			const cornerFade = (position: number) =>
				Math.min(1, position / 14, (edge.length - position) / 14);
			const boundary = (position: number) => {
				let depth =
					(coarse(position) - 0.5) * 2.6 +
					(mid(position) - 0.5) * 1.1 +
					(fine(position) - 0.5) * 0.4;
				for (const pocket of pockets) {
					const distance =
						Math.abs(position - pocket.center) /
						(position < pocket.center ? pocket.left : pocket.right);
					if (distance < 1) depth += pocket.depth * (1 - distance * distance) ** 2;
				}
				return depth * cornerFade(position);
			};
			const steps = Math.ceil(edge.length / step);
			const depths = new Float32Array(steps + 1);
			const bands = new Float32Array(steps + 1);
			for (let i = 0; i <= steps; i++) {
				const position = i * step;
				depths[i] = boundary(position);
				// 撕芯宽度随纤维疏密起伏，代替逐段透明度拼接。
				bands[i] = (0.9 + density(position) * 2.1) * cornerFade(position);
			}
			return { depths, bands };
		});
		const pointAt = (edge: Edge, t: number, depth: number) => ({
			x: edge.x + edge.tx * t - edge.ty * depth,
			y: edge.y + edge.ty * t + edge.tx * depth,
		});
		const outlinePath = (inward: number) => {
			const path = new Path2D();
			edges.forEach((edge, index) => {
				const profile = profiles[index];
				for (let i = 0; i < profile.depths.length; i++) {
					const { x, y } = pointAt(edge, i * step, profile.depths[i] + inward);
					if (index === 0 && i === 0) path.moveTo(x, y);
					else path.lineTo(x, y);
				}
			});
			path.closePath();
			return path;
		};
		const bandPath = (index: number, outerScale: number, innerOffset: number) => {
			const edge = edges[index];
			const profile = profiles[index];
			const path = new Path2D();
			for (let i = 0; i < profile.depths.length; i++) {
				const { x, y } = pointAt(
					edge,
					i * step,
					profile.depths[i] - profile.bands[i] * outerScale,
				);
				if (i === 0) path.moveTo(x, y);
				else path.lineTo(x, y);
			}
			for (let i = profile.depths.length - 1; i >= 0; i--) {
				const { x, y } = pointAt(edge, i * step, profile.depths[i] + innerOffset);
				path.lineTo(x, y);
			}
			path.closePath();
			return path;
		};

		context.fillStyle = color;
		context.globalAlpha = 0.38 * dimBands;
		for (let index = 0; index < edges.length; index++) {
			context.fill(bandPath(index, 1, 0.55));
		}
		context.globalAlpha = 0.55 * dimBands;
		for (let index = 0; index < edges.length; index++) {
			context.fill(bandPath(index, 0.45, 0.3));
		}
		context.globalAlpha = 1;
		context.fill(outlinePath(0.3));
		if (darken > 0) {
			// 底层纸整体压暗，呈现被主纸遮住的阴影。
			context.fillStyle = `rgba(0,0,0,${darken})`;
			context.fill(outlinePath(0.3));
			context.fillStyle = color;
		}
		// 内侧一线极淡阴影交代纸厚。
		context.strokeStyle = "rgba(0,0,0,0.04)";
		context.lineWidth = 0.7;
		context.stroke(outlinePath(0.55));

		edges.forEach((edge, index) => {
			const profile = profiles[index];
			const fiberRandom = randomSequence(2197 + seed + index * 317);
			for (let cluster = 12; cluster < edge.length - 12; cluster += 8 + fiberRandom() * 20) {
				const bias = (fiberRandom() - 0.5) * 2;
				const count = 2 + Math.floor(fiberRandom() * 4);
				for (let fiber = 0; fiber < count; fiber++) {
					const position = Math.min(
						edge.length - 8,
						Math.max(8, cluster + (fiberRandom() - 0.5) * 9),
					);
					const reach = 0.5 + fiberRandom() ** 1.5 * 2.8 + (fiberRandom() < 0.06 ? 2 : 0);
					const sample = Math.min(profile.depths.length - 1, Math.round(position / step));
					const rootDepth = profile.depths[sample] + 0.2;
					const lean = bias * (0.8 + fiberRandom() * 2.4) + (fiberRandom() - 0.5) * 1.4;
					const radius = 0.05 + fiberRandom() ** 2 * 0.09;
					const root = pointAt(edge, position, rootDepth);
					const tip = pointAt(edge, position + lean, rootDepth - reach);
					context.globalAlpha = 0.35 + fiberRandom() * 0.4;
					context.beginPath();
					// 细丝根部沿边缘法向展开，两条三次曲线夹出末端渐细的月牙。
					context.moveTo(root.x - radius * edge.ty, root.y + radius * edge.tx);
					context.bezierCurveTo(
						root.x - radius * edge.ty + (tip.x - root.x) * 0.3,
						root.y + radius * edge.tx + (tip.y - root.y) * 0.3,
						tip.x - lean * 0.35,
						tip.y + reach * 0.22,
						tip.x,
						tip.y,
					);
					context.bezierCurveTo(
						tip.x + lean * 0.35,
						tip.y + reach * 0.22,
						root.x + radius * edge.ty + (tip.x - root.x) * 0.3,
						root.y - radius * edge.tx + (tip.y - root.y) * 0.3,
						root.x + radius * edge.ty,
						root.y - radius * edge.tx,
					);
					context.closePath();
					context.fill();
				}
			}
		});
		context.globalAlpha = 1;
	};

	// 底层纸：向右下明显错位并带一点角度，从主纸边缘露出。
	context.save();
	context.translate(width / 2 + 4, height / 2 + 6);
	context.rotate(0.005);
	context.translate(-width / 2, -height / 2);
	paintSheet(inset, 4549, 0.1, 0.5);
	context.restore();
	paintSheet(inset, 0, 0, 1);
}
