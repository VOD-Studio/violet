/**
 * 压缩包解析 Hook
 *
 * 使用 fflate 解压 ZIP 文件，列出内部条目（文件/目录）。
 * 非 ZIP 格式（rar/7z/tar.gz 等）标记为 unsupported（走占位）。
 */

import { unzipSync } from "fflate";
import { useCallback, useEffect, useState } from "react";
import type { ArchiveEntry, ArchiveLoadStatus } from "../types/archive-preview-types";

/** 是否为 fflate 可处理的 ZIP 类格式 */
function isZipFormat(name?: string, mimeType?: string): boolean {
    const n = (name ?? "").toLowerCase();
    const m = (mimeType ?? "").toLowerCase();
    if (m.includes("zip")) return true;
    return n.endsWith(".zip") || n.endsWith(".apk") || n.endsWith(".jar") || n.endsWith(".epub");
}

/** 路径最后一段作为文件名 */
function basename(path: string): string {
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? path;
}

interface UseArchiveOptions {
    url: string;
    name?: string;
    mimeType?: string;
}

export function useArchive({ url, name, mimeType }: UseArchiveOptions) {
    const [entries, setEntries] = useState<ArchiveEntry[]>([]);
    const [loadStatus, setLoadStatus] = useState<ArchiveLoadStatus>("loading");
    const [unsupported, setUnsupported] = useState(false);

    const parse = useCallback(async () => {
        // 非 ZIP 格式不支持前端解压
        if (!isZipFormat(name, mimeType)) {
            setUnsupported(true);
            setLoadStatus("error");
            return;
        }

        setLoadStatus("loading");
        setUnsupported(false);
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buffer = await res.arrayBuffer();
            const unzipped = unzipSync(new Uint8Array(buffer));

            const list: ArchiveEntry[] = Object.entries(unzipped).map(([path, data]) => {
                const isDirectory = path.endsWith("/");
                // data 可能是 Uint8Array，size 取字节长度
                const size = isDirectory ? 0 : (data as Uint8Array).length;
                return {
                    path,
                    name: basename(path),
                    size,
                    isDirectory,
                };
            });

            // 路径排序：目录优先，再按字母
            list.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                return a.path.localeCompare(b.path);
            });

            setEntries(list);
            setLoadStatus("ready");
        } catch {
            setLoadStatus("error");
        }
    }, [url, name, mimeType]);

    useEffect(() => {
        void parse();
    }, [parse]);

    const retry = useCallback(() => {
        void parse();
    }, [parse]);

    return { entries, loadStatus, unsupported, retry };
}
