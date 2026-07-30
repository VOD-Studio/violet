#!/usr/bin/env bash
set -euo pipefail

# ⚠️ 已废弃:发版流程已迁移到 release-please(GitHub Actions 自动化)。
# 现在发版方式:push 发版型 commit(feat/fix 等)到 release/2.0 → release-please 自动开 release PR →
# 合并 release PR 即自动打 tag + 触发 deploy.yml 部署。
#
# 本脚本保留仅作应急回退(如 release-please 故障时的手动发版),日常请勿使用。
#
# release.sh
# 一键发版:校验 → 生成 CHANGELOG → 打 tag → 确认 → push(触发 deploy.yml)
#
# 用法:
#   ./scripts/release.sh --version v2.0.1     # 显式指定版本
#   ./scripts/release.sh --bump patch          # 从最近 tag 自动 +1
#   ./scripts/release.sh --bump minor
#   ./scripts/release.sh --bump major
#   ./scripts/release.sh --version v2.0.0 --dry-run   # 只预览,不执行
#   ./scripts/release.sh --version v2.0.0 --force      # 跳过 CI 状态检查
#
# 设计:
#   - 版本真相源是 git tag;根 package.json 的 version 字段只是文件镜像
#   - 首次发版(v2.0.0)用 --first-release 跳过自动生成 CHANGELOG(已手工写好)
#   - 后续发版由 commit-and-tag-version 从 Conventional Commits 自动生成
#   - push 即触发 .github/workflows/deploy.yml 部署到 rua 生产环境,有自动回滚保护
#
# 前置条件:
#   1. 在 release/2.0 分支,工作区干净,与 origin 同步
#   2. commit-and-tag-version 已安装(根 package.json devDependencies)

# ==================== 配置 ====================
RELEASE_BRANCH="release/2.0"
TAG_PREFIX="v"
CTV_BIN="./node_modules/.bin/commit-and-tag-version"

# ==================== 参数解析 ====================
VERSION=""
BUMP=""
DRY_RUN=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        --version=*) VERSION="${1#*=}"; shift ;;
        --bump) BUMP="$2"; shift 2 ;;
        --bump=*) BUMP="${1#*=}"; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --force) FORCE=true; shift ;;
        -h|--help)
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --version <vX.Y.Z>  显式指定发版版本"
            echo "  --bump <kind>       从最近 tag 自动递增 (patch/minor/major)"
            echo "  --dry-run           只预览,不修改文件、不打 tag、不 push"
            echo "  --force             跳过 CI 状态检查"
            echo "  -h, --help          显示此帮助"
            echo ""
            echo "示例:"
            echo "  $0 --version v2.0.1"
            echo "  $0 --bump patch"
            exit 0
            ;;
        *) echo "未知参数: $1"; exit 1 ;;
    esac
done

# version 与 bump 互斥,必选其一
if [[ -n "$VERSION" && -n "$BUMP" ]]; then
    echo "❌ --version 与 --bump 不可同时使用" >&2
    exit 1
fi
if [[ -z "$VERSION" && -z "$BUMP" ]]; then
    echo "❌ 必须指定 --version <vX.Y.Z> 或 --bump <patch|minor|major>" >&2
    exit 1
