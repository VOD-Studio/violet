import type { CodeBlockOutputChunk, CodeBlockRunResult } from "@violet/ui";

export const SOURCE = `# 斐波那契：每一项是前两项之和
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print([fib(i) for i in range(10)])`;

export const LONG_SOURCE = `package memory

// Roll 把最早的一段对话压缩成一条摘要，摘要再进入长期记忆。
func (s *Summary) Roll(ctx context.Context, msgs []Message) error {
\tif len(msgs) < rollEvery {
\t\treturn nil
\t}
\tdigest, err := s.llm.Summarize(ctx, msgs[:rollEvery])
\tif err != nil {
\t\treturn fmt.Errorf("summarize: %w", err)
\t}
\ts.metrics.Rolled.Add(1)
\treturn s.store.Append(ctx, digest)
}

func (s *Summary) Recall(ctx context.Context, q string, k int) ([]Digest, error) {
\thits, err := s.store.Search(ctx, q, k)
\tif err != nil {
\t\treturn nil, err
\t}
\tsort.Slice(hits, func(i, j int) bool { return hits[i].Score > hits[j].Score })
\treturn hits, nil
}`;

export const FIBONACCI_OUTPUT = "[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\n";

export const results: Record<string, CodeBlockRunResult> = {
	success: { status: "success", exitCode: 0, durationMs: 38 },
	"nonzero-exit": { status: "error", exitCode: 1, durationMs: 41 },
	timeout: { status: "timeout" },
	oom: { status: "oom_killed" },
};

export function initialOutput(state: string): CodeBlockOutputChunk[] {
	if (state !== "running" && !results[state]) {
		return [];
	}
	const output: CodeBlockOutputChunk[] = [{ kind: "info", text: "$ 运行中…\n" }];
	if (state === "success") {
		output.push({ kind: "stdout", text: FIBONACCI_OUTPUT });
	} else if (state === "nonzero-exit") {
		output.push({
			kind: "stderr",
			text: "Traceback (most recent call last):\n  File \"main.py\", line 8, in <module>\nTypeError: 'int' object is not iterable\n",
		});
	}
	return output;
}

/** 行号从 1 开始，列值是当前行内从 0 开始的偏移。 */
export function editorPosition(state: string) {
	if (state === "visual") {
		return { line: 5, column: 15 };
	}
	if (state === "insert" || state === "vim-off") {
		return { line: 4, column: 19 };
	}
	return { line: 3, column: 4 };
}
