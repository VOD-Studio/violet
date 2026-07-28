// commit-and-tag-version 配置
//
// 设计要点:
// - tagPrefix 'v' 匹配 .github/workflows/deploy.yml 的 'v*' 触发规则
// - header:false 不重写 CHANGELOG.md 顶部已有的标题块,只在 [Unreleased] 下前插新版本段
// - types 按中文习惯重命名分组,隐藏 chore/ci/build/test 减少噪音
// - skip 对 ctv 会自动改动的非真相源文件,避免污染(版本真相源是 git tag + 根 package.json)
// - commit/compare 链接指向 VOD-Studio/violet

module.exports = {
  tagPrefix: 'v',
  header: false,

  // Conventional Commits 类型 → CHANGELOG 中文分组
  // hidden:true 的类型不进入 CHANGELOG
  types: [
    { type: 'feat',     section: '✨ 新增',  hidden: false },
    { type: 'fix',      section: '🐛 修复',  hidden: false },
    { type: 'perf',     section: '⚡ 性能',  hidden: false },
    { type: 'refactor', section: '♻️ 重构',  hidden: false },
    { type: 'docs',     section: '📝 文档',  hidden: false },
    { type: 'style',    section: '🎨 样式',  hidden: false },
    { type: 'revert',   section: '⏪ 回滚',  hidden: false },
    { type: 'chore',    section: '🔧 杂项',  hidden: true  },
    { type: 'ci',       section: '👷 CI',    hidden: true  },
    { type: 'build',    section: '📦 构建',  hidden: true  },
    { type: 'test',     section: '✅ 测试',  hidden: true  },
  ],

  // 提交信息与 CHANGELOG 链接指向
  commitUrlFormat: 'https://github.com/VOD-Studio/violet/commit/{{hash}}',
  compareUrlFormat: 'https://github.com/VOD-Studio/violet/compare/{{previousTag}}...{{currentTag}}',
  issueUrlFormat: 'https://github.com/VOD-Studio/violet/issues/{{id}}',

  // commit-and-tag-version 默认会 bump 这些文件的版本号。
  // 版本真相源只有根 package.json + git tag,其余全部跳过。
  bumpFiles: [
    {
      filename: 'package.json',
      type: 'json',
    },
  ],
  packageFiles: [
    {
      filename: 'package.json',
      type: 'json',
    },
  ],

  // CHANGELOG 提交信息与 tag 名格式
  commitMessageFormat: 'chore(release): {{currentTag}}',
};
