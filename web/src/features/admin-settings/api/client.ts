import { apiGet, apiPut } from "@shared/api/request";
import type {
    AboutSettingsDTO,
    AuthSettingsDTO,
    CodeRunnerSettingsDTO,
    GeneralSettingsDTO,
    GithubSettingsDTO,
    LlmSettingsDTO,
    ProfileSettingsDTO,
} from "../model/types";

const BASE = "/admin/settings";

/**
 * 站点设置分组 client —— 对齐后端 7 组子接口。
 *
 * 每组 get 调 GET /admin/settings/{group}，update 调 PUT 同路径。
 * update 入参为 Partial（后端按指针语义部分更新），调用方可只提交改动字段。
 * 返回更新后的该组全量配置。
 */

/** getGeneral / updateGeneral —— 基础信息组 */
export const getGeneral = () => apiGet<GeneralSettingsDTO>(`${BASE}/general`);
export const updateGeneral = (body: Partial<GeneralSettingsDTO>) =>
    apiPut<GeneralSettingsDTO>(`${BASE}/general`, body);

/** getAuth / updateAuth —— 认证组 */
export const getAuth = () => apiGet<AuthSettingsDTO>(`${BASE}/auth`);
export const updateAuth = (body: Partial<AuthSettingsDTO>) =>
    apiPut<AuthSettingsDTO>(`${BASE}/auth`, body);

/** getGithub / updateGithub —— GitHub 组 */
export const getGithub = () => apiGet<GithubSettingsDTO>(`${BASE}/github`);
export const updateGithub = (body: Partial<GithubSettingsDTO>) =>
    apiPut<GithubSettingsDTO>(`${BASE}/github`, body);

/** getProfile / updateProfile —— 关于博主组 */
export const getProfile = () => apiGet<ProfileSettingsDTO>(`${BASE}/profile`);
export const updateProfile = (body: Partial<ProfileSettingsDTO>) =>
    apiPut<ProfileSettingsDTO>(`${BASE}/profile`, body);

/** getAbout / updateAbout —— 关于页区块配置组 */
export const getAbout = () => apiGet<AboutSettingsDTO>(`${BASE}/about`);
export const updateAbout = (body: Partial<AboutSettingsDTO>) =>
    apiPut<AboutSettingsDTO>(`${BASE}/about`, body);

/** getLlm / updateLlm —— LLM 组 */
export const getLlm = () => apiGet<LlmSettingsDTO>(`${BASE}/llm`);
export const updateLlm = (body: Partial<LlmSettingsDTO>) =>
    apiPut<LlmSettingsDTO>(`${BASE}/llm`, body);

/** getCodeRunner / updateCodeRunner —— 代码运行器组 */
export const getCodeRunner = () => apiGet<CodeRunnerSettingsDTO>(`${BASE}/code-runner`);
export const updateCodeRunner = (body: Partial<CodeRunnerSettingsDTO>) =>
    apiPut<CodeRunnerSettingsDTO>(`${BASE}/code-runner`, body);
