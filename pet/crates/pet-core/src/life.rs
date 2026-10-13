use crate::codec::u64_string;
use alloc::string::String;
use serde::{Deserialize, Serialize};

const SATIETY_DECAY_TICKS: u64 = 6;
const ENERGY_DECAY_TICKS: u64 = 10;
const WARN_AT: u64 = 60;
const SICK_AT: u64 = 120;
const DEAD_AT: u64 = 360;
/// 超过该间隔视为休眠回归:最多推进到生病,不结算死亡。
const DORMANT_AFTER: u64 = 720;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Healthy,
    Warned,
    Sick,
    Dead,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Pet {
    pub id: String,
    pub satiety: u8,
    pub energy: u8,
    pub food: u32,
    pub medicine: u32,
    /// 持续失养的逻辑时间,决定预警、生病与死亡。
    #[serde(with = "u64_string")]
    pub neglect: u64,
    #[serde(with = "u64_string")]
    pub last_tick: u64,
    pub last_request: String,
}

impl Pet {
    pub fn newborn(id: String, at: u64) -> Self {
        Self { id, satiety: 80, energy: 80, food: 5, medicine: 1, neglect: 0, last_tick: at, last_request: String::new() }
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
#[serde(rename_all = "snake_case")]
pub enum Action {
    Feed,
    Rest,
    Play,
    Heal,
    Wait,
}

#[derive(Serialize)]
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
    pub fn code(&self) -> &'static str {
        match self {
            Self::Dead => "dead",
            Self::NoFood => "no_food",
            Self::NoMedicine => "no_medicine",
            Self::NotSick => "not_sick",
            Self::TooTired => "too_tired",
            Self::TimeBackwards => "time_backwards",
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

fn advance(p: &mut Pet, now: u64) -> Result<(), ActError> {
    if now < p.last_tick {
        return Err(ActError::TimeBackwards);
    }
    let dt = now - p.last_tick;
    let starving_at = p.satiety as u64 * SATIETY_DECAY_TICKS;
    p.satiety = (p.satiety as u64).saturating_sub(dt / SATIETY_DECAY_TICKS) as u8;
    p.energy = (p.energy as u64).saturating_sub(dt / ENERGY_DECAY_TICKS) as u8;
    let mut neglect = p.neglect + dt.saturating_sub(starving_at);
    if dt > DORMANT_AFTER {
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
            pet.satiety = (pet.satiety as u16 + 30).min(100) as u8;
            if pet.phase() != Phase::Sick {
                pet.neglect = 0;
            }
        }
        Action::Rest => pet.energy = (pet.energy as u16 + 40).min(100) as u8,
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
