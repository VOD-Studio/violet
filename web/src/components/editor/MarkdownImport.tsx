// Markdown 文件导入组件
// 支持导入 .md 文件并转换为 HTML

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Upload } from "lucide-react";

/** Markdown 导入组件属性 */
interface MarkdownImportProps {
  /** 导入完成回调，返回转换后的 HTML */
  onImport: (html: string, filename: string) => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 简单的 Markdown 转 HTML 转换
 * 处理常用 Markdown 语法
 */
function markdownToHtml(md: string): string {
  let html = md;

  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
  });

  // 标题
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // 粗体和斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // 行内代码
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");

  // 链接和图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 引用
  html = html.replace(/^> (.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // 无序列表
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  // 水平线
  html = html.replace(/^---$/gm, "<hr />");

  // 段落（连续两个换行分隔）
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;

  // 清理空段落
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p>\s*(<h[1-6]>)/g, "$1");
  html = html.replace(/(<\/h[1-6]>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<blockquote>)/g, "$1");
  html = html.replace(/(<\/blockquote>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<hr\s*\/?>)/g, "$1");

  return html;
}

/**
 * Markdown 文件导入组件
 * 拖拽或选择 .md 文件后转换为 HTML 并回调
 */
export default function MarkdownImport({
  onImport,
  className = "",
}: MarkdownImportProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        if (!file.name.endsWith(".md") && !file.name.endsWith(".markdown")) {
          continue;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          const html = markdownToHtml(content);
          onImport(html, file.name);
        };
        reader.readAsText(file);
      }
    },
    [onImport],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/markdown": [".md", ".markdown"],
    },
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary hover:bg-muted/50"
      } ${className}`}
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <>
          <Upload className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">
            松开鼠标导入文件
          </span>
        </>
      ) : (
        <>
          <FileText className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            拖拽 .md 文件到此处，或点击选择文件导入
          </span>
        </>
      )}
    </div>
  );
}

export { markdownToHtml };
