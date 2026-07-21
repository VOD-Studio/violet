/**
 * 源码/富文本切换的「块级位置映射」工具。
 *
 * 为什么要块级映射：富文本里一张大图渲染 600px，源码里只有一行
 * `![](url)`；公式块同理。直接按像素/比例对齐会因为两边内容布局
 * 差异错位（图片越密集偏差越大）。建立「顶层块 ↔ Markdown 起始行号」
 * 映射，切换时对齐到块起点，误差压在一个块高度内（业界 Joplin /
 * VS Code split-pane 同款做法）。
 *
 * 本模块刻意拆成纯函数（不碰 DOM、不依赖 Editor 实例），方便单测。
 * DOM 比对（块视觉位置）由调用方算好后传入。
 */

/** 单个顶层块在两边的位置映射条目 */
export interface BlockLineEntry {
    /** 该块在 ProseMirror doc 中的起始 position */
    pmPos: number;
    /** 该块序列化后在整篇 Markdown 中占据的起始行号（0 基） */
    mdStartLine: number;
    /** 该块序列化后占据的结束行号（含，按 split('\n').length 累计） */
    mdEndLine: number;
}

/**
 * 按顶层块逐个序列化，累计每个块在整篇 Markdown 中的行号区间。
 *
 * **必须计入块间分隔符的换行**:整体 `editor.getMarkdown()` 在相邻
 * 顶层块之间插入 `\n\n`(1 个空行),逐块 `renderNodeToMarkdown` 只
 * 输出块内容本身不含尾随空行。若不加回分隔符换行,累计的行号会比
 * 实际 textarea 行号系统性偏小(实测 4 块文档偏差可达近一半),
 * 切换定位会落到比目标靠前的块上。
 *
 * 单块序列化结果与整体输出在 mark 跨界边界(list item / table cell
 * 内的粗体等)可能差几个字符,但对「定位到块」粒度足够。
 *
 * @param blocks 顶层块序列：`[pmPos, markdownString]` 配对
 * @param separator 块间分隔符,默认 `"\n\n"`(与 @tiptap/markdown 整体
 *                  输出一致);分隔符的换行数计入下一块的起始行号,
 *                  但不计入块自身的内容区间
 * @returns 行号映射表，顺序与输入一致
 */
export function buildBlockLineMap(
    blocks: ReadonlyArray<readonly [pmPos: number, markdown: string]>,
    separator = "\n\n",
): BlockLineEntry[] {
    // 分隔符对「下一块 startLine」的跨度贡献:
    // 整体 = A + sep + B,按 \n 切后 B.startLine = A.startLine + A_lines - 1 + 换行数。
    // 跨度 = A_lines + (换行数 - 1)。"\n\n" 含 2 个换行 → sepLines = 1(1 个空行)。
    const sepNewlines = (separator.match(/\n/g) ?? []).length;
    const sepLines = Math.max(0, sepNewlines - 1);
    // 先算出每块的内容行数和起始行号
    const starts: number[] = [];
    const contentLines: number[] = [];
    let acc = 0;
    for (let i = 0; i < blocks.length; i++) {
        starts.push(acc);
        const lines = blocks[i][1].split("\n").length;
        contentLines.push(lines);
        acc += lines + (i < blocks.length - 1 ? sepLines : 0);
    }
    // mdEndLine 扩展到「下一块起始行 - 1」(含尾随块间空行),让区间连续
    // 无空洞——textarea 停在空行时 findBlockByLine 二分能落到确定块上,
    // 而不是落回兜底的首块。空行视觉上靠下方块更近,但归到上一个块是
    // 保守选择(最多差一个块),且实现简单(区间连续)。
    const entries: BlockLineEntry[] = [];
    for (let i = 0; i < blocks.length; i++) {
        const start = starts[i];
        const contentEnd = start + contentLines[i] - 1;
        const ownedEnd = i < blocks.length - 1 ? starts[i + 1] - 1 : contentEnd;
        entries.push({
            pmPos: blocks[i][0],
            mdStartLine: start,
            mdEndLine: ownedEnd,
        });
    }
    return entries;
}

/**
 * 在映射表里二分找 `line` 落在哪个块，返回该块的 pmPos。
 *
 * @param line 行号（0 基），落在 `mdStartLine..mdEndLine` 区间即命中；
 *             超出最大块的 endLine 时返回最后一块（文档末尾对齐到底）
 * @returns pmPos；映射表为空返回 null
 */
export function findBlockByLine(map: ReadonlyArray<BlockLineEntry>, line: number): number | null {
    if (map.length === 0) return null;
    if (line < 0) return map[0].pmPos;
    if (line > map[map.length - 1].mdEndLine) return map[map.length - 1].pmPos;

    let lo = 0;
    let hi = map.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const entry = map[mid];
        if (line < entry.mdStartLine) {
            hi = mid - 1;
        } else if (line > entry.mdEndLine) {
            lo = mid + 1;
        } else {
            return entry.pmPos;
        }
    }
    // 理论不可达（上面已覆盖 line 全域），兜底返回首块
    return map[0].pmPos;
}

/**
 * 在「块视觉位置」序列里找第一个「底边越过视口顶部」的块。
 *
 * 即当前视口顶部可见的块——切换时应让对端滚动到这个块对应的位置。
 * 算法与 `useActiveHeading` 一致：以块的 `bottom` 与容器 `top` 比较。
 *
 * @param blockTops 每块的视觉位置：`[pmPos, rectBottom]`（rectBottom 为
 *                  块矩形相对视口的 bottom；调用方用
 *                  `nodeDOM(pos).getBoundingClientRect().bottom -
 *                  containerRect.top` 算）
 * @returns 当前可见块的 pmPos；序列为空返回 null
 */
export function findVisibleBlockPos(
    blockTops: ReadonlyArray<readonly [pmPos: number, rectBottom: number]>,
): number | null {
    if (blockTops.length === 0) return null;
    // 第一个 bottom > 0 的块；都不满足（视口在文档末尾之外）返回最后一块
    for (const [pmPos, rectBottom] of blockTops) {
        if (rectBottom > 0) return pmPos;
    }
    return blockTops[blockTops.length - 1][0];
}
