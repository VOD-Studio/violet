use crate::codec::{u64_string, ErrorCode};
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
}

impl Pet {
    pub fn newborn(id: String, at: u64) -> Self {
        Self { id, satiety: 80, energy: 80, food: 5, medicine: 1, satiety_rem: 0, energy_rem: 0, neglect: 0, last_tick: at, last_request: String::new() }
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
}

#[derive(Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Outcome {
    pub pet: Pet,
    pub phase: Phase,
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
        let phase = pet.phase();
        return Ok(Outcome { pet, phase, replayed: true });
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
        }
        Action::Rest => pet.energy = (pet.energy as u16 + REST_GAIN).min(100) as u8,
        Action::Play => {
            if pet.energy < 20 {
                return Err(ActError::TooTired);
            }
            pet.energy -= 20;
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
        }
    }
    pet.last_request = request_id.into();
    let phase = pet.phase();
    Ok(Outcome { pet, phase, replayed: false })
}
