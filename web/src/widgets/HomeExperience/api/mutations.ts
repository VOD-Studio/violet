import { authKeys } from "@features/auth/api/keys";
import { fetchCsrfToken } from "@features/auth/api/queries";
import { getCSRFToken } from "@shared/api/csrf";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { leaveSiteImpression } from "./client";
import { homeResourceKeys } from "./keys";

export function useLeaveSiteImpression() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			if (!getCSRFToken()) {
				await queryClient.fetchQuery({
					queryKey: authKeys.csrfToken(),
					queryFn: fetchCsrfToken,
					staleTime: 0,
				});
			}
			return leaveSiteImpression();
		},
		onSuccess: (state) => {
			queryClient.setQueryData(homeResourceKeys.siteImpression(), state);
		},
	});
}
