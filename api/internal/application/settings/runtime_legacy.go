package settings

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"strconv"
	"strings"

	domaincoderunner "blog-api/internal/domain/coderunner"
	domainsettings "blog-api/internal/domain/settings"
	"github.com/rs/zerolog/log"
)

// importLegacyRunner 仅在分组首次创建时迁移有效覆盖，零值仍使用部署默认。
func (p *RuntimePolicies) importLegacyRunner(ctx context.Context) error {
	record, err := p.store.Load(ctx, domainsettings.CodeRunnerGroup)
	if err != nil {
		return err
	}
	if record.Version != 0 {
		return nil
	}
	legacy, err := p.store.LoadLegacyRunner(ctx)
	if err != nil {
		return err
	}
	overrides := json.RawMessage(`{}`)
	keys := make([]string, 0, len(legacy))
	for key := range legacy {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	for _, key := range keys {
		field := strings.TrimPrefix(key, "code_runner_")
		raw := legacy[key]
		var value any
		switch field {
		case "enabled", "allow_network":
			if raw != "true" && raw != "false" {
				continue
			}
			value = raw == "true"
		case "max_cpu_cores":
			parsed, err := strconv.ParseFloat(raw, 64)
			if err != nil || parsed == 0 {
				continue
			}
			value = parsed
		case "max_memory_mb", "max_timeout_secs", "max_output_bytes", "max_source_bytes":
			parsed, err := strconv.ParseUint(raw, 10, 64)
			if err != nil || parsed == 0 {
				continue
			}
			value = parsed
		case "languages":
			if strings.TrimSpace(raw) == "" {
				continue
			}
			languages, err := domaincoderunner.NormalizeLanguages(strings.Split(raw, ","))
			if err != nil {
				return err
			}
			value = languages
		default:
			continue
		}
		patch, marshalErr := json.Marshal(map[string]any{field: value})
		if marshalErr != nil {
			continue
		}
		candidate, mergeErr := mergeRuntimeJSON(overrides, patch)
		if mergeErr != nil {
			continue
		}
		if _, validationErr := p.resolve(domainsettings.CodeRunnerGroup, candidate); validationErr != nil {
			log.Warn().Str("field", field).Msg("旧运行器覆盖无效，保留部署默认")
			continue
		}
		overrides = candidate
	}
	_, err = p.store.CompareAndSwap(ctx, domainsettings.CodeRunnerGroup, 0, overrides)
	if errors.Is(err, domainsettings.ErrRuntimeConflict) {
		return nil
	}
	return err
}
