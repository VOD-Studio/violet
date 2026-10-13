use crate::codec::{u64_string, ErrorCode};
use crate::growth::{self, Branch, Growth, MAX_TOPIC_LEN, AFFECTION, CALM, CURIOUS};
use crate::RULES_VERSION;
use alloc::string::String;
use serde::{Deserialize, Serialize};

// 逻辑时间单位:1 刻度 = 1 分钟。默认值依据 pet/docs/parameters.md 的快进体验记录。
/// 饱食每降 1 点所需刻度(100 点 40 小时耗尽,一次喂食恰好抵一天的消耗)。
const SATIETY_DECAY_TICKS: u64 = 24;
const ENERGY_DECAY_TICKS: u64 = 30;
/// 饱食耗尽后持续失养多久进入预警 / 生病 / 死亡(24 小时 / 48 小时 / 120 小时)。
const WARN_AT: u64 = 1440;
const SICK_AT: u64 = 2880;
const DEAD_AT: u64 = 7200;
/// 两次结算间隔超过该值视为「离开」:失养最多把宠物推到生病,绝不越过死亡线。
/// 死亡时钟只在被观察的时间里前进,所以页面或 CLI 在线时须至少每隔该间隔结算一次。
const AWAY_AFTER: u64 = 30;
const FEED_GAIN: u16 = 60;
const REST_GAIN: u16 = 40;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Healthy,
    Warned,
    Sick,
    Dead,
}

#[derive(Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Pet {
    pub id: String,
    /// 个体出生时所用的规则版本。缺省为 1，兼容该字段出现之前保存的个体。
    #[serde(default = "first_rules_version")]
    pub rules_version: u32,
    pub satiety: u8,
    pub energy: u8,
    pub food: u32,
    pub medicine: u32,
    /// 饱食衰减的余数刻度,保证结算频率不影响总衰减量。
    #[serde(default)]
    pub satiety_rem: u8,
    /// 精力衰减的余数刻度。
    #[serde(default)]
    pub energy_rem: u8,
    /// 持续失养的逻辑时间,决定预警、生病与死亡。
    #[serde(with = "u64_string")]
    #[cfg_attr(feature = "schema", schemars(with = "String"))]
    pub neglect: u64,
    #[serde(with = "u64_string")]
    #[cfg_attr(feature = "schema", schemars(with = "String"))]
    pub last_tick: u64,
    pub last_request: String,
    /// 成长状态:经验、阶段、性格、主题倾向。缺省为初始值,兼容没有该字段的旧存档。
    #[serde(default)]
    pub growth: Growth,
}

fn first_rules_version() -> u32 {
    1
}

impl Pet {
    pub fn newborn(id: String, at: u64) -> Self {
        Self::newborn_with(id, at, Growth::default())
    }

    pub fn newborn_with(id: String, at: u64, growth: Growth) -> Self {
        Self { id, rules_version: RULES_VERSION, satiety: 80, energy: 80, food: 5, medicine: 1, satiety_rem: 0, energy_rem: 0, neglect: 0, last_tick: at, last_request: String::new(), growth }
    }

    pub fn phase(&self) -> Phase {
        match self.neglect {
            n if n >= DEAD_AT => Phase::Dead,
            n if n >= SICK_AT => Phase::Sick,
            n if n >= WARN_AT => Phase::Warned,
            _ => Phase::Healthy,
        }
    }
}

#[derive(Clone, Copy, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Feed,
    Rest,
    Play,
    Heal,
    Wait,
    /// 进化到指定分支。永不自动发生,需要主人选择。
    Evolve { branch: Branch },
}

/// 短期情绪,由身体状态派生,不存储,所以不会成为永久状态。
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum Mood {
    Sick,
    Hungry,
    Tired,
    Happy,
    Content,
}

impl Pet {
    pub fn mood(&self) -> Mood {
        if self.phase() == Phase::Sick {
            Mood::Sick
        } else if self.satiety < 20 {
            Mood::Hungry
        } else if self.energy < 20 {
            Mood::Tired
        } else if self.satiety >= 70 && self.energy >= 70 {
            Mood::Happy
        } else {
            Mood::Content
        }
    }
}

/// 经服务裁决后发放的奖励。核心只校验单次上限,不决定谁有资格(见 ADR-0021)。
#[derive(Clone, Debug, Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Reward {
    /// 经验,单次至多 100。
    pub exp: u16,
    /// 食物,单次至多 10。
    pub food: u8,
    /// 药品,单次至多 3。
    pub medicine: u8,
    /// 接入方映射后的主题标签,至多 32 字节;缺省则不记录主题。
    pub topic: Option<String>,
}

#[derive(Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Outcome {
    pub pet: Pet,
    pub phase: Phase,
    pub mood: Mood,
    pub replayed: bool,
}

#[derive(Debug)]
pub enum ActError {
    Dead,
    NoFood,
    NoMedicine,
    NotSick,
    TooTired,
    TimeBackwards,
    UnsupportedRules,
    NotEligible,
    InvalidReward,
}

impl ActError {
    pub fn code(&self) -> ErrorCode {
        match self {
            Self::Dead => ErrorCode::Dead,
            Self::NoFood => ErrorCode::NoFood,
            Self::NoMedicine => ErrorCode::NoMedicine,
            Self::NotSick => ErrorCode::NotSick,
            Self::TooTired => ErrorCode::TooTired,
            Self::TimeBackwards => ErrorCode::TimeBackwards,
            Self::UnsupportedRules => ErrorCode::UnsupportedRules,
            Self::NotEligible => ErrorCode::NotEligible,
            Self::InvalidReward => ErrorCode::InvalidReward,
        }
    }

