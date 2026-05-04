import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PlaylistItem,
  PlaylistListResponse,
  MusicSettingsResponse,
} from "./types";

export function usePlaylists() {
  return useQuery({
    queryKey: ["admin", "playlists"],
    queryFn: () => api.get<PlaylistListResponse>("/admin/music/playlists"),
  });
}

export function useMusicSettings() {
  return useQuery({
    queryKey: ["admin", "music-settings"],
    queryFn: async () => {
      const res = await api.get<MusicSettingsResponse>("/music/settings");
      return res.settings;
    },
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) =>
      api.post<PlaylistItem>("/admin/music/playlists", { url }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

export function useUpdatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/admin/music/playlists/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

export function useUpdatePlayerVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: string) =>
      api.patch("/admin/music/settings", { player_version: version }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "music-settings"] });
      qc.invalidateQueries({ queryKey: ["music", "settings"] });
    },
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/admin/music/playlists/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

export function useCreateCustomPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) =>
      api.post<PlaylistItem>("/admin/music/playlists/custom", { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

export function useUploadSong(playlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("audio", file);
      return api.post<PlaylistItem>(
        `/admin/music/playlists/${playlistId}/songs`,
        formData,
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

export function useDeleteSong(playlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (songIndex: number) =>
      api.del<PlaylistItem>(`/admin/music/playlists/${playlistId}/songs/${songIndex}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}

export function useUpdateSong(playlistId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      index,
      data,
    }: {
      index: number;
      data: { title: string; artist: string; cover: string; lrc: string };
    }) =>
      api.patch<PlaylistItem>(
        `/admin/music/playlists/${playlistId}/songs/${index}`,
        data,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "playlists"] }),
  });
}
