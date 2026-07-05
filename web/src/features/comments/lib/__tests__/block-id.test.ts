/**
 * block-id 模块测试
 *
 * block_id 是选区批注锚点的「块标识符」，要求：
 *  - 跨调用一致（同一文本多次计算结果相同）
 *  - 跨同篇文章稳定（同 MD 源文 → 同 block_id）
 *  - 短（取前 8 位 hex）
 *
 * 实现用 SHA-256（crypto.subtle 原生支持）替代 PRD 原写的 SHA-1
 *（crypto.subtle 不支持 SHA-1）。SHA-256 取前 8 位 hex 同样满足稳定+短的需求。
 */
import { describe, expect, it } from "vitest";
import { computeBlockId } from "../block-id";

describe("computeBlockId", () => {
    it("同一文本多次计算结果一致", async () => {
        const text = "这是一段用于测试的文本内容。";
        const a = await computeBlockId(text);
        const b = await computeBlockId(text);
        expect(a).toBe(b);
    });

    it("返回 8 位 hex 字符串", async () => {
        const id = await computeBlockId("hello world");
        expect(id).toMatch(/^[0-9a-f]{8}$/);
    });

    it("不同文本产生不同 block_id", async () => {
        const a = await computeBlockId("第一段");
        const b = await computeBlockId("第二段");
        expect(a).not.toBe(b);
    });

    it("空文本返回固定哨兵（约定值，便于排查）", async () => {
        const id = await computeBlockId("");
        // 空块不应产生有效 block_id（否则空段会撞同一个 id）
        // 约定返回 null 表示「无法生成」
        expect(id).toBeNull();
    });

    it("纯空白文本（只有空格/换行）也视为空块", async () => {
        expect(await computeBlockId("   \n\t  ")).toBeNull();
    });
});
