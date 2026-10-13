use crate::codec::ErrorCode;
use crate::RULES_VERSION;
use serde::Serialize;

/// 一项可调用能力。能力发现、CLI 帮助与文档都由这张表产出,新增命令必须在此登记。
#[derive(Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Capability {
    pub op: &'static str,
    pub summary: &'static str,
    /// 是否产生需要持久化的状态变化(调用方负责提交,核心不写存储)。
    pub mutates_state: bool,
    /// 该能力可能返回的业务错误分类。
    pub errors: &'static [ErrorCode],
}

#[derive(Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct CapabilityCatalog {
    pub rules_version: u32,
    pub capabilities: &'static [Capability],
}

use ErrorCode::*;

pub const CAPABILITIES: &[Capability] = &[
    Capability { op: "birth", summary: "由出生输入派生个体身份、稀有度、物种与基因", mutates_state: true, errors: &[BadInput] },
    Capability {
        op: "act",
        summary: "对宠物执行喂食、休息、玩耍、治疗或等待,按逻辑时间结算病程",
        mutates_state: true,
        errors: &[BadInput, Dead, NoFood, NoMedicine, NotSick, TooTired, TimeBackwards, UnsupportedRules, NotEligible],
    },
    Capability { op: "grant", summary: "发放经服务裁决后的奖励(经验、食物、药品、主题倾向);核心只校验单次上限", mutates_state: true, errors: &[BadInput, Dead, InvalidReward, TimeBackwards, UnsupportedRules] },
    Capability { op: "evolution_options", summary: "列出当前阶段的进化分支,以及每个分支的缺项说明", mutates_state: false, errors: &[BadInput] },
    Capability { op: "frame", summary: "将姿态与呈现时钟合成为字符单元网格", mutates_state: false, errors: &[BadInput] },
    Capability { op: "verify_birth", summary: "核验出生证书的来源签名、承诺揭示与结果重算", mutates_state: false, errors: &[BadInput] },
    Capability { op: "capabilities", summary: "列出当前实现的全部能力与错误分类", mutates_state: false, errors: &[] },
];

pub fn catalog() -> CapabilityCatalog {
    CapabilityCatalog { rules_version: RULES_VERSION, capabilities: CAPABILITIES }
}
