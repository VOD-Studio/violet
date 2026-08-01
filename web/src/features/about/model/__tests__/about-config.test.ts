import type { AboutConfig } from "@features/settings/model/types";
import { describe, expect, it } from "vitest";
import { resolveSectionOrder } from "../about-config";

describe("resolveSectionOrder", () => {
    it("按 order 升序排序并过滤 disabled", () => {
        const config: AboutConfig = {
            sections: [
                { id: "b", enabled: true, order: 2 },
                { id: "a", enabled: true, order: 1 },
                { id: "disabled", enabled: false, order: 0 },
            ],
        };
        expect(resolveSectionOrder(config)).toEqual(["a", "b"]);
    });

    it("order 缺省视为 0", () => {
        const config: AboutConfig = {
            sections: [
                { id: "first", enabled: true },
                { id: "second", enabled: true, order: 5 },
            ],
        };
        expect(resolveSectionOrder(config)).toEqual(["first", "second"]);
    });

    it("空配置（null/undefined）返回空数组（触发前台回退默认渲染）", () => {
        expect(resolveSectionOrder(null)).toEqual([]);
        expect(resolveSectionOrder(undefined)).toEqual([]);
    });

    it("sections 缺失返回空数组", () => {
        expect(resolveSectionOrder({ sections: [] })).toEqual([]);
    });
});