fi
if [[ -n "$BUMP" && "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
    echo "❌ --bump 只接受 patch / minor / major" >&2
    exit 1
fi

# ==================== 工具函数 ====================
info()  { echo -e "\033[36mℹ️  $*\033[0m"; }
ok()    { echo -e "\033[32m✅ $*\033[0m"; }
warn()  { echo -e "\033[33m⚠️  $*\033[0m"; }
die()   { echo -e "\033[31m❌ $*\033[0m" >&2; exit 1; }

# ==================== dry-run 提示 ====================
if [ "$DRY_RUN" = true ]; then
    warn "DRY-RUN 模式:仅预览,不修改文件、不打 tag、不 push"
    echo ""
fi

# ==================== 1. 前置校验 ====================
info "前置校验..."

# 1.1 工作区干净
if [ -n "$(git status --porcelain)" ]; then
    die "工作区不干净,请先提交或 stash 所有改动"
fi

# 1.2 在发版分支
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$RELEASE_BRANCH" ]; then
    die "当前分支 $CURRENT_BRANCH,发版必须在 $RELEASE_BRANCH 分支"
fi

# 1.3 与 origin 同步(无未推送、无未拉取)
git fetch origin "$RELEASE_BRANCH" --quiet
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$RELEASE_BRANCH")"
if [ "$LOCAL" != "$REMOTE" ]; then
    die "本地 $RELEASE_BRANCH 与 origin 不同步 (local=$LOCAL remote=$REMOTE),请先 push/pull"
fi

# 1.4 commit-and-tag-version 可用
if [ ! -x "$CTV_BIN" ]; then
    if [ "$DRY_RUN" = true ]; then
        warn "$CTV_BIN 不存在,dry-run 继续但实际发版前需运行 npm install"
    else
        die "未找到 $CTV_BIN,请在仓库根运行: npm install"
    fi
fi

ok "前置校验通过"
echo ""

# ==================== 2. 计算目标版本 ====================
info "计算目标版本..."

# 取最近 tag(无则返回空)
LAST_TAG="$(git describe --tags --abbrev=0 2>/dev/null || echo "")"
if [ -n "$LAST_TAG" ]; then
    info "当前最近 tag: $LAST_TAG"
else
    info "仓库尚无 tag,本次为首次发版"
fi

if [ -n "$VERSION" ]; then
    # 显式版本:规范化(允许 "2.0.1" 或 "v2.0.1")
    TARGET_TAG="${VERSION#v}"
    TARGET_TAG="${TAG_PREFIX}${TARGET_TAG}"
else
    # 自动递增
    if [ -z "$LAST_TAG" ]; then
        # 无历史 tag 的首次发版约定:patch/minor → v2.0.0,major → v3.0.0
        case "$BUMP" in
            major) TARGET_TAG="${TAG_PREFIX}3.0.0" ;;
            *)     TARGET_TAG="${TAG_PREFIX}2.0.0" ;;
        esac
        warn "无历史 tag,$BUMP 默认发 $TARGET_TAG"
    else
        # 从 LAST_TAG 去掉前缀后 semver 递增
        BASE="${LAST_TAG#$TAG_PREFIX}"
        IFS='.' read -r MAJOR MINOR PATCH <<< "$BASE"
        case "$BUMP" in
            patch) PATCH=$((PATCH + 1)) ;;
            minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
            major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
        esac
        TARGET_TAG="${TAG_PREFIX}${MAJOR}.${MINOR}.${PATCH}"
    fi
fi

