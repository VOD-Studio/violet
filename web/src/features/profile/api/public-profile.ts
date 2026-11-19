import { userKeys } from "@entities/user/api/keys";
import { apiGet, apiGetPaged } from "@shared/api/request";
import { queryOptions } from "@tanstack/react-query";
import type { ProfileTab, PublicActivity, PublicProfile } from "../model/public-profile";

export const publicProfileOptions = (username: string) =>
	queryOptions({
		queryKey: userKeys.profile(username),
		queryFn: ({ signal }) =>
			apiGet<PublicProfile>(`/users/${encodeURIComponent(username)}`, { signal }),
	});

export const publicActivityOptions = (username: string, tab: ProfileTab, cursor?: string) =>
	queryOptions({
		queryKey: ["public-profile-activity", username, tab, cursor ?? ""],
		queryFn: ({ signal }) =>
			apiGetPaged<PublicActivity>(`/users/${encodeURIComponent(username)}/activity`, {
				params: { tab, cursor, limit: 20 },
				signal,
			}),
	});
