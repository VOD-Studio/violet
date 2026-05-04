/**
 * 音乐页面
 * 支持导入网易云/QQ音乐歌单并播放
 */

import { useState } from "react";
import { api } from "@/lib/api";
import {
  MusicPlayerLegacy as MusicPlayer,
  SongList,
  type PlaylistInfo,
} from "@/features/music";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Link, Music } from "lucide-react";
import { toast } from "sonner";

export default function MusicPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  async function handleImport() {
    if (!url.trim()) {
      toast.error("请输入歌单链接");
      return;
    }

    setLoading(true);
    try {
      const res = await api.get<PlaylistInfo>("/music/playlist", {
        url: url.trim(),
      });
      setPlaylist(res);
      setCurrentIndex(0);
      toast.success(`成功导入 ${res.count} 首歌`);
    } catch (err) {
      toast.error("获取歌单失败，请检查链接格式");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectSong(index: number) {
    setCurrentIndex(index);
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-8">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold">音乐播放器</h1>
          <p className="text-muted-foreground mt-2">
            导入网易云音乐或 QQ 音乐歌单，在线播放
          </p>
        </div>

        {/* 歌单导入 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="size-5" />
              导入歌单
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="粘贴歌单链接，如 music.163.com/playlist?id=xxx"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleImport} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "导入"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              支持：网易云音乐歌单、QQ音乐歌单
            </p>
          </CardContent>
        </Card>

        {/* 歌单信息 */}
        {playlist && (
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-6">
                {/* 歌单封面 */}
                <img
                  src={playlist.cover}
                  alt={playlist.title}
                  className="size-32 rounded-lg object-cover shadow"
                />
                {/* 歌单信息 */}
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{playlist.title}</h2>
                  <p className="text-muted-foreground mt-1">
                    {playlist.creator} · {playlist.count} 首
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    来源：
                    {playlist.platform === "netease" ? "网易云音乐" : "QQ音乐"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 播放器和歌曲列表 */}
        {playlist && playlist.songs.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 播放器 */}
            <MusicPlayer playlist={playlist.songs} className="sticky top-4" />

            {/* 歌曲列表 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="size-5" />
                  播放列表
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SongList
                  songs={playlist.songs}
                  currentIndex={currentIndex}
                  onSelect={handleSelectSong}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* 空状态 */}
        {!playlist && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Music className="size-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">导入歌单开始播放</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