    pub fn message(&self) -> &'static str {
        match self {
            Self::Dead => "pet is dead",
            Self::NoFood => "no food in inventory",
            Self::NoMedicine => "no medicine in inventory",
            Self::NotSick => "pet is not sick",
            Self::TooTired => "energy too low to play",
            Self::TimeBackwards => "now is before last_tick",
            Self::UnsupportedRules => "pet was saved with a rules version this build cannot settle",
            Self::NotEligible => "evolution conditions are not met",
            Self::InvalidReward => "reward is outside the allowed bounds",
        }
    }
}

/// 带余数的整数衰减:`value` 每 `period` 刻度降 1,余数在两次结算间保留。
fn decay(value: u8, rem: u8, dt: u64, period: u64) -> (u8, u8) {
    let total = rem as u64 + dt;
    let drop = total / period;
    if drop >= value as u64 {
        (0, 0)
    } else {
        (value - drop as u8, (total % period) as u8)
    }
}

fn advance(p: &mut Pet, now: u64) -> Result<(), ActError> {
    if now < p.last_tick {
        return Err(ActError::TimeBackwards);
    }
    let dt = now - p.last_tick;
    // 饱食耗尽前剩余的刻度,用于计算本次结算中真正处于失养的时长。
    let until_empty = (p.satiety as u64 * SATIETY_DECAY_TICKS).saturating_sub(p.satiety_rem as u64);
    let (satiety, satiety_rem) = decay(p.satiety, p.satiety_rem, dt, SATIETY_DECAY_TICKS);
    let (energy, energy_rem) = decay(p.energy, p.energy_rem, dt, ENERGY_DECAY_TICKS);
    p.satiety = satiety;
    p.satiety_rem = satiety_rem;
    p.energy = energy;
    p.energy_rem = energy_rem;
    let mut neglect = p.neglect + dt.saturating_sub(until_empty);
    if dt > AWAY_AFTER {
        neglect = neglect.min(p.neglect.max(SICK_AT));
    }
    p.neglect = neglect;
    p.last_tick = now;
    Ok(())
}

pub fn act(mut pet: Pet, action: Action, now: u64, request_id: &str) -> Result<Outcome, ActError> {
    if !pet.last_request.is_empty() && pet.last_request == request_id {
        let (phase, mood) = (pet.phase(), pet.mood());
        return Ok(Outcome { pet, phase, mood, replayed: true });
    }
    if pet.rules_version != RULES_VERSION {
        return Err(ActError::UnsupportedRules);
    }
    advance(&mut pet, now)?;
    if pet.phase() == Phase::Dead {
        return Err(ActError::Dead);
    }
    match action {
        Action::Wait => {}
        Action::Feed => {
            if pet.food == 0 {
                return Err(ActError::NoFood);
            }
            pet.food -= 1;
            pet.satiety = (pet.satiety as u16 + FEED_GAIN).min(100) as u8;
            if pet.phase() != Phase::Sick {
                pet.neglect = 0;
            }
            pet.growth.add_exp(1);
            pet.growth.drift(AFFECTION, 6, now);
        }
        Action::Rest => {
            pet.energy = (pet.energy as u16 + REST_GAIN).min(100) as u8;
            pet.growth.drift(CALM, 6, now);
        }
        Action::Play => {
            if pet.energy < 20 {
                return Err(ActError::TooTired);
            }
            pet.energy -= 20;
            pet.growth.add_exp(2);
            pet.growth.drift(CURIOUS, 6, now);
        }
        Action::Heal => {
            if pet.phase() != Phase::Sick {
                return Err(ActError::NotSick);
            }
            if pet.medicine == 0 {
                return Err(ActError::NoMedicine);
            }
            pet.medicine -= 1;
            pet.neglect = WARN_AT - 1;
            pet.growth.drift(AFFECTION, 10, now);
        }
        Action::Evolve { branch } => growth::evolve(&mut pet.growth, &mut pet.food, branch)?,
    }
    pet.last_request = request_id.into();
    let (phase, mood) = (pet.phase(), pet.mood());
    Ok(Outcome { pet, phase, mood, replayed: false })
}

/// 发放奖励。与 `act` 同样先按逻辑时间结算,幂等键为 `request_id`,死亡个体拒绝。
pub fn grant(mut pet: Pet, reward: &Reward, now: u64, request_id: &str) -> Result<Outcome, ActError> {
    if !pet.last_request.is_empty() && pet.last_request == request_id {
        let (phase, mood) = (pet.phase(), pet.mood());
        return Ok(Outcome { pet, phase, mood, replayed: true });
    }
    if pet.rules_version != RULES_VERSION {
        return Err(ActError::UnsupportedRules);
    }
    let topic_ok = reward.topic.as_deref().is_none_or(|t| !t.is_empty() && t.len() <= MAX_TOPIC_LEN);
    if reward.exp > 100 || reward.food > 10 || reward.medicine > 3 || !topic_ok {
        return Err(ActError::InvalidReward);
    }
    advance(&mut pet, now)?;
    if pet.phase() == Phase::Dead {
        return Err(ActError::Dead);
    }
    pet.growth.add_exp(reward.exp as u32);
    pet.food = (pet.food + reward.food as u32).min(99);
    pet.medicine = (pet.medicine + reward.medicine as u32).min(9);
    if let Some(topic) = reward.topic.as_deref() {
        pet.growth.add_topic(topic);
        pet.growth.drift(CURIOUS, 4, now);
    }
    pet.last_request = request_id.into();
    let (phase, mood) = (pet.phase(), pet.mood());
    Ok(Outcome { pet, phase, mood, replayed: false })
}
