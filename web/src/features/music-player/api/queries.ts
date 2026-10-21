import { musicKeys } from "@entities/music/api/keys";
import { getPublicMusicPlaylists } from "@features/music-player/api/client";
import { useQuery } from "@tanstack/react-query";

export const usePublicMusicPlaylists = () =>
	useQuery({
		queryKey: musicKeys.playlists(),
		queryFn: ({ signal }) => getPublicMusicPlaylists(signal),
		retry: false,
	});
