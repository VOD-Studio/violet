/**
 * extractDiagramLabel 测试（T4 aria-label 语义化）
 *
 * 验证从 mermaid 源码提取可读标题的优先级：
 * title 关键字 > 行首 %% 注释 > 降级「Mermaid 图表」
 */
import { describe, expect, it } from "vitest";
import { extractDiagramLabel } from "../label";

describe("extractDiagramLabel", () => {
	it("无任何标题信息时降级为「Mermaid 图表」", () => {
		expect(extractDiagramLabel("flowchart TD\n    A --> B")).toBe("Mermaid 图表");
	});

	it("空源码降级", () => {
		expect(extractDiagramLabel("")).toBe("Mermaid 图表");
	});

	it("行首 %% 注释作为标题", () => {
		expect(extractDiagramLabel("%% 用户注册流程 %%\nflowchart TD\n    A --> B")).toBe(
			"用户注册流程",
		);
	});

	it("行首 %% 注释无闭合 %% 也能提取", () => {
		expect(extractDiagramLabel("%% 系统架构图\nflowchart TD")).toBe("系统架构图");
	});

	it("跳过 %%{init}%% 指令，不误认为注释", () => {
		expect(
			extractDiagramLabel('%%{init: {"theme": "dark"}}%%\nflowchart TD\n    A --> B'),
		).toBe("Mermaid 图表");
	});

	it("从 %%{init}%% 指令内提取 title", () => {
		expect(extractDiagramLabel('%%{init: {"title": "部署流程"}}%%\nflowchart TD')).toBe(
			"部署流程",
		);
	});

	it("title 关键字（冒号格式）作为标题", () => {
		expect(extractDiagramLabel("flowchart TD\n    title: 订单处理流程\n    A --> B")).toBe(
			"订单处理流程",
		);
	});

	it("title 关键字优先于 %% 注释", () => {
		const source = "%% 注释说明 %%\nflowchart TD\n    title: 优先级更高的标题";
		expect(extractDiagramLabel(source)).toBe("优先级更高的标题");
	});

	it("YAML frontmatter 的 title", () => {
		expect(
			extractDiagramLabel("---\ntitle: CI/CD 流水线\n---\nflowchart TD\n    A --> B"),
		).toBe("CI/CD 流水线");
	});

	it("title 带引号时去引号", () => {
		expect(extractDiagramLabel('flowchart TD\n    title: "引号标题"')).toBe("引号标题");
	});
});
