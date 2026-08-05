import { describe, expect, it } from "vitest";
import { cleanItem, groupItems } from "./clean-item";

// 用例取自线上 /api/v1/releases 真实条目（v2.2.1 起的 release-please 原生格式）。

describe("cleanItem", () => {
	it("拆加粗 scope（冒号在加粗内），提取 markdown issue 引用，剥除残留空括号", () => {
		const r = cleanItem(
			"**deploy:** 删除 web Dockerfile 对已移除 .npmrc 的 COPY 引用 ([#74](https://github.com/VOD-Studio/violet/issues/74))",
		);
		expect(r.scope).toBe("deploy");
		expect(r.text).toBe("删除 web Dockerfile 对已移除 .npmrc 的 COPY 引用");
		expect(r.refs).toEqual([
			{
				label: "#74",
				url: "https://github.com/VOD-Studio/violet/issues/74",
			},
		]);
	});

	it("剥除任务号括号（T3），保留 issue 引用", () => {
		const r = cleanItem(
			"**diagram:** 全屏模态查看（T3 [#69](https://github.com/VOD-Studio/violet/issues/69)）",
		);
		expect(r.scope).toBe("diagram");
		expect(r.text).toBe("全屏模态查看");
		expect(r.refs.map((x) => x.label)).toEqual(["#69"]);
	});

	it("描述性中文括号（含 ID 回填）不是噪音，必须保留", () => {
		const r = cleanItem("公告创建/更新/删除事件（含 ID 回填）");
		expect(r.scope).toBe("");
		expect(r.text).toBe("公告创建/更新/删除事件（含 ID 回填）");
		expect(r.refs).toEqual([]);
	});

	it("review 标注括号整颗剥除", () => {
		const r = cleanItem(
			"订阅者映射快照字段 + 登录/注册审计修复（review [#58](https://github.com/VOD-Studio/violet/issues/58)）",
		);
		expect(r.text).toBe("订阅者映射快照字段 + 登录/注册审计修复");
		expect(r.refs.map((x) => x.label)).toEqual(["#58"]);
	});

	it("括号内多个引用全部提取", () => {
		const r = cleanItem(
			"删除旧 audit 服务/存储/handler 装配（前置 [#49](https://github.com/VOD-Studio/violet/issues/49)/[#11](https://github.com/VOD-Studio/violet/issues/11)）",
		);
		expect(r.text).toBe("删除旧 audit 服务/存储/handler 装配");
		expect(r.refs.map((x) => x.label)).toEqual(["#49", "#11"]);
	});

	it("PRD 编号括号剥除，相邻空括号一并清理", () => {
		const r = cleanItem(
			"**about:** About 页重设计 + 更新日志（PRD-0009） ([#7](https://github.com/VOD-Studio/violet/issues/7))",
		);
		expect(r.scope).toBe("about");
		expect(r.text).toBe("About 页重设计 + 更新日志");
		expect(r.refs.map((x) => x.label)).toEqual(["#7"]);
	});

	it("冒号在加粗外的中文冒号形态；反引号剥为纯文本", () => {
		const r = cleanItem(
			"**CI 镜像名统一**：deploy.yml 与 docker-compose.ci.yml 的镜像名从 `blog-api` 统一为 `violet-api`",
		);
		expect(r.scope).toBe("CI 镜像名统一");
		expect(r.text).toContain("blog-api 统一为 violet-api");
		expect(r.text).not.toContain("`");
	});

	it("无引用的普通条目原样通过", () => {
		const r = cleanItem("**web:** 图块交互增强与图表渲染修复");
		expect(r.scope).toBe("web");
		expect(r.text).toBe("图块交互增强与图表渲染修复");
		expect(r.refs).toEqual([]);
	});

	it("链接移除后中文标点前不残留空格", () => {
		const r = cleanItem(
			"**图块:** 交互升级：全屏模态查看 ([#69](https://github.com/VOD-Studio/violet/issues/69))、捏合缩放 ([#68](https://github.com/VOD-Studio/violet/issues/68))",
		);
		expect(r.text).toBe("交互升级：全屏模态查看、捏合缩放");
		expect(r.refs.map((x) => x.label)).toEqual(["#69", "#68"]);
	});

	it("中文 scope 正常拆出", () => {
		const r = cleanItem(
			"**图块:** 全屏模态查看 ([#69](https://github.com/VOD-Studio/violet/issues/69))",
		);
		expect(r.scope).toBe("图块");
		expect(r.text).toBe("全屏模态查看");
	});
});

describe("groupItems", () => {
	it("同 scope 聚合成组，无 scope 进散条目组", () => {
		const items = [
			"**diagram:** a",
			"**diagram:** b",
			"**web:** c",
			"**deploy:** d",
			"无 scope 条目",
		].map(cleanItem);
		const groups = groupItems(items);
		expect(groups.map((g) => g.scope)).toEqual(["diagram", "web", "deploy", null]);
		expect(groups[0].items.map((i) => i.text)).toEqual(["a", "b"]);
		expect(groups[1].items.map((i) => i.text)).toEqual(["c"]);
		expect(groups[2].items.map((i) => i.text)).toEqual(["d"]);
		expect(groups[3].items.map((i) => i.text)).toEqual(["无 scope 条目"]);
	});

	it("单例 scope 也成组（不剥前缀丢模块信息）", () => {
		const items = ["**主题:** 多图块页面切换主题时卡死"].map(cleanItem);
		const groups = groupItems(items);
		expect(groups.map((g) => g.scope)).toEqual(["主题"]);
		expect(groups[0].items[0].text).toBe("多图块页面切换主题时卡死");
	});

	it("组按 scope 首次出现排序", () => {
		const items = ["**web:** a", "**diagram:** b", "**diagram:** c", "**web:** d"].map(
			cleanItem,
		);
		expect(groupItems(items).map((g) => g.scope)).toEqual(["web", "diagram"]);
	});

	it("全部无 scope 时只有一个散组", () => {
		const groups = groupItems(["a", "b"].map(cleanItem));
		expect(groups).toHaveLength(1);
		expect(groups[0].scope).toBeNull();
	});
});
