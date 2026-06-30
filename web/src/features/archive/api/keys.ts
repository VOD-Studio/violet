/** archiveKeys - 归档 query key 工厂 */
export const archiveKeys = {
    /** 模块根 */
    all: ["archive"] as const,
    /** 年份索引 */
    years: () => [...archiveKeys.all, "years"] as const,
    /** 指定年份 */
    year: (year: number) => [...archiveKeys.all, "year", year] as const,
};
