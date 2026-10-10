use std::time::SystemTime;

use actix::Addr;
use axum::{Extension, Json};
use axum::response::IntoResponse;
use hailstorm::controller::message::{LoadSimulation, StartSimulation};
use hailstorm::controller::model::simulation::{BotDef, SimulationDef};
use serde::{Deserialize, Serialize};
use crate::TauriUpstream;

#[derive(Deserialize)]
pub struct SimulationUser {
    pub model: String,
    pub shape: String,
}

impl From<SimulationUser> for BotDef {
    fn from(dto: SimulationUser) -> Self {
        Self::default().model(&dto.model).shape(&dto.shape)
    }
}

#[derive(Deserialize)]
pub struct LoadSimulationReqJson {
    pub users: Vec<SimulationUser>,
    pub script: String,
}

#[derive(Serialize)]
pub struct OperationResultJson {
    pub outcome: ActionOutcome,
}

#[derive(Serialize)]
pub enum ActionOutcome {
    #[serde(rename = "ok")]
    Ok,
}

impl From<LoadSimulationReqJson> for SimulationDef {
    fn from(req: LoadSimulationReqJson) -> Self {
        Self::default().bots(req.users.into_iter().map(Into::into).collect()).script(req.script)
    }
}

pub async fn load_simulation(
    Json(req): Json<LoadSimulationReqJson>,
    Extension(client): Extension<Addr<TauriUpstream>>,
) -> impl IntoResponse {
    let result = client.send(LoadSimulation::new(req.into())).await;
    if let Err(err) = result {
        log::error!("Error loading simulation - {err}");
    }
    Json(OperationResultJson { outcome: ActionOutcome::Ok })
}

pub async fn start_simulation(
    Extension(client): Extension<Addr<TauriUpstream>>,
) -> impl IntoResponse {
    let result = client.send(StartSimulation::at(SystemTime::now())).await;
    if let Err(err) = result {
        log::error!("Error starting simulation - {err}");
    }
    Json(OperationResultJson { outcome: ActionOutcome::Ok })
}