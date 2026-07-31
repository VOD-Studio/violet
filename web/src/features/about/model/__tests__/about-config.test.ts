import { describe, expect, it } from "vitest";
import { parseAboutConfig, resolveSectionOrder, stringifyAboutConfig } from "../about-config";

describe("parseAboutConfig", () => {
    it("空串返回空 sections", () => {
        expect(parseAboutConfig("")).toEqual({ sections: [] });
        expect(parseAboutConfig(null)).toEqual({ sections: [] });
        expect(parseAboutConfig(undefined)).toEqual({ sections: [] });
    });

    it("合法 JSON 正确解析", () => {
        const raw = JSON.stringify({
            sections: [{ id: "bio", enabled: true, order: 1 }],
        });
        expect(parseAboutConfig(raw)).toEqual({
            sections: [{ id: "bio", enabled: true, order: 1 }],
        });
    });

    it("非法 JSON 回退空 sections（不抛异常）", () => {
        expect(parseAboutConfig("{not json")).toEqual({ sections: [] });
    });

    it("结构不符（sections 非数组）回退空", () => {
        expect(parseAboutConfig(JSON.stringify({ sections: "x" }))).toEqual({
            sections: [],
        });
    });
});

describe("resolveSectionOrder", () => {
    it("按 order 升序排序并过滤 disabled", () => {
        const config = parseAboutConfig(
            stringifyAboutConfig({
                sections: [
                    { id: "b", enabled: true, order: 2 },
                    { id: "a", enabled: true, order: 1 },
                    { id: "disabled", enabled: false, order: 0 },
                ],
            }),
        );
        expect(resolveSectionOrder(config)).toEqual(["a", "b"]);
    });

    it("order 缺省视为 0", () => {
        const config = parseAboutConfig(
            stringifyAboutConfig({
                sections: [
                    { id: "first", enabled: true },
                    { id: "second", enabled: true, order: 5 },
                ],
            }),
        );
        expect(resolveSectionOrder(config)).toEqual(["first", "second"]);
    });

    it("全空配置返回空数组（触发前台回退默认渲染）", () => {
        expect(resolveSectionOrder(parseAboutConfig(""))).toEqual([]);
    });
});

describe("stringifyAboutConfig", () => {
    it("与 parseAboutConfig 可逆往返", () => {
        const config = {
            sections: [{ id: "bio", enabled: true, order: 1, params: { foo: "bar" } }],
        };
        const raw = stringifyAboutConfig(config);
        expect(parseAboutConfig(raw)).toEqual(config);
    });
});
