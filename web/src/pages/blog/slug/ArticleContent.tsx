// 文章内容渲染组件
// 解析 HTML 内容，在沙盒标记位置嵌入 CodeSandbox

import { useMemo } from "react";
import { CodeSandbox } from "@/components/blog/CodeSandbox";
import { parseContentWithSandboxes, SANDBOX_PRESETS } from "./utils";

interface ArticleContentProps {
  /** HTML 内容 */
  html: string;
}

/**
 * 给 HTML 中的标题添加唯一 ID（用于目录导航）
 */
function addHeadingIds(
  html: string,
  startIndex: number,
): { html: string; count: number } {
  let count = 0;
  const result = html.replace(/<h([2-4])([^>]*)>/gi, (match, level, attrs) => {
    // 如果已有 id，保留原 id
    if (/id\s*=\s*['"]/.test(attrs)) return match;
    const id = `toc-heading-${startIndex + count}-h${level}`;
    count++;
    return `<h${level} id="${id}"${attrs}>`;
  });
  return { html: result, count };
}

/**
 * 文章内容渲染组件
 */
export function ArticleContent({ html }: ArticleContentProps) {
  // 在渲染前给所有 HTML 部分的标题添加 ID，确保目录导航能正常工作
  const partsWithIds = useMemo(() => {
    const parsed = parseContentWithSandboxes(html);

    const { parts } = parsed.reduce(
      (acc, part) => {
        if (part.type === "html") {
          const { html: htmlWithIds, count } = addHeadingIds(
            part.content,
            acc.index,
          );
          acc.parts.push({ ...part, content: htmlWithIds });
          acc.index += count;
        } else {
          acc.parts.push(part);
        }
        return acc;
      },
      { parts: [] as typeof parsed, index: 0 },
    );

    return parts;
  }, [html]);

  return (
    <>
      {partsWithIds.map((part, index) => {
        if (part.type === "html") {
          return (
            <div
              key={`html-${index}`}
              className="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20"
              dangerouslySetInnerHTML={{ __html: part.content }}
            />
          );
        }

        const preset = SANDBOX_PRESETS[part.id];
        if (!preset) {
          return (
            <div
              key={`sandbox-${index}`}
              className="my-6 rounded-xl border border-dashed p-6 text-center text-muted-foreground"
            >
              未找到沙盒配置: {part.id}
            </div>
          );
        }

        return (
          <div key={`sandbox-${index}`} className="my-6">
            {preset.description && (
              <p className="mb-2 text-sm text-muted-foreground">
                {preset.description}
              </p>
            )}
            <CodeSandbox files={preset.files} height={400} />
          </div>
        );
      })}
    </>
  );
}
