/**
 * 压缩包内部文件树展示
 *
 * 把扁平的条目列表按目录层级渲染为可折叠树。
 */

import { ChevronRight, File, Folder } from "lucide-react";
import { useState } from "react";
import type { ArchiveEntry } from "../types/archive-preview-types";
import { formatSize } from "../utils/format";

interface ArchiveTreeProps {
    entries: ArchiveEntry[];
}

/** 从条目列表构建目录树 */
function buildTree(entries: ArchiveEntry[]): TreeNode {
    const root: TreeNode = { name: "", path: "", children: {}, files: [] };
    for (const entry of entries) {
        const parts = entry.path.split("/").filter(Boolean);
        // 末尾为空（目录路径以 / 结尾）时去掉空段
        const isDir = entry.isDirectory;
        const dirParts = isDir ? parts : parts.slice(0, -1);
        const fileName = isDir ? "" : parts[parts.length - 1];

        let current = root;
        for (const part of dirParts) {
            current.children[part] = current.children[part] ?? {
                name: part,
                path: `${current.path}${part}/`,
                children: {},
                files: [],
            };
            current = current.children[part];
        }
        if (!isDir && fileName) {
            current.files.push(entry);
        }
    }
    return root;
}

interface TreeNode {
    name: string;
    path: string;
    children: Record<string, TreeNode>;
    files: ArchiveEntry[];
}

export function ArchiveTree({ entries }: ArchiveTreeProps) {
    const tree = buildTree(entries);

    return (
        <div className="py-1 text-sm">
            {/* 根目录下的文件 */}
            {tree.files.map((file) => (
                <FileRow key={file.path} entry={file} />
            ))}
            {/* 子目录 */}
            {Object.values(tree.children).map((node) => (
                <DirNode key={node.path} node={node} depth={0} />
            ))}
        </div>
    );
}

/** 目录节点（可折叠） */
function DirNode({ node, depth }: { node: TreeNode; depth: number }) {
    const [expanded, setExpanded] = useState(depth < 1);
    const childDirs = Object.values(node.children);
    const paddingLeft = depth * 16 + 8;

    return (
        <div>
            <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="flex w-full items-center gap-1 rounded px-2 py-1 text-left hover:bg-muted"
                style={{ paddingLeft }}
            >
                <ChevronRight
                    className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
                />
                <Folder className="size-3.5 shrink-0 fill-primary/20 text-primary" />
                <span className="truncate">{node.name}</span>
            </button>
            {expanded ? (
                <div>
                    {node.files.map((file) => (
                        <FileRow key={file.path} entry={file} depth={depth + 1} />
                    ))}
                    {childDirs.map((child) => (
                        <DirNode key={child.path} node={child} depth={depth + 1} />
                    ))}
                </div>
            ) : null}
        </div>
    );
}

/** 文件行 */
function FileRow({ entry, depth = 0 }: { entry: ArchiveEntry; depth?: number }) {
    const paddingLeft = depth * 16 + 24;
    return (
        <div
            className="flex items-center justify-between rounded px-2 py-1 hover:bg-muted"
            style={{ paddingLeft }}
            title={entry.path}
        >
            <span className="flex min-w-0 items-center gap-1">
                <File className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{entry.name}</span>
            </span>
            <span className="ml-2 shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatSize(entry.size)}
            </span>
        </div>
    );
}
