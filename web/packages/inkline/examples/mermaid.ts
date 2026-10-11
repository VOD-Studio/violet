// 在浏览器中运行：scripts/render-mermaid.mjs 用 Chromium 执行本文件生成 docs/images/mermaid.svg
// #region readme
import { gpen, styles } from "@violetjs/inkline";
import { inkSvg } from "@violetjs/inkline/dom";
import mermaid from "mermaid";

const source = `flowchart LR
	idea([Idea]) --> draft[Draft] --> review{Review?}
	review -- yes --> publish[Publish]
	review -- no --> draft`;

mermaid.initialize({ startOnLoad: false, theme: "neutral" });
const { svg } = await mermaid.render("flow", source);

const host = document.querySelector("#diagram") as HTMLElement;
host.innerHTML = svg;
// inkSvg reads computed styles and sizes, so the SVG must already be in the document.
inkSvg(host.querySelector("svg") as SVGSVGElement, { style: { ...styles.draft, pen: gpen } });
// #endregion
