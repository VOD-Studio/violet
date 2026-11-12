import { useCodeRun } from "@entities/code-runner/hooks/useCodeRun";
import { useCodeRunnerAvailability } from "@entities/code-runner/hooks/useCodeRunnerAvailability";
import { useVimPreference } from "@entities/code-runner/hooks/useVimPreference";
import type { ResourceLimits } from "@entities/code-runner/model/types";
import type { RunnableCodeProps } from "@shared/ui/markdown-preview/code-renderer-context";
import { CodeBlock, type CodeBlockAvailability, type CodeBlockOutputChunk } from "@violet/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { toCodeBlockRunResult } from "./code-run-result";

function parseOverrides(json?: string): ResourceLimits | undefined {
	try {
		return json ? JSON.parse(json) : undefined;
	} catch {
		return undefined;
	}
}

export function CodeRunner({
	language,
	source,
	overridesJson,
	filename,
	highlightedLines,
}: RunnableCodeProps) {
	const [output, setOutput] = useState<CodeBlockOutputChunk[]>([]);
	const original = useRef({ language, source });
	const { vimEnabled, setVimEnabled } = useVimPreference();
	const { state, result, error, run, reset } = useCodeRun();
	const policy = useCodeRunnerAvailability(language);
	const overrides = useMemo(() => parseOverrides(overridesJson), [overridesJson]);
	const running = state === "running";
	const availability: CodeBlockAvailability =
		policy.policyStatus === "error"
			? {
					status: "error",
					message: policy.error?.message ?? "无法读取运行器策略，请重试。",
					onRetry: () => void policy.refetch(),
				}
			: { status: policy.policyStatus };

	useEffect(() => {
		if (original.current.language === language && original.current.source === source) return;
		original.current = { language, source };
		reset();
		setOutput([]);
	}, [language, source, reset]);

	function handleRun(code: string) {
		if (!policy.allowed || running) return;
		setOutput([{ kind: "info", text: "运行中…\n" }]);
		void run(
			policy.canonical,
			code,
			{
				onStdout: (text) => setOutput((chunks) => [...chunks, { kind: "stdout", text }]),
				onStderr: (text) => setOutput((chunks) => [...chunks, { kind: "stderr", text }]),
			},
			overrides,
		);
	}

	return (
		<CodeBlock
			code={source}
			language={language}
			filename={filename}
			highlightedLines={highlightedLines}
			vimEnabled={vimEnabled}
			onVimEnabledChange={setVimEnabled}
			run={{
				availability,
				running,
				onRun: handleRun,
				output,
				result: toCodeBlockRunResult(result, error),
			}}
			className="my-6"
			data-runnable="true"
			data-source={source}
			data-lang={language}
		/>
	);
}
