/**
 * serializeSvg / svgToPngBlob 测试（T1 导出纯函数）
 *
 * 验证序列化正确性（XML 声明 + 命名空间）与 PNG 转换（canvas 调用、taint 安全）。
 * 不测 PNG 像素级正确性（PRD Testing Decisions）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob, parseViewBoxSize, serializeSvg, svgToPngBlob } from "../export";

describe("serializeSvg", () => {
    it("注入 XML 声明与 SVG 命名空间（缺失时补全）", () => {
        const result = serializeSvg("<svg><rect/></svg>");
        expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(result).toContain("<rect/>");
    });

    it("已有 xmlns 时不重复注入", () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
        const result = serializeSvg(svg);
        const xmlnsCount = (result.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g) ?? []).length;
        expect(xmlnsCount).toBe(1);
    });

    it("保留已有属性（viewBox、width、height）", () => {
        const svg = '<svg viewBox="0 0 400 300" width="400" height="300"><rect/></svg>';
        const result = serializeSvg(svg);
        expect(result).toContain('viewBox="0 0 400 300"');
        expect(result).toContain('width="400"');
    });
});

describe("parseViewBoxSize", () => {
    it("从 viewBox 提取宽高", () => {
        expect(parseViewBoxSize('<svg viewBox="0 0 640 480">')).toEqual({
            width: 640,
            height: 480,
        });
    });

    it("从 width/height 属性提取", () => {
        expect(parseViewBoxSize('<svg width="200" height="100">')).toEqual({
            width: 200,
            height: 100,
        });
    });

    it("无尺寸信息时降级默认值", () => {
        expect(parseViewBoxSize("<svg>")).toEqual({ width: 400, height: 300 });
    });

    it("viewBox 优先于 width/height", () => {
        expect(parseViewBoxSize('<svg viewBox="0 0 800 600" width="200" height="100">')).toEqual({
            width: 800,
            height: 600,
        });
    });
});

describe("svgToPngBlob", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("用 Image + canvas 路径转换，blob URL 不 taint canvas", async () => {
        // mock Image：设置 src 后微任务触发 onload（模拟浏览器解码完成）
        class MockImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            private _src = "";
            get src() {
                return this._src;
            }
            set src(val: string) {
                this._src = val;
                // blob URL 验证（不 taint canvas）
                expect(val.startsWith("blob:")).toBe(true);
                // 异步触发 onload
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal("Image", MockImage);
        vi.stubGlobal("URL", {
            ...URL,
            createObjectURL: vi.fn().mockReturnValue("blob:mock-url"),
            revokeObjectURL: vi.fn(),
        });
        const mockDrawImage = vi.fn();
        const mockCanvas = {
            width: 0,
            height: 0,
            getContext: () => ({ drawImage: mockDrawImage }),
            toBlob: (cb: BlobCallback) => cb(new Blob([], { type: "image/png" })),
        };
        vi.spyOn(document, "createElement").mockReturnValue(
            mockCanvas as unknown as HTMLCanvasElement,
        );

        const svg = '<svg viewBox="0 0 200 100"><rect/></svg>';
        const blob = await svgToPngBlob(svg);

        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe("image/png");
        expect(mockDrawImage).toHaveBeenCalled();
    });

    it("Image.onerror 时 reject", async () => {
        class MockImage {
            onerror: (() => void) | null = null;
            onload: (() => void) | null = null;
            private _src = "";
            get src() {
                return this._src;
            }
            set src(val: string) {
                this._src = val;
                queueMicrotask(() => this.onerror?.());
            }
        }
        vi.stubGlobal("Image", MockImage);
        vi.stubGlobal("URL", {
            ...URL,
            createObjectURL: vi.fn().mockReturnValue("blob:mock-url"),
            revokeObjectURL: vi.fn(),
        });

        const svg = "<svg><rect/></svg>";
        const promise = svgToPngBlob(svg);

        await expect(promise).rejects.toThrow();
    });
});

describe("downloadBlob", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = "";
    });

    it("创建 <a download> 并触发点击后立即移除", () => {
        const url = "blob:mock-download";
        vi.stubGlobal("URL", {
            ...URL,
            createObjectURL: vi.fn().mockReturnValue(url),
            revokeObjectURL: vi.fn(),
        });

        const blob = new Blob(["test"], { type: "image/svg+xml" });
        const clickSpy = vi.fn();
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickSpy);

        downloadBlob(blob, "diagram.svg");

        // click 已触发（downloadBlob 在 click 后立即 removeChild）
        expect(clickSpy).toHaveBeenCalledOnce();
        // createObjectURL 被调用并最终 revoke
        expect(vi.mocked(URL.createObjectURL)).toHaveBeenCalledWith(blob);
        expect(vi.mocked(URL.revokeObjectURL)).toHaveBeenCalled();
    });
});
