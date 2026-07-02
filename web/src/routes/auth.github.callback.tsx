import { authKeys } from "@features/auth/api/keys";
import { useGithubLoginMutation } from "@features/auth/api/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
    code: z.string().optional(),
});

export const Route = createFileRoute("/auth/github/callback")({
    validateSearch: searchSchema,
    component: GithubCallbackPage,
});

function GithubCallbackPage() {
    const { code } = useSearch({ from: "/auth/github/callback" });
    const githubLogin = useGithubLoginMutation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!code) {
            toast.error("未获取到授权码");
            navigate({ to: "/login", replace: true });
            return;
        }

        githubLogin.mutate(code, {
            onSuccess: async () => {
                toast.success("登录成功");
                try {
                    await queryClient.refetchQueries({ queryKey: authKeys.me() });
                } catch {
                    // ignore
                }
                navigate({ to: "/", replace: true });
            },
            onError: () => {
                toast.error("GitHub 登录失败");
                navigate({ to: "/login", replace: true });
            },
        });
    }, [code, githubLogin.mutate, navigate, queryClient]);

    return (
        <div className="flex h-screen w-screen items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">正在处理 GitHub 登录...</p>
            </div>
        </div>
    );
}
