//! 成长:经验与等级、长期性格、主题倾向、进化分支。全部为整数运算,无随机。
use crate::life::ActError;
use alloc::string::String;
use alloc::vec::Vec;
use serde::{Deserialize, Serialize};

/// 各等级所需累计经验,下标 0 对应 1 级。
const LEVEL_EXP: [u32; 10] = [0, 20, 50, 100, 180, 300, 480, 720, 1050, 1500];
pub const MAX_EXP: u32 = 1500;

const TRAIT_MAX: u16 = 1000;
/// 性格最多偏离出生底色的幅度。
const DRIFT_CAP: u16 = 200;
/// 每个维度每天最多漂移的点数,限制短时重复刺激的永久影响。
const DRIFT_PER_DAY: u8 = 30;
const TICKS_PER_DAY: u64 = 24 * 60;

pub const EVOLVE_FOOD_COST: u32 = 3;
const MAX_TOPICS: usize = 8;
pub const MAX_TOPIC_LEN: usize = 32;

/// 性格维度下标。
pub const CURIOUS: usize = 0;
pub const AFFECTION: usize = 1;
pub const CALM: usize = 2;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum Stage {
    #[default]
    Baby,
    Young,
    Adult,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum Branch {
    // 幼体 → 少年
    Curious,
    Gentle,
    Steady,
    // 少年 → 成年
    Sage,
    Guardian,
    Wanderer,
    /// 后天罕见形态:不改变出生稀有度,只记录在 acquired_rarity。
    Radiant,
}

impl Branch {
    fn source_stage(self) -> Stage {
        match self {
            Branch::Curious | Branch::Gentle | Branch::Steady => Stage::Baby,
            _ => Stage::Young,
        }
    }

    fn target_stage(self) -> Stage {
        match self.source_stage() {
            Stage::Baby => Stage::Young,
            _ => Stage::Adult,
        }
    }
}

const ALL_BRANCHES: [Branch; 7] = [Branch::Curious, Branch::Gentle, Branch::Steady, Branch::Sage, Branch::Guardian, Branch::Wanderer, Branch::Radiant];

/// 主题倾向:接入方映射后的主题标签及累计次数。
#[derive(Clone, Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct TopicCount {
    pub topic: String,
    pub count: u32,
}

/// 成长状态。所有字段有默认值,保证没有该结构的旧存档仍可加载。
#[derive(Clone, Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Growth {
    /// 累计经验,至多 1500。
    pub exp: u32,
    pub stage: Stage,
    /// 已选择的进化分支,按发生顺序。出生身份与基因不随进化改变。
    pub lineage: Vec<Branch>,
    /// 当前性格:好奇、亲和、沉稳,各 0 到 1000。
    pub traits: [u16; 3],
    /// 出生底色,由基因决定,创建后不变。当前性格最多偏离底色 +200。
    pub base_traits: [u16; 3],
    /// 性格漂移预算所属的天(逻辑时间 / 1440)。
    #[serde(with = "crate::codec::u64_string")]
    #[cfg_attr(feature = "schema", schemars(with = "String"))]
    pub drift_day: u64,
    /// 当天各维度已使用的漂移点数。
    pub drift_used: [u8; 3],
    /// 后天罕见形态:0 无,1 为 Radiant。与出生稀有度无关,出生档位不变。
    pub acquired_rarity: u8,
    /// 主题倾向,至多 8 项。
    pub topics: Vec<TopicCount>,
}

impl Default for Growth {
    fn default() -> Self {
        Self::with_base([500, 500, 500])
    }
}

impl Growth {
    pub fn with_base(base: [u16; 3]) -> Self {
        Self { exp: 0, stage: Stage::Baby, lineage: Vec::new(), traits: base, base_traits: base, drift_day: 0, drift_used: [0; 3], acquired_rarity: 0, topics: Vec::new() }
    }

    /// 由基因的后三个字节得到出生底色,落在 300 到 699。
    pub fn base_from_genes(genes: &[u8; 8]) -> [u16; 3] {
        [300 + genes[5] as u16 % 400, 300 + genes[6] as u16 % 400, 300 + genes[7] as u16 % 400]
    }

    pub fn level(&self) -> u8 {
        LEVEL_EXP.iter().rposition(|t| self.exp >= *t).map_or(1, |i| i as u8 + 1)
    }

    pub(crate) fn add_exp(&mut self, n: u32) {
        self.exp = (self.exp + n).min(MAX_EXP);
    }

    /// 性格向上漂移:受每日预算与底色 +200 上限约束。
    pub(crate) fn drift(&mut self, which: usize, amount: u8, now: u64) {
        let day = now / TICKS_PER_DAY;
        if self.drift_day != day {
            self.drift_day = day;
            self.drift_used = [0; 3];
        }
        let room_today = DRIFT_PER_DAY.saturating_sub(self.drift_used[which]);
        let room_total = (self.base_traits[which] + DRIFT_CAP).min(TRAIT_MAX).saturating_sub(self.traits[which]);
        let add = (amount.min(room_today) as u16).min(room_total);
        self.traits[which] += add;
        self.drift_used[which] += add as u8;
    }

