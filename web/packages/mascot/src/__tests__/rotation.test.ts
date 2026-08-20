import { afterEach, describe, expect, it } from "vitest";
import { FACE, FACE_PROJECTION_RADIUS, projectSurfaceAngle } from "../engine/body";
import { Mascot } from "../engine/mascot";

const instances: Mascot[] = [];

function createMascot(): { host: HTMLDivElement; rig: SVGGElement; parts: Element[] } {
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
	return { host, rig, parts: Array.from(rig.children) };
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

afterEach(() => {
	for (const mascot of instances.splice(0)) mascot.destroy();
});

describe("Mascot rotation projection", () => {
	it("keeps neutral anchors and projects the complete rig as one surface", () => {
		const { parts } = createMascot();
		const [tail, earL, earR, body, whiskerL, , blushL, blushR, eyeL, eyeR] = parts;

		const neutralBlushL = Number(blushL.getAttribute("cx"));
		expect(Math.abs(neutralBlushL - FACE.blushL[0])).toBeLessThan(1);
		expect(scaleX(whiskerL.getAttribute("transform"))).toBeGreaterThan(0.9);
		expect(Math.abs(scaleX(earL.getAttribute("transform")))).toBeGreaterThan(0.9);
		expect(Math.abs(scaleX(earR.getAttribute("transform")))).toBeGreaterThan(0.9);
		expect(scaleX(body.getAttribute("transform"))).toBeCloseTo(1, 2);

		const mascot = instances[0];
		mascot.setDevYaw(270);
		expect(scaleX(body.getAttribute("transform"))).toBeLessThan(0.8);
		expect((eyeL as SVGGElement).style.display).toBe("none");
		expect((eyeR as SVGGElement).style.display).toBe("none");
		expect(tailYSpan(tail.getAttribute("d"))).toBeLessThan(90);

		mascot.setDevYaw(315);
		expect(scaleX(body.getAttribute("transform"))).toBeGreaterThan(0.85);
		const expectedTailRoot = projectSurfaceAngle(
			Math.PI - 0.72,
			(315 * Math.PI) / 180,
			FACE_PROJECTION_RADIUS,
		).x;
		expect(Math.abs(tailRootX(tail.getAttribute("d")) - expectedTailRoot)).toBeLessThan(3);
		expect((eyeL as SVGGElement).style.display).toBe("");
		expect((eyeR as SVGGElement).style.display).toBe("");
		expect(Number(blushR.getAttribute("cx"))).not.toBeCloseTo(FACE.blushR[0], 0);
		expect(tailYSpan(tail.getAttribute("d"))).toBeLessThan(70);
	});
});
