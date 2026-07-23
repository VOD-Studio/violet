/**
 * codeRunKeys - 代码执行 query key 工厂
 *
 * 流式执行结果一般不进 Query 缓存（SSE 实时消费），key 主要用于
 * 轮询路径的任务查询与缓存失效。
 */
export const codeRunKeys = {
    /** 代码执行模块根 key */
    all: ["code-run"] as const,
    /** 单个任务维度 */
    tasks: () => [...codeRunKeys.all, "task"] as const,
    /** 具体任务（轮询查询） */
    task: (id: string) => [...codeRunKeys.tasks(), id] as const,
};
