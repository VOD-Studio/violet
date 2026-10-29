import usageExtension from "./runtime.mjs";

// OMP 18.12.1 ExtensionAPI 的最小结构子集。运行时仅依赖 Node 内置模块，
// 不要求消费方为了类型声明安装完整宿主 SDK。
interface UsageHost {
  pi: { VERSION: string };
  on(
    event: "session_start" | "message_end" | "session_shutdown",
    handler: (event: unknown, context: unknown) => void | Promise<void>,
  ): void;
}

export default function violetUsage(pi: UsageHost): void {
  usageExtension(pi);
}
