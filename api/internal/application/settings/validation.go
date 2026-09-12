package settings

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"slices"
	"strconv"
	"strings"

	domainsettings "blog-api/internal/domain/settings"
	"blog-api/internal/domain/shared"
)

func settingsMap(settings domainsettings.SiteSettings) map[string]string {
	data, _ := json.Marshal(settings)
	var fields map[string]json.RawMessage
	_ = json.Unmarshal(data, &fields)
	result := make(map[string]string, len(fields))
	for key, raw := range fields {
		var value string
		if json.Unmarshal(raw, &value) == nil && !bytes.Equal(raw, []byte("null")) {
			result[key] = value
		} else {
			result[key] = string(raw)
		}
	}
	return result
}

func decodePatch(group domainsettings.Group, patch map[string]json.RawMessage) (map[string]string, error) {
	keys := group.Keys()
	if len(keys) == 0 || patch == nil {
		return nil, shared.BadRequest("values 必须是当前配置组的对象")
	}
	for key, raw := range patch {
		if !slices.Contains(keys, key) {
			return nil, shared.FieldValidation(key, "字段不属于当前配置组")
		}
		if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
			return nil, shared.FieldValidation(key, "不接受 null；恢复部署默认请使用 reset")
		}
		if key == "about_config" {
			value := bytes.TrimSpace(raw)
			if len(value) == 0 || value[0] != '{' {
				return nil, shared.FieldValidation(key, "必须是对象")
			}
		}
	}
	data, err := json.Marshal(patch)
	if err != nil {
		return nil, shared.BadRequest("无效配置值")
	}
	var typed domainsettings.SiteSettings
	if err := json.Unmarshal(data, &typed); err != nil {
		if typedError, ok := err.(*json.UnmarshalTypeError); ok {
			return nil, shared.FieldValidation(typedError.Field, "配置字段类型错误")
		}
		return nil, shared.BadRequest("配置字段类型错误")
	}
	encoded := settingsMap(typed)
	result := make(map[string]string, len(patch))
	for key := range patch {
		result[key] = encoded[key]
	}
	if raw, ok := result["footer_github_url"]; ok {
		normalized, err := domainsettings.NormalizeFooterGitHubURL(raw)
		if err != nil {
			return nil, err
		}
		result["footer_github_url"] = normalized
	}
	return result, nil
}

func validateGroup(group domainsettings.Group, values map[string]string) error {
	invalid := func(key, reason string) error { return shared.FieldValidation(key, reason) }
	switch group {
	case domainsettings.General:
		if strings.TrimSpace(values["site_name"]) == "" || len(values["site_name"]) > 200 {
			return invalid("site_name", "不能为空且最多 200 字节")
		}
		if !httpURL(values["site_url"]) {
			return invalid("site_url", "必须是 HTTP(S) 绝对地址")
		}
		if _, err := domainsettings.NormalizeFooterGitHubURL(values["footer_github_url"]); err != nil {
			return err
		}
		for key, bounds := range map[string][2]int{"posts_per_page": {1, 100}, "home_footprint_aggregation_days": {1, 31}, "custom_emoji_max_per_user": {0, 1000000}} {
			n, err := strconv.Atoi(values[key])
			if err != nil || n < bounds[0] || n > bounds[1] {
				return invalid(key, fmt.Sprintf("必须在 %d 到 %d 之间", bounds[0], bounds[1]))
			}
		}
	case domainsettings.About:
		raw := values["about_config"]
		if raw != "null" && raw != "" {
			var object map[string]json.RawMessage
			if err := json.Unmarshal([]byte(raw), &object); err != nil || object == nil {
				return invalid("about_config", "必须是对象")
			}
			if sections, ok := object["sections"]; ok {
				var list []struct {
					ID      string                     `json:"id"`
					Enabled bool                       `json:"enabled"`
					Order   int                        `json:"order"`
					Params  map[string]json.RawMessage `json:"params"`
				}
				if err := json.Unmarshal(sections, &list); err != nil || list == nil {
					return invalid("about_config.sections", "必须是区块数组")
				}
				seen := make(map[string]bool)
				for _, section := range list {
					if section.ID == "" || seen[section.ID] {
						return invalid("about_config.sections", "区块 ID 不能为空或重复")
					}
					seen[section.ID] = true
				}
			}
		}
	case domainsettings.LLM:
		if values["llm_api_url"] != "" && !httpURL(values["llm_api_url"]) {
			return invalid("llm_api_url", "必须是 HTTP(S) 绝对地址或空串")
		}
		if values["llm_protocol"] != "" && values["llm_protocol"] != "openai" {
			return invalid("llm_protocol", "仅支持 openai")
		}
	case domainsettings.CodeRunner:
		cpu, err := strconv.ParseFloat(values["code_runner_max_cpu_cores"], 64)
		if err != nil || cpu < 0.1 || cpu > 128 {
			return invalid("code_runner_max_cpu_cores", "必须在 0.1 到 128 之间")
		}
		for _, key := range []string{"code_runner_max_memory_mb", "code_runner_max_timeout_secs", "code_runner_max_source_bytes"} {
			n, err := strconv.ParseUint(values[key], 10, 64)
			if err != nil || n == 0 {
				return invalid(key, "必须大于 0")
			}
		}
		if _, err := strconv.ParseUint(values["code_runner_max_output_bytes"], 10, 64); err != nil {
			return invalid("code_runner_max_output_bytes", "必须是非负整数")
		}
		if values["code_runner_languages"] != "" {
			for _, language := range strings.Split(values["code_runner_languages"], ",") {
				if !slices.Contains([]string{"python", "node", "go", "rust", "bun"}, strings.TrimSpace(language)) {
					return invalid("code_runner_languages", "包含不支持的语言")
				}
			}
		}
	}
	for key, value := range values {
		if strings.HasSuffix(key, "_enabled") || key == "comments_moderation" || key == "code_runner_allow_network" {
			if value != "true" && value != "false" {
				return invalid(key, "必须是布尔值")
			}
		}
	}
	return nil
}

func httpURL(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Hostname() != "" && u.User == nil
}
