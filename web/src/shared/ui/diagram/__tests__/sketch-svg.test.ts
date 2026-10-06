import { afterEach, describe, expect, it } from "vitest";
import { sketchSvg } from "../sketch-svg";

function mount(content: string): SVGSVGElement {
	const container = document.createElement("div");
	container.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">${content}</svg>`;
	document.body.appendChild(container);
	return container.firstElementChild as SVGSVGElement;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("sketchSvg geometry boundaries", () => {
	it("keeps transparent label placeholders invisible and leaves definition geometry intact", () => {
		const svg = mount(`
			<defs><clipPath id="clip"><rect width="80" height="40"/></clipPath></defs>
			<mask id="mask"><circle cx="20" cy="20" r="15"/></mask>
			<rect id="placeholder" width="80" height="40" style="fill:rgba(0,0,0,0);stroke:none"/>
			<rect id="opacity-placeholder" width="80" height="40" style="fill:red;fill-opacity:0;stroke:none"/>
			<rect id="empty-label" width="0" height="0" style="fill:black;stroke:none"/>
			<path d="M0 20L80 20" style="fill:none;stroke:red;clip-path:url(#clip);mask:url(#mask)"/>
		`);
		const definitions = svg.querySelector("defs");
		const mask = svg.querySelector("mask");
		const placeholder = svg.querySelector("#placeholder");
		const opacityPlaceholder = svg.querySelector("#opacity-placeholder");
		const emptyLabel = svg.querySelector("#empty-label");
		sketchSvg(svg);
		expect(svg.querySelector("defs")).toBe(definitions);
		expect(svg.querySelector("mask")).toBe(mask);
		expect(svg.querySelector("#placeholder")).toBe(placeholder);
		expect(svg.querySelector("#opacity-placeholder")).toBe(opacityPlaceholder);
		expect(svg.querySelector("#empty-label")).toBe(emptyLabel);
		const outlined = svg.querySelector("g");
		expect(outlined?.style.getPropertyValue("clip-path")).toContain("#clip");
		expect(outlined?.style.getPropertyValue("mask")).toContain("#mask");
	});

	it("retains one exact marker carrier and applies dashed paint only to the sketch", () => {
		const originalPath = "M10 30 L130 30 L130 80";
		const svg = mount(`
			<marker id="arrow" orient="auto" markerWidth="10" markerHeight="10"><path d="M0 0L10 5L0 10Z"/></marker>
			<path id="edge" d="${originalPath}" style="fill:none;stroke:rgb(255,0,0);stroke-width:2;stroke-dasharray:5 3;stroke-dashoffset:2;marker-end:url(#arrow)"/>
		`);
		const marker = svg.querySelector("marker");
		sketchSvg(svg);
		expect(svg.querySelector("marker")).toBe(marker);
		const paths = Array.from(svg.querySelectorAll<SVGPathElement>("#edge > path"));
		const carrier = paths.find((path) => path.getAttribute("d") === originalPath);
		const outline = paths.find((path) => path !== carrier);
		expect(carrier?.style.getPropertyValue("stroke")).toBe("none");
		expect(Number.parseFloat(carrier?.style.getPropertyValue("stroke-width") ?? "")).toBe(2);
		expect(carrier?.style.getPropertyValue("marker-end")).toContain("#arrow");
		expect(outline?.style.getPropertyValue("marker-end")).toBe("none");
		expect(outline?.style.getPropertyValue("stroke-dasharray")).toBe("5 3");
		expect(outline?.style.getPropertyValue("stroke-dashoffset")).toBe("2");
		expect(outline?.style.getPropertyValue("stroke")).not.toBe("none");
	});

	it("outlines fill-only colored nodes without restoring a transparent stroke", () => {
		const svg = mount(
			'<circle cx="70" cy="50" r="20" style="fill:rgb(255,0,0);stroke:transparent;opacity:.6;fill-opacity:.7"/>',
		);
		sketchSvg(svg);
		const paths = Array.from(svg.querySelectorAll("path"));
		expect(
			paths.some(
				(path) =>
					path.style.getPropertyValue("fill") === "none" &&
					path.style.getPropertyValue("stroke") !== "none",
			),
		).toBe(true);
		expect(svg.querySelector("g")?.style.getPropertyValue("opacity")).toBe("0.6");
		for (const path of paths) expect(path.style.getPropertyValue("opacity")).toBe("1");
	});

	it("keeps tight text backings unframed while still sketching their solid fill", () => {
		const svg = mount(
			'<g><rect x="20" y="30" width="54" height="20" style="fill:#fff;stroke:none"/><text x="22" y="46">Label</text></g>',
		);
		const rect = svg.querySelector("rect");
		const text = svg.querySelector("text");
		Object.defineProperty(rect, "getBBox", {
			value: () => ({ x: 20, y: 30, width: 54, height: 20 }),
		});
		Object.defineProperty(text, "getBBox", {
			value: () => ({ x: 22, y: 32, width: 50, height: 16 }),
		});
		sketchSvg(svg);
		const paths = Array.from(svg.querySelectorAll("path"));
		expect(paths[0].style.getPropertyValue("stroke")).toBe("none");
		expect(svg.querySelector("text")).toBe(text);
	});

	it("keeps textPath lettering on an exact invisible centerline and retains accessible names", () => {
		const d = "M10 30 C40 0 70 0 100 30";
		const svg = mount(`
			<path id="curve" d="${d}" transform="translate(5 10)" aria-label="Curve" style="fill:none;stroke:#234"><title>Curve description</title></path>
			<text><textPath href="#curve">Curved label</textPath></text>
		`);
		const text = svg.querySelector("text");
		sketchSvg(svg);
		const textPath = svg.querySelector("textPath");
		const referencedId = textPath?.getAttribute("href")?.slice(1);
		const centerline = document.getElementById(referencedId ?? "");
		expect(centerline?.localName).toBe("path");
		expect(centerline?.getAttribute("d")).toBe(d);
		expect(centerline?.parentElement?.getAttribute("transform")).toBe("translate(5 10)");
		expect(svg.querySelector("#curve")?.getAttribute("aria-label")).toBe("Curve");
		expect(svg.querySelector("#curve title")?.textContent).toBe("Curve description");
		expect(svg.querySelector("text")).toBe(text);
	});

	it("uses the same pen geometry after rerendering or changing only theme colors", () => {
		const light = mount(
			'<circle cx="60" cy="50" r="20" style="fill:#fff;stroke:#123"/><line x1="10" y1="100" x2="120" y2="100" style="fill:none;stroke:#123"/>',
		);
		const repeated = light.cloneNode(true) as SVGSVGElement;
		const dark = mount(
			'<circle cx="60" cy="50" r="20" style="fill:#123;stroke:#fff"/><line x1="10" y1="100" x2="120" y2="100" style="fill:none;stroke:#fff"/>',
		);
		document.body.appendChild(repeated);
		for (const svg of [light, repeated, dark]) sketchSvg(svg);
		const lightPaths = Array.from(light.querySelectorAll("path"), (path) =>
			path.getAttribute("d"),
		);
		expect(
			Array.from(repeated.querySelectorAll("path"), (path) => path.getAttribute("d")),
		).toEqual(lightPaths);
		expect(Array.from(dark.querySelectorAll("path"), (path) => path.getAttribute("d"))).toEqual(
			lightPaths,
		);
	});
});
