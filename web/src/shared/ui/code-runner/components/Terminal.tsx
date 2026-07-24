/**
 * Terminal - xterm.js 终端封装（执行输出区）
 *
 * 懒加载 @xterm/xterm + @xterm/addon-fit（不进主 chunk）。
 * 暴露写入方法供 CodeRunner 调用，组件卸载时销毁实例。
 */
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";

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
    const termRef = useRef<XTerm | null>(null);
    const fitRef = useRef<FitAddon | null>(null);

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
        // 延迟一帧 fit，确保容器尺寸已计算
        requestAnimationFrame(() => {
            try {
                fit.fit();
            } catch {
                /* 容器未挂载，忽略 */
            }
        });

        termRef.current = term;
        fitRef.current = fit;

        // 暴露句柄
        onReady?.({
            writeStdout: (data) => term.write(data),
            writeStderr: (data) => term.write(`\x1b[31m${data}\x1b[0m`), // ANSI 红色
            writeInfo: (data) => term.write(`\x1b[90m${data}\x1b[0m`), // ANSI 灰色
            clear: () => term.clear(),
            reset: () => term.reset(),
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
            resizeObserver.disconnect();
            term.dispose();
            termRef.current = null;
            fitRef.current = null;
            onUnmount?.();
        };
    }, []);

    return <div ref={containerRef} className="h-full w-full" />;
}
