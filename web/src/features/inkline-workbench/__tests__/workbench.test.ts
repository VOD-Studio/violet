import { describe, expect, it } from "vitest";
import { inkArtwork, phasedSchedule, type VectorArtwork } from "../lib/artwork";
import { EXAMPLE_CODE, MERMAID_DIAGRAM, mermaidDiagram, readmeRegion } from "../lib/examples";
import { type ExportSettings, exportCode } from "../lib/export-code";
import { findSectionBySlug, SECTIONS, sectionFromPath } from "../model/sections";

describe("sections", () => {
	it("maps /inkline and each slug to its section", () => {
		expect(sectionFromPath("/inkline").id).toBe("artwork");
		expect(sectionFromPath("/inkline/").id).toBe("artwork");
		expect(sectionFromPath("/inkline/pens").id).toBe("pens");
		expect(sectionFromPath("/inkline/export/").id).toBe("export");
	});

	it("gives every section except the artwork a unique slug", () => {
		const slugs = SECTIONS.flatMap((s) => (s.slug ? [s.slug] : []));
		expect(new Set(slugs).size).toBe(SECTIONS.length - 1);
		expect(findSectionBySlug("nope")).toBeUndefined();
	});
});

describe("example sources", () => {
	it("keeps only the README region, like the package's sync script", () => {
		const source =
			'import x from "y";\n// #region readme\nconst a = 1;\n// #endregion\nexport { a };\n';
		expect(readmeRegion(source)).toBe("const a = 1;");
		expect(readmeRegion("const b = 2;\n")).toBe("const b = 2;");
	});

	it("shows the same code as the package README", () => {
		expect(EXAMPLE_CODE.pens).toContain("pen: gpen");
		expect(EXAMPLE_CODE.animation).toContain("createPlayer");
		expect(EXAMPLE_CODE.quickStart).not.toContain("#region");
	});

	it("reads the Mermaid diagram out of the example", () => {
		expect(MERMAID_DIAGRAM.startsWith("flowchart LR")).toBe(true);
		expect(() => mermaidDiagram("const other = 1;")).toThrow(/const source/);
	});
});

describe("exportCode", () => {
	const settings: ExportSettings = {
		format: "gif",
		width: 480,
		fps: 25,
		duration: 8,
		hold: 1,
		loop: true,
		bitrate: null,
	};

	it("writes only the options that differ from the defaults", () => {
		const code = exportCode(settings);
		expect(code).toContain('import { exportGif } from "@violetjs/inkline/export";');
		expect(code).toContain("width: 480,");
		expect(code).toContain("duration: 8,");
		expect(code).not.toContain("fps:");
		expect(code).not.toContain("hold:");
		expect(code).not.toContain("loop:");
	});

	it("checks WebM support first and formats the bitrate", () => {
		const code = exportCode({ ...settings, format: "webm", fps: 30, bitrate: 2_000_000 });
		expect(code).toContain("if (await canExportWebm()) {");
		expect(code).toContain("fps: 30,");
		expect(code).toContain("bitrate: 2_000_000,");
	});

	it("asks for a single play when looping is off", () => {
		expect(exportCode({ ...settings, loop: false })).toContain("loop: 1,");
	});
});

describe("artwork", () => {
	const art: VectorArtwork = {
		width: 100,
		height: 80,
		paperRole: "sheet",
		inkRole: "line",
		palette: { sheet: "#fefefe", line: "#123456", skin: "#f0d0c0" },
		colors: [{ role: "skin", paths: ["M10 10H40V40H10Z", "M50 10H90V40H50Z"] }],
		ink: [{ path: "M10 50H20V60H10Z" }],
		strokes: [{ width: 2, path: "M10 70L90 70" }],
	};

	it("orders paper, color regions, ink areas and strokes, and plays them in three phases", () => {
		const { drawing, phases, palette } = inkArtwork(art);
		expect(drawing.items.map((item) => item.id)).toEqual([
			"paper",
			"skin-0-0",
			"skin-0-1",
			"ink-0",
			"stroke-0",
		]);
		expect(phases).toEqual([[0], [3, 4], [1, 2]]);
		expect(palette).toMatchObject({ paper: "#fefefe", ink: "#123456" });
	});

	it("chains phases so lines finish before colors start", () => {
		const { drawing, phases } = inkArtwork(art);
		const schedule = phasedSchedule(drawing, phases, "parallel");
		const linesEnd = Math.max(schedule.end[3], schedule.end[4]);
		expect(schedule.start[0]).toBe(0);
		expect(schedule.start[3]).toBeCloseTo(schedule.end[0]);
		expect(Math.min(schedule.start[1], schedule.start[2])).toBeCloseTo(linesEnd);
		expect(schedule.duration).toBeCloseTo(Math.max(schedule.end[1], schedule.end[2]));
	});

	it("plays the whole drawing as one phase when not phased", () => {
		expect(inkArtwork(art, [], false).phases).toEqual([[0, 1, 2, 3, 4]]);
	});
});
