import { useMe } from "@features/auth/api/queries";
import { AccountInfoSection } from "@features/profile/ui/AccountInfoSection";
import { AvatarSection } from "@features/profile/ui/AvatarSection";
import { PasswordSection } from "@features/profile/ui/PasswordSection";
import { ProfileInfoSection } from "@features/profile/ui/ProfileInfoSection";
import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * ProfilePage - 个人中心
 *
 * 功能模块：
 * 1. 头像上传（AvatarSection）
 * 2. 个人资料编辑（ProfileInfoSection）
 * 3. 账户信息展示（AccountInfoSection）
 * 4. 密码修改（PasswordSection）
 */
const ProfilePage = () => {
    const { data: user } = useMe();

    if (!user) {
        return null; // beforeLoad 已拦截未登录
    }

    return (
        <div className="container mx-auto max-w-4xl px-4 py-8">
            <h1 className="mb-8 text-3xl font-bold">个人中心</h1>

            <div className="space-y-6">
                <AvatarSection user={user} />
                <ProfileInfoSection user={user} />
                <AccountInfoSection user={user} />
                <PasswordSection />
            </div>
        </div>
    );
};

/**
 * /profile - 个人中心（需登录）
 *
 * beforeLoad 在 SSR 期间即可根据 context.auth 重定向到 /login，
 * 不必等客户端 hydrate 才发现未登录（避免闪烁/二次跳转）。
 */
export const Route = createFileRoute("/profile/")({
    beforeLoad: ({ context, location }) => {
        if (!context.auth.isAuthenticated) {
            throw redirect({
                to: "/login",
                search: { redirect: location.href },
                replace: true,
            });
        }
    },
    component: ProfilePage,
});
