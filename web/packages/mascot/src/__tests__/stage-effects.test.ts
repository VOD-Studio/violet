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

	it("starts a standalone ribbon layer without requiring a spin", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const mascot = new Mascot(host, { emotion: "08", frozen: true });
		instances.push(mascot);
		const now = performance.now();

		mascot.streamers();
		mascot.tick(now + 120, 0.12);
		expect(host.querySelectorAll('linearGradient[id^="ribbon-grad-"]').length).toBe(3);

		mascot.tick(now + 4000, 4);
		expect(host.querySelectorAll('linearGradient[id^="ribbon-grad-"]').length).toBe(0);
	});

	it("drives the ambient stage lights through the spotlight variable", () => {
		const stage = document.createElement("div");
		const host = document.createElement("div");
		stage.appendChild(host);
		document.body.appendChild(stage);
		const mascot = new Mascot(host, { emotion: "08", frozen: true });
		instances.push(mascot);

		mascot.spotlight();
		mascot.tick(performance.now() + 200, 0.2);
		const glow = stage.style.getPropertyValue("--mascot-spotlight");
		expect(Number.parseFloat(glow)).toBeGreaterThan(0);
		expect(host.querySelectorAll("path[fill='#FFF3C4']").length).toBe(4);

		mascot.tick(performance.now() + 1800, 1.4);
		expect(stage.style.getPropertyValue("--mascot-spotlight")).toBe("");

		mascot.destroy();
		expect(stage.style.getPropertyValue("--mascot-spotlight")).toBe("");
	});
	it("keeps a persistent magic circle alive until explicitly disabled", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const mascot = new Mascot(host, { emotion: "08", frozen: true });
		instances.push(mascot);

		mascot.setMagicPersistent(true, { size: 1.1, intensity: 0.8, speed: 0.3 });
		mascot.tick(performance.now() + 2200, 2.2);
		expect(host.querySelector("[data-ring=outer]")).not.toBeNull();

		mascot.setMagicPersistent(false);
		expect(host.querySelector("[data-ring=outer]")).toBeNull();
	});
});
