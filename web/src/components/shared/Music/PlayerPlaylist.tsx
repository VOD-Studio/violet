/**
 * 播放列表组件
 * 显示歌曲列表和歌词，支持切换视图
 */

import { useEffect, useRef } from "react";
import { Music } from "lucide-react";
import { MarqueeText } from "./MarqueeText";
import type { Song } from "./usePlyrPlayer";

/** 歌词行 */
interface LyricLine {
  time: number;
  text: string;
}

/** 解析 LRC 格式歌词 */
function parseLRC(lrc?: string): LyricLine[] {
  if (!lrc) return [];
  const lines = lrc.split("\n");
  const result: LyricLine[] = [];
  for (const line of lines) {
    const match = line.match(/\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, "0"));
      result.push({
        time: minutes * 60 + seconds + ms / 1000,
        text: match[4].trim(),
      });
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

/** 根据 currentTime 找到当前歌词行索引 */
function findCurrentLyricIndex(lyrics: LyricLine[], time: number): number {
  if (lyrics.length === 0) return -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (time >= lyrics[i].time) return i;
  }
  return -1;
}

interface PlayerPlaylistProps {
  songs: Song[];
  currentSongIndex: number;
  isPlaying: boolean;
  panelView: "list" | "lyrics";
  lyricsText: string;
  currentTime: number;
  expanded: boolean;
  onSongClick: (index: number) => void;
  onPanelViewChange: (view: "list" | "lyrics") => void;
}

export function PlayerPlaylist({
  songs,
  currentSongIndex,
  isPlaying,
  panelView,
  lyricsText,
  currentTime,
  expanded,
  onSongClick,
  onPanelViewChange,
}: PlayerPlaylistProps) {
  const songListRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  const lyrics = parseLRC(lyricsText);
  const currentLyricIndex = findCurrentLyricIndex(lyrics, currentTime);

  // 歌曲列表自动滚动到当前播放项
  useEffect(() => {
    if (!expanded || panelView !== "list") return;
    const el = songListRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentSongIndex, expanded, panelView]);

  // 歌词自动滚动到当前行
  useEffect(() => {
    if (panelView !== "lyrics") return;
    const container = lyricsContainerRef.current;
    if (!container) return;
    const active = container.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentLyricIndex, panelView]);

  return (
    <>
      {/* 标签栏 */}
      <div className="flex gap-1 px-3 pb-2 shrink-0">
        <button
          onClick={() => onPanelViewChange("list")}
          className={`flex-1 rounded-lg py-1.5 text-center text-xs transition-all ${
            panelView === "list"
              ? "bg-foreground text-background font-medium"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          列表 {songs.length}
        </button>
        <button
          onClick={() => onPanelViewChange("lyrics")}
          className={`flex-1 rounded-lg py-1.5 text-center text-xs transition-all ${
            panelView === "lyrics"
              ? "bg-foreground text-background font-medium"
              : "text-muted-foreground hover:bg-muted/50"
          }`}
        >
          歌词
        </button>
      </div>

      {/* 可滚动内容区 */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {panelView === "list" ? (
          <div ref={songListRef} className="px-2 pb-2 space-y-0.5">
            {songs.map((song, index) => (
              <button
                key={song.id}
                data-active={index === currentSongIndex || undefined}
                onClick={() => onSongClick(index)}
                className={`group w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                  index === currentSongIndex
                    ? "bg-primary/10"
                    : "hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative size-8 shrink-0 overflow-hidden rounded">
                    {song.cover ? (
                      <img
                        src={song.cover}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <Music className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    {index === currentSongIndex && isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="flex items-end gap-0.5 h-3">
                          <span className="w-0.5 bg-white animate-[music-bar_0.4s_ease-in-out_infinite_alternate]" />
                          <span className="w-0.5 bg-white animate-[music-bar_0.4s_ease-in-out_infinite_alternate_0.2s]" />
                          <span className="w-0.5 bg-white animate-[music-bar_0.4s_ease-in-out_infinite_alternate_0.4s]" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <MarqueeText
                      className={`text-sm leading-tight ${
                        index === currentSongIndex
                          ? "font-medium text-primary"
                          : ""
                      }`}
                    >
                      {song.name}
                    </MarqueeText>
                    <MarqueeText className="text-[10px] text-muted-foreground mt-0.5">
                      {song.artist}
                    </MarqueeText>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div ref={lyricsContainerRef} className="py-3">
            {lyrics.length > 0 ? (
              lyrics.map((line, index) => {
                const distance = Math.abs(index - currentLyricIndex);
                return (
                  <p
                    key={index}
                    data-active={index === currentLyricIndex || undefined}
                    className={`px-5 py-1.5 text-center transition-all duration-300 ${
                      index === currentLyricIndex
                        ? "text-base font-semibold text-foreground"
                        : distance <= 2
                          ? "text-sm text-muted-foreground/70"
                          : "text-xs text-muted-foreground/40"
                    }`}
                  >
                    {line.text}
                  </p>
                );
              })
            ) : (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                暂无歌词
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
