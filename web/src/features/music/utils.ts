/**
 * 音乐功能工具函数
 */

import { getUploadUrl } from "@/lib/api";
import type { SongData, Song } from "./hooks/usePlyrPlayer";

/**
 * 将后端歌曲数据转换为播放器格式
 * 过滤掉没有 URL 的歌曲，处理封面和歌词 URL
 */
export function toPlayerSongs(songs: SongData[]): Song[] {
  return songs
    .filter((s) => s.url)
    .map((s) => ({
      id: s.id,
      name: s.title || "未知歌曲",
      artist: s.artist || "未知艺术家",
      url: s.url.startsWith("/") ? getUploadUrl(s.url) : s.url,
      cover: s.cover ? getUploadUrl(s.cover) : s.cover,
      lrc: s.lrc as string | undefined,
    }));
}

/**
 * 格式化时间（秒 -> mm:ss）
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 解析 LRC 歌词格式
 * @param lrcText LRC 格式的歌词文本
 * @returns 解析后的歌词行数组 [{time: number, text: string}]
 */
export function parseLRC(lrcText: string): Array<{ time: number; text: string }> {
  if (!lrcText) return [];

  const lines = lrcText.split("\n");
  const result: Array<{ time: number; text: string }> = [];

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3].padEnd(3, "0"), 10);
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();
      result.push({ time, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}
