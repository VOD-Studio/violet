interface Edge {
	length: number;
	x: number;
	y: number;
	tx: number;
	ty: number;
}

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
		const fine = smoothField(edge.length, 3.5, random);
		const density = smoothField(edge.length, 19, random);
		const pockets: { center: number; radius: number; depth: number }[] = [];
		for (let position = 25; position < edge.length - 20; position += 38 + random() * 70) {
			pockets.push({
				center: position,
				radius: 4 + random() * 12,
				depth: 0.4 + random() * 1.5,
			});
		}
		const boundary = (position: number) => {
			const fade = Math.min(1, position / 12, (edge.length - position) / 12);
			let depth = (contour(position) - 0.5) * 1.1 + (fine(position) - 0.5) * 0.3;
			for (const pocket of pockets) {
				const distance = Math.abs(position - pocket.center) / pocket.radius;
				if (distance < 1) depth += pocket.depth * (1 - distance * distance) ** 2;
			}
			return depth * fade;
		};
		const thickness = (position: number) => {
			const fade = Math.min(1, position / 12, (edge.length - position) / 12);
			return (0.35 + density(position) ** 2 * 3.2) * fade;
		};
		return { boundary, thickness };
	});

	context.clearRect(0, 0, width, height);
	context.fillStyle = color;
	for (const [amount, opacity] of [
		[0, 0.48],
		[0.4, 0.62],
		[1, 1],
	]) {
		context.globalAlpha = opacity;
		context.beginPath();
		edges.forEach((edge, index) => {
			const profile = profiles[index];
			for (let step = 0; step <= Math.ceil(edge.length); step++) {
				const position = Math.min(step, edge.length);
				const depth = profile.boundary(position) + profile.thickness(position) * amount;
				const x = edge.x + edge.tx * position - edge.ty * depth;
				const y = edge.y + edge.ty * position + edge.tx * depth;
				if (index === 0 && step === 0) context.moveTo(x, y);
				else context.lineTo(x, y);
			}
		});
		context.closePath();
		context.fill();
	}

	edges.forEach((edge, index) => {
		context.save();
		context.transform(edge.tx, edge.ty, -edge.ty, edge.tx, edge.x, edge.y);
		const random = randomSequence(2197 + index * 317);
		const profile = profiles[index];
		for (let cluster = 10; cluster < edge.length - 10; cluster += 9 + random() * 20) {
			const direction = (random() - 0.5) * 2;
			const count = 2 + Math.floor(random() * 5);
			for (let fiber = 0; fiber < count; fiber++) {
				const position = Math.min(edge.length - 6, cluster + random() * 7);
				const root = profile.boundary(position) + profile.thickness(position) * 0.7;
				const reach = 0.6 + random() ** 2 * 3;
				const lean = direction * (1.5 + random() * 4);
				const tip = profile.boundary(position) - reach;
				const radius = 0.12 + random() * 0.16;
				context.globalAlpha = 0.35 + random() * 0.5;
				context.beginPath();
				context.moveTo(position - radius, root);
				context.quadraticCurveTo(
					position + lean * 0.3,
					tip + reach * 0.45,
					position + lean,
					tip,
				);
				context.quadraticCurveTo(
					position + lean * 0.3 + radius,
					tip + reach * 0.45,
					position + radius,
					root,
				);
				context.closePath();
				context.fill();
			}
		}
		context.strokeStyle = color;
		context.lineWidth = 0.22;
		for (let position = 8; position < edge.length - 8; position += 2 + random() * 4) {
			const depth = profile.boundary(position);
			const thickness = profile.thickness(position);
			context.globalAlpha = 0.18 + random() * 0.3;
			context.beginPath();
			context.moveTo(position, depth + thickness + 0.3);
			context.quadraticCurveTo(
				position + 1,
				depth + thickness * 0.5,
				position + 2.5,
				depth + 0.1,
			);
			context.stroke();
		}
		context.restore();
	});
	context.globalAlpha = 1;
}
