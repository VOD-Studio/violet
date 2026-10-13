use crate::codec::{hex, u64_string, unhex};
use crate::life::Pet;
use crate::rng::{hkdf, Channel};
use crate::RULES_VERSION;
use alloc::string::String;
use alloc::vec::Vec;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// 五档出生权重,单位万分比,合计 10000。
const RARITY_BP: [u64; 5] = [6000, 2500, 1000, 400, 100];
const SPECIES: u64 = 8;

#[derive(Deserialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct BirthInput {
    pub world: String,
    pub request_id: String,
    /// 服务端承诺并揭示的随机材料,64 位十六进制。
    pub server_seed: String,
    pub client_seed: String,
    #[serde(with = "u64_string")]
    #[cfg_attr(feature = "schema", schemars(with = "String"))]
    pub born_at: u64,
}

#[derive(Serialize)]
#[cfg_attr(feature = "schema", derive(schemars::JsonSchema))]
pub struct Birth {
    pub id: String,
    pub rarity: u8,
    pub species: u8,
    pub genes: [u8; 8],
    pub pet: Pet,
}

pub fn derive_birth(i: &BirthInput) -> Result<Birth, &'static str> {
    let s = unhex(&i.server_seed).filter(|v| v.len() == 32).ok_or("server_seed must be 32 bytes hex")?;
    let c = unhex(&i.client_seed).filter(|v| v.len() == 32).ok_or("client_seed must be 32 bytes hex")?;

    let mut ctx: Vec<u8> = Vec::new();
    for part in [&RULES_VERSION.to_be_bytes()[..], i.world.as_bytes(), i.request_id.as_bytes(), &s, &c] {
        ctx.extend_from_slice(&(part.len() as u32).to_be_bytes());
        ctx.extend_from_slice(part);
    }
    let root = hkdf(b"pet/birth", &ctx, b"root", 32);

    let mut gene = Channel::new(&root, "gene");
    let roll = gene.below(10_000);
    let mut acc = 0;
    let mut rarity = 0u8;
    for (idx, w) in RARITY_BP.iter().enumerate() {
        acc += w;
        if roll < acc {
            rarity = idx as u8;
            break;
        }
    }
    let species = gene.below(SPECIES) as u8;
    let mut genes = [0u8; 8];
    for g in genes.iter_mut() {
        *g = gene.below(256) as u8;
    }

    let mut h = Sha256::new();
    h.update(&root);
    let id = hex(&h.finalize()[..16]);

    Ok(Birth { id: id.clone(), rarity, species, genes, pet: Pet::newborn(id, i.born_at) })
}
