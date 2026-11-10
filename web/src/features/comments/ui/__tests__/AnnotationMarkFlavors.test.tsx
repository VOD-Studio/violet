import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeBlockId } from "../../lib/block-id";
import type { BlockRange } from "../../model/types";
import { AnnotationLayer } from "../AnnotationLayer";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiGetPaged: vi.fn(),
	apiPost: vi.fn(),
	apiPatch: vi.fn(),
	apiDelete: vi.fn(),
}));

const paragraph = "同一段文字可以承载多位读者的独立讨论。";
let blockId = "";
let client: QueryClient;

function Harness({ ranges }: { ranges: BlockRange[] }) {
	const contentRef = useRef<HTMLDivElement>(null);
	return (
		<>
			<div ref={contentRef}>
				<p>{paragraph}</p>
			</div>
			<AnnotationLayer
				contentRef={contentRef}
				summary={[{ block_id: blockId, count: ranges.length, ranges }]}
				postId="post-1"
				isLoggedIn
			/>
		</>
	);
}

const range = (start: number, end: number, extra: Partial<BlockRange> = {}): BlockRange => ({
	start,
	end,
	is_ai: false,
	author_name: "读者",
	...extra,
});

beforeEach(async () => {
	blockId = (await computeBlockId(paragraph)) ?? "";
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => client.clear());

describe("划线按署名分色", () => {
	it("AI 署名的划线按角色着色；站长的划线单独标记；普通读者的两者都没有", async () => {
		render(
			<QueryClientProvider client={client}>
				<Harness
					ranges={[
						range(0, 4, { is_ai: true, author_name: "GPT" }),
						range(7, 9, { author_name: "站长", is_author: true }),
						range(10, 12),
					]}
				/>
			</QueryClientProvider>,
		);
		const ai = await screen.findByRole("button", { name: "1 条批注：同一段文" });
		const owner = screen.getByRole("button", { name: "1 条批注：承载" });
		const reader = screen.getByRole("button", { name: "1 条批注：位读" });
		expect(ai.dataset.ai).toBe("true");
		expect(ai.dataset.aiPersona).toBe("gpt");
		expect(ai.dataset.author).toBeUndefined();
		expect(owner.dataset.author).toBe("true");
		expect(owner.dataset.ai).toBeUndefined();
		expect(reader.dataset.ai).toBeUndefined();
		expect(reader.dataset.author).toBeUndefined();
	});

	it("同一处划线既有 AI 又有读者时按读者着色，只有全部是 AI 才按角色着色", async () => {
		render(
			<QueryClientProvider client={client}>
				<Harness
					ranges={[
						range(0, 4, { is_ai: true, author_name: "GPT" }),
						range(0, 4),
						range(7, 9, { is_ai: true, author_name: "Claude" }),
						range(7, 9, { is_ai: true, author_name: "GPT" }),
					]}
				/>
			</QueryClientProvider>,
		);
		const mixed = await screen.findByRole("button", { name: "2 条批注：同一段文" });
		const allAi = screen.getByRole("button", { name: "2 条批注：承载" });
		expect(mixed.dataset.ai).toBeUndefined();
		expect(allAi.dataset.ai).toBe("true");
		expect(allAi.dataset.aiPersona).toBe("claude");
	});
});
