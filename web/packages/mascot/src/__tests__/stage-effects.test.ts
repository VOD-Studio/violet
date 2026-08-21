import { afterEach, describe, expect, it } from "vitest";
import { Mascot } from "../engine/mascot";

const instances: Mascot[] = [];

afterEach(() => {
	for (const mascot of instances.splice(0)) mascot.destroy();
});

describe("stage effects", () => {
	it("renders the magic circle on the ground with counter-rotating rings", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const mascot = new Mascot(host, { emotion: "08", frozen: true });
		instances.push(mascot);

		mascot.magic();
		mascot.tick(400, 0.4);

		const svg = host.querySelector("svg");
		const outer = svg?.querySelector<SVGGElement>("[data-ring=outer]");
		const inner = svg?.querySelector<SVGGElement>("[data-ring=inner]");
		const root = outer?.parentElement;
		const shadow = svg?.querySelector<SVGEllipseElement>("[data-ground-shadow=true]");
		const backLayer = svg?.querySelector("[data-effect-layer=back]");
		const shadowIndex = shadow ? Array.from(svg?.children ?? []).indexOf(shadow) : -1;
		const backIndex = backLayer ? Array.from(svg?.children ?? []).indexOf(backLayer) : -1;
		const rootTransform = root?.getAttribute("transform") ?? "";
		const outerRotation = Number.parseFloat(
			outer?.getAttribute("transform")?.match(/-?\d+(?:\.\d+)?/)?.[0] ?? "0",
		);
		const innerRotation = Number.parseFloat(
			inner?.getAttribute("transform")?.match(/-?\d+(?:\.\d+)?/)?.[0] ?? "0",
		);

		expect(rootTransform).toContain("translate(130 232)");
		expect(rootTransform).toMatch(/scale\(\d+\.\d+ 0\.\d+\)/);
		expect(outerRotation).toBeGreaterThan(0);
		expect(innerRotation).toBeLessThan(0);
		expect(shadow?.getAttribute("filter")).toContain("cat-shadow-blur");
		expect(shadowIndex).toBeGreaterThan(backIndex);
	});
});
