import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
    AboutSettingsDTO,
    AuthSettingsDTO,
    CodeRunnerSettingsDTO,
    GeneralSettingsDTO,
    GithubSettingsDTO,
    LlmSettingsDTO,
    ProfileSettingsDTO,
} from "../model/types";
import * as api from "./client";
import { settingsKeys } from "./keys";

/**
 * admin-settings 分组 hooks —— 7 组独立 query/mutation。
 *
 * 每组 useXxx 读 GET /admin/settings/{group}，useUpdateXxx 调 PUT 同路径。
 * mutation 成功用返回的最新配置直接覆盖本组缓存（setQueryData），避免二次请求；
 * 因 queryKey 各组独立，不会互相覆盖，消除回填竞态。
 */

// ---- 基础信息组 ----
export const useGeneralSettings = () =>
    useQuery({ queryKey: settingsKeys.general(), queryFn: api.getGeneral });
export const useUpdateGeneral = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: Partial<GeneralSettingsDTO>) => api.updateGeneral(body),
        onSuccess: (data) => {
            qc.setQueryData(settingsKeys.general(), data);
            toast.success("站点设置已保存");
        },
        onError: (e: Error) => toast.error(`保存失败：${e.message}`),
    });
};

// ---- 认证组 ----
export const useAuthSettings = () =>
    useQuery({ queryKey: settingsKeys.auth(), queryFn: api.getAuth });
export const useUpdateAuth = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: Partial<AuthSettingsDTO>) => api.updateAuth(body),
        onSuccess: (data) => {
            qc.setQueryData(settingsKeys.auth(), data);
            toast.success("站点设置已保存");
        },
        onError: (e: Error) => toast.error(`保存失败：${e.message}`),
    });
};

// ---- GitHub 组 ----
export const useGithubSettings = () =>
    useQuery({ queryKey: settingsKeys.github(), queryFn: api.getGithub });
export const useUpdateGithub = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: Partial<GithubSettingsDTO>) => api.updateGithub(body),
        onSuccess: (data) => {
            qc.setQueryData(settingsKeys.github(), data);
            toast.success("站点设置已保存");
        },
        onError: (e: Error) => toast.error(`保存失败：${e.message}`),
    });
};

// ---- 关于博主组 ----
export const useProfileSettings = () =>
    useQuery({ queryKey: settingsKeys.profile(), queryFn: api.getProfile });
export const useUpdateProfile = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: Partial<ProfileSettingsDTO>) => api.updateProfile(body),
        onSuccess: (data) => {
            qc.setQueryData(settingsKeys.profile(), data);
            toast.success("站点设置已保存");
        },
        onError: (e: Error) => toast.error(`保存失败：${e.message}`),
    });
};

// ---- 关于页区块配置组 ----
export const useAboutSettings = () =>
    useQuery({ queryKey: settingsKeys.about(), queryFn: api.getAbout });
export const useUpdateAbout = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: Partial<AboutSettingsDTO>) => api.updateAbout(body),
        onSuccess: (data) => {
            qc.setQueryData(settingsKeys.about(), data);
            toast.success("站点设置已保存");
        },
        onError: (e: Error) => toast.error(`保存失败：${e.message}`),
    });
};

// ---- LLM 组 ----
export const useLlmSettings = () => useQuery({ queryKey: settingsKeys.llm(), queryFn: api.getLlm });
export const useUpdateLlm = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: Partial<LlmSettingsDTO>) => api.updateLlm(body),
        onSuccess: (data) => {
            qc.setQueryData(settingsKeys.llm(), data);
            toast.success("站点设置已保存");
        },
        onError: (e: Error) => toast.error(`保存失败：${e.message}`),
    });
};

// ---- 代码运行器组 ----
export const useCodeRunnerSettings = () =>
    useQuery({ queryKey: settingsKeys.codeRunner(), queryFn: api.getCodeRunner });
export const useUpdateCodeRunner = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: Partial<CodeRunnerSettingsDTO>) => api.updateCodeRunner(body),
        onSuccess: (data) => {
            qc.setQueryData(settingsKeys.codeRunner(), data);
            toast.success("站点设置已保存");
        },
        onError: (e: Error) => toast.error(`保存失败：${e.message}`),
    });
};
