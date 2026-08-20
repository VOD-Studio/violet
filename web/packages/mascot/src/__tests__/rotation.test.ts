import { afterEach, describe, expect, it } from "vitest";
import { FACE, projectSurfaceAngle, TAIL_ROOT_ANGLE, TAIL_ROOT_RADIUS } from "../engine/body";
import { Mascot } from "../engine/mascot";

const instances: Mascot[] = [];

type MascotParts = {
	host: HTMLDivElement;
	rig: SVGGElement;
	tail: SVGPathElement;
	earL: SVGGElement;
	earR: SVGGElement;
	body: SVGPathElement;
	whiskerL: SVGGElement;
	blushL: SVGEllipseElement;
	blushR: SVGEllipseElement;
	eyeL: SVGGElement;
	eyeR: SVGGElement;
};

function createMascot(): MascotParts {
	const host = document.createElement("div");
	document.body.appendChild(host);
	const mascot = new Mascot(host, { emotion: "08", frozen: true });
	instances.push(mascot);
	const svg = host.querySelector("svg");
	if (!svg) throw new Error("Mascot SVG was not created");
	const rig = Array.from(svg.children).find(
		(child): child is SVGGElement => child.tagName === "g" && child.children.length >= 13,
	);
	if (!rig) throw new Error("Mascot rig was not created");
	const children = Array.from(rig.children);
	const tail = children.find(
		(child): child is SVGPathElement =>
			child.tagName === "path" && child.getAttribute("stroke-width") === "12",
	);
	const ears = children.filter(
		(child): child is SVGGElement =>
			child.tagName === "g" &&
			child.children.length === 2 &&
			child.children[0].getAttribute("stroke-width") === "1.6",
	);
	const body = children.find(
		(child): child is SVGPathElement =>
			child.tagName === "path" &&
			child.getAttribute("fill")?.startsWith("url(#cat-body-grad-") === true,
	);
	const whiskerL = children.find(
		(child): child is SVGGElement =>
			child.tagName === "g" &&
			child.children[0]?.getAttribute("d")?.startsWith("M 56") === true,
	);
	const blushes = children.filter(
		(child): child is SVGEllipseElement => child.tagName === "ellipse",
	);
	const eyes = children.filter(
		(child): child is SVGGElement =>
			child.tagName === "g" &&
			child.children.length === 3 &&
			child.children[0].tagName === "path" &&
			child.children[1].tagName === "circle",
	);
	if (
		!tail ||
		ears.length !== 2 ||
		!body ||
		!whiskerL ||
		blushes.length !== 2 ||
		eyes.length !== 2
	) {
		throw new Error("Mascot rotation parts were not found");
	}
	return {
		host,
		rig,
		tail,
		earL: ears[0],
		earR: ears[1],
		body,
		whiskerL,
		blushL: blushes[0],
		blushR: blushes[1],
		eyeL: eyes[0],
		eyeR: eyes[1],
	};
}
function scaleX(transform: string | null): number {
	const match = transform?.match(/scale\((-?[0-9.]+)/);
	if (!match) throw new Error(`Missing scale in transform: ${transform}`);
	return Number(match[1]);
}

function tailYSpan(path: string | null): number {
	if (!path) throw new Error("Missing tail path");
	const values = path.match(/-?[0-9.]+/g)?.map(Number) ?? [];
	const ys = values.filter((_, index) => index % 2 === 1);
	return Math.max(...ys) - Math.min(...ys);
}

function tailRootX(path: string | null): number {
	const match = path?.match(/M (-?[0-9.]+)/);
	if (!match) throw new Error("Missing tail root");
	return Number(match[1]);
}

function childIndex(parent: Element, child: Element): number {
	const index = Array.from(parent.children).indexOf(child);
	if (index < 0) throw new Error("Mascot part is not attached to rig");
	return index;
}

afterEach(() => {
	for (const mascot of instances.splice(0)) mascot.destroy();
});

describe("Mascot rotation projection", () => {
	it("keeps neutral anchors and projects the complete rig as one surface", () => {
		const { rig, tail, earL, earR, body, whiskerL, blushL, blushR, eyeL, eyeR } =
			createMascot();

		const neutralBlushL = Number(blushL.getAttribute("cx"));
		expect(Math.abs(neutralBlushL - FACE.blushL[0])).toBeLessThan(1);
		expect(scaleX(whiskerL.getAttribute("transform"))).toBeGreaterThan(0.9);
		expect(Math.abs(scaleX(earL.getAttribute("transform")))).toBeGreaterThan(0.9);
		expect(Math.abs(scaleX(earR.getAttribute("transform")))).toBeGreaterThan(0.9);
		expect(body.parentElement).toBe(rig);
		expect(body.getAttribute("transform")).toBeNull();
		expect(childIndex(rig, tail)).toBeLessThan(childIndex(rig, body));

		const mascot = instances[0];
		mascot.setDevYaw(90);
		expect(body.getAttribute("transform")).toBeNull();
		expect(Number(earL.getAttribute("opacity"))).toBeGreaterThan(0.8);
		expect(Number(earR.getAttribute("opacity"))).toBe(0);
		expect(childIndex(rig, tail)).toBeLessThan(childIndex(rig, body));
		expect(tailYSpan(tail.getAttribute("d"))).toBeLessThan(90);

		mascot.setDevYaw(125);
		expect(Number(earL.getAttribute("opacity"))).toBe(0);
		expect(Number(earR.getAttribute("opacity"))).toBeGreaterThan(0.8);

		mascot.setDevYaw(180);
		expect(body.getAttribute("transform")).toBeNull();
		expect(childIndex(rig, tail)).toBeGreaterThan(childIndex(rig, body));
		expect(tailRootX(tail.getAttribute("d"))).toBeLessThan(75);

		mascot.setDevYaw(270);
		expect((eyeL as SVGGElement).style.display).toBe("none");
		expect((eyeR as SVGGElement).style.display).toBe("none");
		expect(childIndex(rig, tail)).toBeLessThan(childIndex(rig, body));

		mascot.setDevYaw(315);
		expect(body.getAttribute("transform")).toBeNull();
		expect(childIndex(rig, tail)).toBeLessThan(childIndex(rig, body));
		const expectedTailRoot = projectSurfaceAngle(
			TAIL_ROOT_ANGLE,
			(315 * Math.PI) / 180,
			TAIL_ROOT_RADIUS,
		).x;
		expect(Math.abs(tailRootX(tail.getAttribute("d")) - expectedTailRoot)).toBeLessThan(3);
		expect((eyeL as SVGGElement).style.display).toBe("");
		expect((eyeR as SVGGElement).style.display).toBe("");
		expect(Number(blushR.getAttribute("cx"))).not.toBeCloseTo(FACE.blushR[0], 0);
		expect(tailYSpan(tail.getAttribute("d"))).toBeLessThan(70);
	});
});
