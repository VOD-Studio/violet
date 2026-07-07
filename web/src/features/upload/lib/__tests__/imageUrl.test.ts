import { describe, expect, it } from "vitest";
import { avatarUrl } from "../imageUrl";

describe("avatarUrl", () => {
    it("空 path 返回默认头像", () => {
        expect(avatarUrl("", "alice")).toContain("ui-avatars.com");
    });

    it("undefined path 返回默认头像", () => {
        expect(avatarUrl(undefined as unknown as string, "alice")).toContain("ui-avatars.com");
    });

    it("静态图追加 w/thumb/format 参数", () => {
        const u = avatarUrl("/uploads/avatar/x.webp", "alice");
        expect(u).toContain("w=200");
        expect(u).toContain("thumb=200x200");
        expect(u).toContain("format=webp");
    });

    it("GIF 剥除所有处理参数保护动画", () => {
        const u = avatarUrl("/uploads/avatar/a.gif", "alice");
        expect(u).toBe("/uploads/avatar/a.gif");
        expect(u).not.toContain("format=webp");
        expect(u).not.toContain("w=200");
        expect(u).not.toContain("thumb");
    });

    it("GIF path 已有 crop 参数保留", () => {
        const u = avatarUrl("/uploads/avatar/a.gif?crop=0.1,0.2,0.5,0.5", "alice");
        expect(u).toContain("crop=0.1,0.2,0.5,0.5");
        expect(u).not.toContain("format=webp");
    });

    it("GIF 大写后缀也识别", () => {
        const u = avatarUrl("/uploads/avatar/a.GIF", "alice");
        expect(u).toBe("/uploads/avatar/a.GIF");
        expect(u).not.toContain("format=webp");
    });
});
