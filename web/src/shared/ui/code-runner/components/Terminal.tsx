/**
 * Terminal - xterm.js 终端封装（执行输出区）
 *
 * 懒加载 @xterm/xterm + @xterm/addon-fit（不进主 chunk）。
 * 暴露写入方法供 CodeRunner 调用，组件卸载时销毁实例。
 */

import type { FitAddon as FitAddonType } from "@xterm/addon-fit";
import * as fitAddonModule from "@xterm/addon-fit";
import type { Terminal as XTermType } from "@xterm/xterm";
import * as xtermModule from "@xterm/xterm";
import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";

/**
 * 兼顾 CJS 与 ESM interop 的类导出解析函数（防止 Vite ModuleRunner/SSR/Vitest/Dev 差异报错）
 */
function resolveClassExport<T>(mod: Record<string, unknown>, exportName: string): T {
    if (exportName in mod && typeof mod[exportName] === "function") {
        return mod[exportName] as T;
    }
    const defaultExp = mod.default;
    if (defaultExp && typeof defaultExp === "object" && exportName in defaultExp) {
        const target = (defaultExp as Record<string, unknown>)[exportName];
        if (typeof target === "function") {
            return target as T;
        }
    }
    if (typeof defaultExp === "function") {
        return defaultExp as T;
    }
    return mod[exportName] as T;
}

const XTerm = resolveClassExport<typeof XTermType>(
    xtermModule as unknown as Record<string, unknown>,
    "Terminal",
);
const FitAddon = resolveClassExport<typeof FitAddonType>(
    fitAddonModule as unknown as Record<string, unknown>,
    "FitAddon",
);
export interface TerminalHandle {
    /** 写 stdout 内容 */
    writeStdout: (data: string) => void;
    /** 写 stderr 内容（红色） */
    writeStderr: (data: string) => void;
    /** 写提示信息（灰色） */
    writeInfo: (data: string) => void;
    /** 清空终端 */
    clear: () => void;
    /** 重置终端（清空 + 重置光标） */
    reset: () => void;
}

export interface TerminalProps {
    /** 暴露终端句柄供父组件调用 */
    onReady?: (handle: TerminalHandle) => void;
    /** 终端销毁时的回调 */
    onUnmount?: () => void;
}

/**
 * Terminal 组件。
 *
 * mount 时创建 xterm 实例并 fit，unmount 时 dispose。
 * 配色固定 github-dark（与代码区一致）。
 */
export function Terminal({ onReady, onUnmount }: TerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTermType | null>(null);
    const fitRef = useRef<FitAddonType | null>(null);
    // mount 时创建 xterm 实例。依赖空数组——onReady 只在 mount 调一次
    // biome-ignore lint/correctness/useExhaustiveDependencies: 刻意只 mount 一次
    useEffect(() => {
        if (!containerRef.current) return;
        const term = new XTerm({
            convertEol: true,
            fontFamily: '"Maple Mono", ui-monospace, monospace',
            fontSize: 13,
            theme: {
                background: "#24292e",
                foreground: "#e1e4e8",
                cursor: "#c8c8c8",
                selectionBackground: "#444d56",
                black: "#24292e",
                red: "#f97583",
                green: "#85e89d",
                yellow: "#ffea7f",
                blue: "#79b8ff",
                magenta: "#b392f0",
                cyan: "#56d4dd",
                white: "#e1e4e8",
                brightBlack: "#959da5",
                brightRed: "#fdaeb7",
                brightGreen: "#bef2c1",
                brightYellow: "#fff5b1",
                brightBlue: "#c8e1ff",
                brightMagenta: "#d8bcff",
                brightCyan: "#b3f0ff",
                brightWhite: "#ffffff",
            },
            disableStdin: true, // 只读终端，不接收输入
            cursorBlink: false,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(containerRef.current);
        // 初始赋予保底尺寸（防止 0 尺寸容器导致 xterm 内部 _renderService.dimensions 为 undefined 抛错）
        try {
            term.resize(80, 24);
        } catch {
            /* 忽略 */
        }

        const safeFit = () => {
            try {
                if (
                    containerRef.current &&
                    containerRef.current.clientWidth > 0 &&
                    containerRef.current.clientHeight > 0
                ) {
                    fit.fit();
                } else {
                    term.resize(80, 24);
                }
            } catch {
                /* 容器未挂载/尺寸为零，忽略 */
            }
        };

        // 1. 立即 fit
        safeFit();

        // 2. 延迟一帧 fit（等待容器布局稳定）
        requestAnimationFrame(safeFit);

        // 3. 字体加载完成后重新 fit 与刷新（解决首次访问 WebFont 尚未加载导致的 xterm 字符尺寸测量错乱）
        if (typeof document !== "undefined" && document.fonts) {
            document.fonts.ready.then(safeFit).catch(() => {});
        }

        termRef.current = term;
        fitRef.current = fit;

        let disposed = false;

        // 暴露句柄。延迟到下一帧再调 onReady：
        // React StrictMode dev 下 useEffect 双调用（mount→cleanup→remount），
        // 若同步调用 onReady，第一次 mount 的回调会把已 dispose 的 xterm 句柄
        // 泄露给调用方（CodeRunner.handleRun），写入已销毁实例时触发
        // RenderService.dimensions → _renderer.value 为 undefined 抛 TypeError。
        // 延迟一帧 + cleanup 中 cancelAnimationFrame 可确保只有存活 mount 的
        // 句柄才到达调用方。
        const readyRafId = requestAnimationFrame(() => {
            if (disposed) return;
            onReady?.({
                writeStdout: (data) => {
                    if (!disposed) term.write(data);
                },
                writeStderr: (data) => {
                    if (!disposed) term.write(`\x1b[31m${data}\x1b[0m`);
                },
                writeInfo: (data) => {
                    if (!disposed) term.write(`\x1b[90m${data}\x1b[0m`);
                },
                clear: () => {
                    if (!disposed) term.clear();
                },
                reset: () => {
                    if (!disposed) term.reset();
                },
            });
        });

        // 容器尺寸变化时重新 fit
        const resizeObserver = new ResizeObserver(() => {
            try {
                fit.fit();
            } catch {
                /* 忽略 */
            }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            disposed = true;
            cancelAnimationFrame(readyRafId);
            resizeObserver.disconnect();
            term.dispose();
            termRef.current = null;
            fitRef.current = null;
            onUnmount?.();
        };
    }, []);

    return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />;
}
