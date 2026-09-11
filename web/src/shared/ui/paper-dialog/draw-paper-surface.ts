interface Edge {
	length: number;
	x: number;
	y: number;
	tx: number;
	ty: number;
}

const edgeOpacity = [0.12, 0.25, 0.42, 0.61, 0.78, 0.9, 0.97, 1] as const;
const cornerTrim = [1.2, 0.8, 1.6, 1] as const;

function randomSequence(seed: number) {
	return () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 4294967296;
	};
}

function smoothField(length: number, spacing: number, random: () => number) {
	const values = Array.from({ length: Math.ceil(length / spacing) + 2 }, random);
	return (position: number) => {
		const index = Math.floor(position / spacing);
		const fraction = position / spacing - index;
		const blend = fraction * fraction * (3 - 2 * fraction);
		return values[index] * (1 - blend) + values[index + 1] * blend;
	};
}

/** 静态绘制纸面及断口纤维；尺寸和线宽均为 CSS 像素。 */
export function drawPaperSurface(
	context: CanvasRenderingContext2D,
	width: number,
	height: number,
	color: string,
) {
	const inset = Math.min(6, width / 4, height / 4);
	const edges: Edge[] = [
		{ length: width - 2 * inset, x: inset, y: inset, tx: 1, ty: 0 },
		{ length: height - 2 * inset, x: width - inset, y: inset, tx: 0, ty: 1 },
		{ length: width - 2 * inset, x: width - inset, y: height - inset, tx: -1, ty: 0 },
		{ length: height - 2 * inset, x: inset, y: height - inset, tx: 0, ty: -1 },
	];
	const profiles = edges.map((edge, index) => {
		const random = randomSequence(7183 + index * 193);
		const contour = smoothField(edge.length, 51, random);
		const fine = smoothField(edge.length, 1.7, random);
		const density = smoothField(edge.length, 23, random);
		const pockets: { center: number; left: number; right: number; depth: number }[] = [];
		for (let position = 25; position < edge.length - 20; position += 38 + random() * 70) {
			pockets.push({
				center: position,
				left: 5 + random() * 15,
				right: 3 + random() * 9,
				depth: 0.3 + random() * 1.2,
			});
		}
		const boundary = (position: number) => {
			const fade = Math.min(1, position / 12, (edge.length - position) / 12);
			let depth = (contour(position) - 0.5) * 0.9 + (fine(position) - 0.5) * 0.18;
			for (const pocket of pockets) {
				const distance =
					Math.abs(position - pocket.center) /
					(position < pocket.center ? pocket.left : pocket.right);
				if (distance < 1) depth += pocket.depth * (1 - distance * distance) ** 2;
			}
			return depth * fade;
		};
		const thickness = (position: number) => {
			const fade = Math.min(1, position / 12, (edge.length - position) / 12);
			return (0.25 + density(position) ** 2 * 2.4) * fade;
		};
		const start = Math.min(cornerTrim[index], edge.length / 4);
		const end = edge.length - Math.min(cornerTrim[(index + 1) % 4], edge.length / 4);
		const steps = Math.ceil((end - start) * 2);
		const positions = new Float32Array(steps + 1);
		const depths = new Float32Array(steps + 1);
		const widths = new Float32Array(steps + 1);
		for (let step = 0; step <= steps; step++) {
			const position = start + ((end - start) * step) / steps;
			positions[step] = position;
			depths[step] = boundary(position);
			widths[step] = thickness(position);
		}
		return { boundary, thickness, positions, depths, widths };
	});

	context.clearRect(0, 0, width, height);
	context.fillStyle = color;
	// 每层使用增量覆盖率，避免 source-over 将薄边累积成不透明描边。
	let previousOpacity = 0;
	for (let layer = 0; layer < edgeOpacity.length; layer++) {
		const amount = layer / (edgeOpacity.length - 1);
		const opacity = edgeOpacity[layer];
		context.globalAlpha = (opacity - previousOpacity) / (1 - previousOpacity);
		previousOpacity = opacity;
		context.beginPath();
		edges.forEach((edge, index) => {
			const profile = profiles[index];
			for (let step = 0; step < profile.positions.length; step++) {
				const position = profile.positions[step];
				const depth = profile.depths[step] + profile.widths[step] * amount;
				const x = edge.x + edge.tx * position - edge.ty * depth;
				const y = edge.y + edge.ty * position + edge.tx * depth;
				if (step === 0) {
					if (index === 0) context.moveTo(x, y);
					else context.quadraticCurveTo(edge.x, edge.y, x, y);
				} else context.lineTo(x, y);
			}
		});
		const first = profiles[0];
		context.quadraticCurveTo(
			inset,
			inset,
			inset + first.positions[0],
			inset + first.depths[0] + first.widths[0] * amount,
		);
		context.closePath();
		context.fill();
	}

	edges.forEach((edge, index) => {
		context.save();
		context.transform(edge.tx, edge.ty, -edge.ty, edge.tx, edge.x, edge.y);
		const random = randomSequence(2197 + index * 317);
		const profile = profiles[index];
		for (let cluster = 10; cluster < edge.length - 10; cluster += 8 + random() * 22) {
			const direction = (random() - 0.5) * 2;
			const count = 3 + Math.floor(random() * 6);
			const spread = 3 + random() * 9;
			for (let fiber = 0; fiber < count; fiber++) {
				const position = Math.min(edge.length - 6, cluster + random() * spread);
				const root = profile.boundary(position) + profile.thickness(position) + 0.4;
				const reach = 0.35 + random() ** 3 * 3.2;
				const lean = direction * (1 + random() * 5);
				const tip = profile.boundary(position) - reach;
				const radius = 0.055 + random() ** 2 * 0.12;
				context.globalAlpha = 0.3 + random() * 0.4;
				context.beginPath();
				context.moveTo(position - radius, root);
				context.bezierCurveTo(
					position + lean * 0.12 - radius,
					root - (root - tip) * 0.42,
					position + lean * 0.6,
					tip + reach * 0.2,
					position + lean,
					tip,
				);
				context.bezierCurveTo(
					position + lean * 0.6 + radius * 0.3,
					tip + reach * 0.2,
					position + lean * 0.12 + radius,
					root - (root - tip) * 0.42,
					position + radius,
					root,
				);
				context.closePath();
				context.fill();
				if (random() < 0.14) {
					context.strokeStyle = color;
					context.lineWidth = radius * 0.7;
					context.globalAlpha *= 0.55;
					context.beginPath();
					context.moveTo(position + lean * 0.3, root - (root - tip) * 0.5);
					context.quadraticCurveTo(
						position + lean * 0.5 - 0.5,
						tip + reach * 0.5,
						position + lean * 0.6 - 0.8,
						tip + reach * 0.12,
					);
					context.stroke();
				}
			}
		}
		context.globalCompositeOperation = "source-atop";
		for (let position = 8; position < edge.length - 8; position += 1.5 + random() * 4) {
			const depth = profile.boundary(position);
			const thickness = profile.thickness(position);
			const length = 1.5 + random() * 5;
			const shaded = random() > 0.65;
			context.strokeStyle = shaded ? "#000" : color;
			context.lineWidth = 0.1 + random() * 0.16;
			context.globalAlpha = shaded ? 0.045 : 0.24;
			context.beginPath();
			context.moveTo(position, depth + thickness + 0.25);
			context.bezierCurveTo(
				position + length * 0.2,
				depth + thickness * 0.65,
				position + length * 0.65,
				depth + thickness * 0.25,
				position + length,
				depth + 0.15,
			);
			context.stroke();
		}
		context.restore();
	});
	context.globalAlpha = 1;
}
