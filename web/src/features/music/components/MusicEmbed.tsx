// 音乐嵌入组件
// 支持网易云音乐和 QQ 音乐的 iframe 嵌入

import { useState, useEffect } from "react";
import { AlertCircle, Music } from "lucide-react";

/** 音乐嵌入组件属性 */
interface MusicEmbedProps {
  /** 音乐分享链接 */
  url: string;
  /** 自定义高度 */
  height?: number;
  /** 自定义类名 */
  className?: string;
}

/** 平台类型 */
type MusicPlatform = "netease" | "qq" | "unknown";

/**
 * 从 URL 识别音乐平台
 * @param url - 音乐分享链接
 * @returns 平台类型
 */
function detectPlatform(url: string): MusicPlatform {
  if (url.includes("music.163.com") || url.includes("y.music.163.com")) {
    return "netease";
  }
  if (
    url.includes("y.qq.com") ||
    url.includes("music.qq.com") ||
    url.includes("c6.y.qq.com")
  ) {
    return "qq";
  }
  return "unknown";
}

/**
 * 从网易云音乐链接中提取歌曲 ID
 * @param url - 网易云音乐链接
 * @returns 歌曲 ID 或 null
 */
function extractNeteaseId(url: string): string | null {
  // 标准链接格式: song?id=xxx
  const idMatch = url.match(/[?&]id=(\d+)/);
  if (idMatch) return idMatch[1];

  // 短链接格式: /song/xxx
  const pathMatch = url.match(/\/song\/(\d+)/);
  if (pathMatch) return pathMatch[1];

  return null;
}

/**
 * 从 QQ 音乐链接中提取歌曲 ID
 * @param url - QQ 音乐链接
 * @returns 歌曲 ID 或 null
 */
function extractQQId(url: string): string | null {
  // 标准格式: songDetail/xxx
  const idMatch = url.match(/songDetail\/(\w+)/);
  if (idMatch) return idMatch[1];

  // 查询参数格式: songmid=xxx
  const midMatch = url.match(/[?&]songmid=(\w+)/);
  if (midMatch) return midMatch[1];

  return null;
}

/**
 * 生成嵌入 iframe 的 src 地址
 * @param platform - 音乐平台
 * @param url - 原始链接
 * @param songId - 歌曲 ID
 * @returns iframe src 地址
 */
function getEmbedSrc(
  platform: MusicPlatform,
  url: string,
  songId: string
): string {
  switch (platform) {
    case "netease":
      return `https://music.163.com/outchain/player?type=2&id=${songId}&auto=0&height=66`;
    case "qq":
      return `https://y.qq.com/ryqq/player?songmid=${songId}&type=0`;
    default:
      return url;
  }
}

/**
 * 音乐嵌入组件
 * 自动识别网易云音乐和 QQ 音乐链接，使用 iframe 嵌入播放器
 */
export default function MusicEmbed({
  url,
  height = 86,
  className = "",
}: MusicEmbedProps) {
  const [error, setError] = useState<string | null>(null);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setError("请输入音乐链接");
      return;
    }

    const platform = detectPlatform(url);

    if (platform === "unknown") {
      setError("不支持的音乐平台，请使用网易云音乐或 QQ 音乐链接");
      return;
    }

    let songId: string | null = null;
    if (platform === "netease") {
      songId = extractNeteaseId(url);
    } else if (platform === "qq") {
      songId = extractQQId(url);
    }

    if (!songId) {
      setError("无法从链接中提取歌曲信息，请检查链接格式");
      return;
    }

    setError(null);
    setEmbedSrc(getEmbedSrc(platform, url, songId));
  }, [url]);

  if (error) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive ${className}`}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!embedSrc) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground ${className}`}
      >
        <Music className="h-4 w-4" />
        <span>正在加载播放器...</span>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-lg border ${className}`}>
      <iframe
        src={embedSrc}
        width="100%"
        height={height}
        frameBorder="no"
        allow="autoplay"
        loading="lazy"
        title="音乐播放器"
        className="block"
      />
    </div>
  );
}