# 校验 tag 格式 vX.Y.Z
if [[ ! "$TARGET_TAG" =~ ^${TAG_PREFIX}[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    die "版本号格式错误: $TARGET_TAG (期望 ${TAG_PREFIX}X.Y.Z)"
fi

# 防重复发版(本地 + 远端都不能存在)
if git tag --list | grep -qx "$TARGET_TAG"; then
    die "本地已存在 tag $TARGET_TAG,拒绝重复发版"
fi
if git ls-remote --tags origin "refs/tags/$TARGET_TAG" | grep -q .; then
    die "远端已存在 tag $TARGET_TAG,拒绝重复发版"
fi

ok "目标版本: $TARGET_TAG"
echo ""

# ==================== 3. CI 状态检查 ====================
info "检查最近一次 CI 状态..."

if command -v gh >/dev/null 2>&1; then
    # 取 HEAD 上最近一次 CI workflow 运行
    CI_STATUS="$(gh run list \
        --workflow=ci.yml \
        --branch="$RELEASE_BRANCH" \
        --limit=1 \
        --json conclusion,status \
        --jq='.[0] | "\(.status):\(.conclusion // "")"' 2>/dev/null || echo "")"

    if [ -z "$CI_STATUS" ]; then
        warn "无法读取 CI 运行状态(可能 gh 未登录或无运行记录)"
        if [ "$FORCE" != true ]; then
            warn "如确定继续,加 --force 跳过 CI 检查"
        fi
    else
        CI_RUN_STATUS="${CI_STATUS%%:*}"
        CI_RUN_CONCLUSION="${CI_STATUS##*:}"
        info "HEAD 最近一次 CI: status=$CI_RUN_STATUS conclusion=$CI_RUN_CONCLUSION"

        if [ "$CI_RUN_STATUS" != "completed" ] || [ "$CI_RUN_CONCLUSION" != "success" ]; then
            if [ "$FORCE" != true ]; then
                die "CI 未通过(status=$CI_RUN_STATUS conclusion=$CI_RUN_CONCLUSION),修复后重试或加 --force 跳过"
            fi
            warn "FORCE 模式:跳过未通过的 CI 检查"
        else
            ok "CI 最近一次运行成功"
        fi
    fi
else
    warn "未安装 gh CLI,跳过 CI 状态检查"
fi
echo ""

# ==================== 4. 判断是否首次发版 ====================
IS_FIRST_RELEASE=false
if [ -z "$LAST_TAG" ]; then
    IS_FIRST_RELEASE=true
    info "首次发版:将用 --first-release --skip.changelog 跳过 CHANGELOG 自动生成(假设已手工写好)"
fi
echo ""

# ==================== 5. dry-run 预览结束 ====================
if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "─────────── DRY-RUN 预览 ───────────"
    echo "目标 tag:        $TARGET_TAG"
    echo "当前最近 tag:    ${LAST_TAG:-<无,首次发版>}"
    echo "发版分支:        $RELEASE_BRANCH"
    echo "首次发版:        $IS_FIRST_RELEASE"
    echo ""
    if [ "$IS_FIRST_RELEASE" != true ]; then
        echo "将执行的 ctv 命令:"
        echo "  $CTV_BIN --release-as ${TARGET_TAG#$TAG_PREFIX}"
        echo ""
        echo "将自动生成 CHANGELOG.md 中 [$TARGET_TAG] 段,并提交:"
        echo "  chore(release): $TARGET_TAG"
    else
        echo "将执行的 ctv 命令:"
        echo "  $CTV_BIN --first-release --skip.changelog"
        echo ""
        echo "只 bump 版本号 + 打 tag,不修改 CHANGELOG.md(首次条目已手工写好)"
    fi
    echo ""
    echo "确认后将执行:"
    echo "  git push --follow-tags origin $RELEASE_BRANCH"
    echo "→ 触发 .github/workflows/deploy.yml 部署到 rua 生产环境"
    echo "────────────────────────────────────"
    exit 0
fi

# ==================== 6. 执行:生成 CHANGELOG + tag ====================
info "执行 commit-and-tag-version..."

if [ "$IS_FIRST_RELEASE" = true ]; then
    "$CTV_BIN" --first-release --skip.changelog
else
    # --release-as 接受不带前缀的版本号
    "$CTV_BIN" --release-as "${TARGET_TAG#$TAG_PREFIX}"
fi

ok "CHANGELOG 与版本提交完成"
echo ""

# ==================== 7. 复核 ctv 产生的 tag ====================
# ctv 会自动打 tag,这里校验它确实存在且符合预期
if ! git tag --list | grep -qx "$TARGET_TAG"; then
    die "ctv 执行后未找到预期的 tag $TARGET_TAG,请检查"
fi

info "ctv 已创建 tag $TARGET_TAG"
echo ""

# ==================== 8. 确认环节 ====================
echo "─────────── 发版确认 ───────────"
echo ""
echo "目标版本:   $TARGET_TAG"
echo "前一版本:   ${LAST_TAG:-<无,首次发版>}"
echo ""
echo "本次版本提交内容:"
git show --stat --oneline HEAD | head -10
echo ""

if [ "$IS_FIRST_RELEASE" != true ]; then
    echo "CHANGELOG 新增段预览:"
    # 显示 [target_tag] 段的开始部分
    awk "/^## \[?${TARGET_TAG#v}/,/^## \[/{ if (/^## \[/ && !/^[#]## \[?${TARGET_TAG#v}/) exit; print }" CHANGELOG.md 2>/dev/null | head -20
    echo ""
fi

warn "push 将立即触发 deploy.yml 部署到 rua 生产环境"
warn "deploy.yml 有迁移门禁 + 健康检查 + 失败自动回滚保护"
echo ""
echo -e "\033[1m确认 push tag $TARGET_TAG 并触发部署? [y/N]\033[0m"
read -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[yY]$ ]]; then
    echo ""
    warn "已取消。回退本地 tag 与版本提交..."
    git tag -d "$TARGET_TAG"
    git reset --hard HEAD~1
    ok "已回退:删除 tag $TARGET_TAG,版本提交已撤销"
    exit 1
fi

# ==================== 9. push ====================
info "push commit + tag 到 origin/$RELEASE_BRANCH..."
git push --follow-tags origin "$RELEASE_BRANCH"
ok "已 push $TARGET_TAG"
echo ""

# ==================== 10. 报告 ====================
echo ""
ok "🎉 发版完成: $TARGET_TAG"
echo ""
info "deploy.yml 已被触发,监控部署:"
echo "  gh run watch --workflow=deploy.yml"
echo ""
info "查看部署历史:"
echo "  gh run list --workflow=deploy.yml --limit=5"
echo ""
if [ "$IS_FIRST_RELEASE" = true ]; then
    info "首次发版提示:后续使用 make release-patch/minor/major 将自动生成 CHANGELOG"
fi
