/**
 * CodeRunner - 可运行代码块组件（阅读页）
 *
 * 跨 feature 展示组件（与 code-preview/ markdown-preview/ 平级）。
 * 布局：顶栏（语言标签 + Vim 切换 + 运行按钮）+ CodeMirror 代码区 + 折叠式终端区。
 *
 * 运行流程：点击运行 → useCodeRun 提交流式执行 → SSE stdout/stderr 实时写入终端 →
 * done 收尾显示 exit code/耗时/OOM/超时。
 *
 * 样式遵循 violet 约定：bg-[#24292e]、border-edge-hairline、rounded-lg、
 * Tailwind v4 canonical 类（4px 倍数裸数字）。
 */
import { ChevronDown, ChevronUp, Play, Terminal as TerminalIcon } from "lucide-react";
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Button } from "@/shared/ui/base/button";
import { useCodeRun } from "../hooks/useCodeRun";
import { useVimPreference } from "../hooks/useVimPreference";
import { CodeMirrorEditor } from "./CodeMirrorEditor";
import type { TerminalHandle } from "./Terminal";

// xterm.js 懒加载（不进主 chunk）
const Terminal = lazy(() => import("./Terminal").then((m) => ({ default: m.Terminal })));

export interface CodeRunnerProps {
	/** 语言（canonical key：python/node/go/rust/bun） */
	language: string;
	/** 初始源码 */
	source: string;
	/** overrides JSON（资源覆盖，可为空） */
	overridesJson?: string;
}

/**
 * CodeRunner 组件。
 *
 * 终端区默认折叠，运行后展开。
 */
export function CodeRunner({ language, source, overridesJson }: CodeRunnerProps) {
	const [code, setCode] = useState(source);
	const [terminalOpen, setTerminalOpen] = useState(false);
	const { vimEnabled, toggleVim } = useVimPreference();
	const { state, error, run } = useCodeRun();
	const termRef = useRef<TerminalHandle | null>(null);
	const readyResolversRef = useRef<Array<(handle: TerminalHandle) => void>>([]);

	const handleTerminalReady = useCallback((handle: TerminalHandle) => {
		termRef.current = handle;
		const resolvers = readyResolversRef.current;
		readyResolversRef.current = [];
		for (const resolve of resolvers) {
			resolve(handle);
		}
	}, []);

	const ensureTerminal = useCallback(async (): Promise<TerminalHandle> => {
		setTerminalOpen(true);
		if (termRef.current) {
			return termRef.current;
		}
		return new Promise<TerminalHandle>((resolve) => {
			readyResolversRef.current.push(resolve);
		});
	}, []);

	// 解析 overrides（作者声明的资源覆盖），失败降级为 undefined
	const overrides = (() => {
		if (!overridesJson) return undefined;
		try {
			return JSON.parse(overridesJson) as {
				timeout_secs?: number;
				memory_mb?: number;
				cpu_cores?: number;
				output_bytes?: number;
				allow_network?: boolean;
			};
		} catch {
			return undefined;
		}
	})();

	const isRunning = state === "running";

	const handleRun = async () => {
		const term = await ensureTerminal();
		term.reset();
		term.writeInfo("$ 运行中…\n");

		const execResult = await run(
			language,
			code,
			{
				onStdout: (data) => {
					term.writeStdout(data);
				},
				onStderr: (data) => {
					term.writeStderr(data);
				},
			},
			overrides,
		);

		// 收尾信息
		if (execResult) {
			const status = execResult.status;
			const exitInfo = execResult.exit_code != null ? `退出码 ${execResult.exit_code}` : "";
			const time = execResult.duration_ms > 0 ? `${execResult.duration_ms}ms` : "";
			const parts = [exitInfo, time].filter(Boolean).join(" · ");
			if (status === "success") {
				term.writeInfo(`\n✓ 完成${parts ? ` · ${parts}` : ""}\n`);
			} else if (status === "timeout") {
				term.writeStderr("\n✗ 执行超时\n");
			} else if (status === "oom_killed") {
				term.writeStderr("\n✗ 内存超限 (OOM)\n");
			} else if (status === "failed") {
				term.writeStderr(`\n✗ ${execResult.stderr || "系统暂时不可用"}\n`);
			} else if (status === "error") {
				term.writeInfo(`\n✗ 非零退出${parts ? ` · ${parts}` : ""}\n`);
			}
		}
		if (error) {
			term.writeStderr(`\n✗ ${error}\n`);
		}
	};

	return (
		<div className="my-6 overflow-hidden rounded-lg border border-edge-hairline bg-[#24292e]">
			{/* 顶栏：语言标签 + Vim 切换 + 运行按钮 */}
			<div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
				<span className="font-mono text-xs text-white/70">{language}</span>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={toggleVim}
						className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
							vimEnabled
								? "bg-white/15 text-white"
								: "text-white/50 hover:bg-white/10 hover:text-white/80"
						}`}
						title="切换 Vim 模式"
					>
						Vim
					</button>
					<Button
						type="button"
						size="xs"
						variant={isRunning ? "secondary" : "default"}
						onClick={handleRun}
						disabled={isRunning}
						className="gap-1"
					>
						<Play className="size-3" />
						{isRunning ? "运行中…" : "运行"}
					</Button>
				</div>
			</div>

			{/* 代码区：CodeMirror 可编辑 */}
			<div className="code-block-scrollbar max-h-96 overflow-auto">
				<CodeMirrorEditor
					value={code}
					language={language}
					vim={vimEnabled}
					onChange={setCode}
					onRunShortcut={handleRun}
				/>
			</div>

			{/* 终端区：折叠式 */}
			<div className="border-t border-white/10">
				<button
					type="button"
					onClick={() => setTerminalOpen((v) => !v)}
					className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white/80"
				>
					{terminalOpen ? (
						<ChevronDown className="size-3" />
					) : (
						<ChevronUp className="size-3" />
					)}
					<TerminalIcon className="size-3" />
					输出
				</button>
				{terminalOpen && (
					<div className="h-48 border-t border-white/10 px-3 py-2">
						<Suspense fallback={<div className="text-xs text-white/40">加载终端…</div>}>
							<Terminal
								onReady={handleTerminalReady}
								onUnmount={() => {
									termRef.current = null;
								}}
							/>
						</Suspense>
					</div>
				)}
			</div>
		</div>
	);
}