    pub(crate) fn add_topic(&mut self, topic: &str) {
        if let Some(t) = self.topics.iter_mut().find(|t| t.topic == topic) {
            t.count += 1;
        } else {
            if self.topics.len() == MAX_TOPICS {
                // 淘汰计数最低且最早的一项,保证确定性。
                if let Some(i) = self.topics.iter().enumerate().min_by_key(|(i, t)| (t.count, *i)).map(|(i, _)| i) {
                    self.topics.remove(i);
                }
            }
            self.topics.push(TopicCount { topic: topic.into(), count: 1 });
        }
    }

    fn top_topic(&self) -> u32 {
        self.topics.iter().map(|t| t.count).max().unwrap_or(0)
    }

    fn topic_total(&self) -> u32 {
        self.topics.iter().map(|t| t.count).sum()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum MissingKind {
    Level,
    Curious,
    Affection,
    Calm,
    Topic,
    TopicVariety,
    Food,
}

/// 未满足的进化条件:还差多少。
#[derive(Clone, Debug, Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Missing {
    pub kind: MissingKind,
    pub have: u32,
    pub need: u32,
}

#[derive(Clone, Debug, Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct BranchOption {
    pub branch: Branch,
    pub to_stage: Stage,
    pub eligible: bool,
    pub missing: Vec<Missing>,
}

#[derive(Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct EvolutionOptions {
    pub stage: Stage,
    pub level: u8,
    pub options: Vec<BranchOption>,
}

fn need(missing: &mut Vec<Missing>, kind: MissingKind, have: u32, need: u32) {
    if have < need {
        missing.push(Missing { kind, have, need });
    }
}

fn check(g: &Growth, food: u32, branch: Branch) -> BranchOption {
    let mut m = Vec::new();
    let t = |i: usize| g.traits[i] as u32;
    let entry_level = if branch.source_stage() == Stage::Baby { 3 } else { 7 };
    need(&mut m, MissingKind::Level, g.level() as u32, entry_level);
    match branch {
        Branch::Curious => need(&mut m, MissingKind::Curious, t(CURIOUS), 550),
        Branch::Gentle => need(&mut m, MissingKind::Affection, t(AFFECTION), 550),
        Branch::Steady | Branch::Wanderer => {}
        Branch::Sage => {
            need(&mut m, MissingKind::Topic, g.top_topic(), 20);
            need(&mut m, MissingKind::Curious, t(CURIOUS), 600);
        }
        Branch::Guardian => {
            need(&mut m, MissingKind::Affection, t(AFFECTION), 600);
            need(&mut m, MissingKind::Calm, t(CALM), 550);
        }
        Branch::Radiant => {
            need(&mut m, MissingKind::Level, g.level() as u32, 9);
            for (kind, i) in [(MissingKind::Curious, CURIOUS), (MissingKind::Affection, AFFECTION), (MissingKind::Calm, CALM)] {
                need(&mut m, kind, t(i), 650);
            }
            need(&mut m, MissingKind::Topic, g.topic_total(), 60);
            need(&mut m, MissingKind::TopicVariety, g.topics.len() as u32, 3);
        }
    }
    need(&mut m, MissingKind::Food, food, EVOLVE_FOOD_COST);
    // 条件可能因 Radiant 的更高等级要求而重复列出等级,去重保留要求最高的一条。
    m.sort_by_key(|x| (x.kind as u8, core::cmp::Reverse(x.need)));
    m.dedup_by_key(|x| x.kind as u8);
    BranchOption { branch, to_stage: branch.target_stage(), eligible: m.is_empty(), missing: m }
}

/// 当前阶段可走的全部分支及缺项说明。成年后为空。
pub fn evolution_options(g: &Growth, food: u32) -> EvolutionOptions {
    let options = ALL_BRANCHES.iter().copied().filter(|b| b.source_stage() == g.stage).map(|b| check(g, food, b)).collect();
    EvolutionOptions { stage: g.stage, level: g.level(), options }
}

/// 执行进化。条件不满足返回 NotEligible,不扣任何资源;成功消耗固定食物。
pub(crate) fn evolve(g: &mut Growth, food: &mut u32, branch: Branch) -> Result<(), ActError> {
    if branch.source_stage() != g.stage {
        return Err(ActError::NotEligible);
    }
    if !check(g, *food, branch).eligible {
        return Err(ActError::NotEligible);
    }
    *food -= EVOLVE_FOOD_COST;
    g.stage = branch.target_stage();
    g.lineage.push(branch);
    if branch == Branch::Radiant {
        g.acquired_rarity = 1;
    }
    Ok(())
}
