use std::time::{SystemTime, UNIX_EPOCH};

use actix::{Addr, MailboxError};
use axum::{Extension, Json};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use hailstorm::controller::actor::ControllerActor;
use hailstorm::controller::message::{GetSimulationStatus, LoadSimulation, SimulationControlError, SimulationOutcome, SimulationPhase, SimulationStatus, StartSimulation, StopSimulation};
use hailstorm::controller::model::simulation::{BotDef, SimulationDef};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct SimulationUser {
    pub model: String,
    pub shape: String,
}

impl From<SimulationUser> for BotDef {
    fn from(dto: SimulationUser) -> Self {
        Self::default()
            .model(&dto.model)
            .shape(&dto.shape)
    }
}

#[derive(Deserialize)]
pub struct LoadSimulationReqJson {
    pub users: Vec<SimulationUser>,
    pub script: String,
}

impl From<LoadSimulationReqJson> for SimulationDef {
    fn from(req: LoadSimulationReqJson) -> Self {
        Self::default()
            .bots(req.users.into_iter().map(Into::into).collect())
            .script(req.script)
    }
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

#[derive(Serialize)]
pub struct LoadSimulationResJson {
    pub simulation_id: String,
}

#[derive(Serialize)]
pub struct AgentStatusJson {
    pub agent_id: u32,
    pub state: String,
    pub simulation_id: String,
    pub error: Option<String>,
    pub last_update_ms: u64,
}

#[derive(Serialize)]
pub struct SimulationStatusJson {
    pub outcome: String,
    pub simulation_id: Option<String>,
    pub start_ts_ms: Option<u64>,
    pub agents: Vec<AgentStatusJson>,
}

fn epoch_millis(ts: SystemTime) -> u64 {
    ts.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or_default()
}

impl From<SimulationStatus> for SimulationStatusJson {
    fn from(status: SimulationStatus) -> Self {
        let outcome = match status.outcome() {
            SimulationOutcome::Idle => "idle",
            SimulationOutcome::Pending => "pending",
            SimulationOutcome::Ready => "ready",
            SimulationOutcome::Running => "running",
            SimulationOutcome::Failed => "failed",
        };
        Self {
            outcome: outcome.to_string(),
            start_ts_ms: match status.phase {
                SimulationPhase::Launched { start_ts } => Some(epoch_millis(start_ts)),
                _ => None,
            },
            simulation_id: status.simulation_id,
            agents: status.agents.into_iter()
                .map(|agent| AgentStatusJson {
                    agent_id: agent.agent_id,
                    state: agent.state.as_str_name().to_lowercase(),
                    simulation_id: agent.simulation_id,
                    error: agent.simulation_error,
                    last_update_ms: epoch_millis(agent.last_update),
                })
                .collect(),
        }
    }
}

/// Error body matching the hailstorm service responses.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorJson {
    error_code: &'static str,
    error_message: String,
}

pub struct ApiError(StatusCode, ErrorJson);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(self.1)).into_response()
    }
}

impl From<SimulationControlError> for ApiError {
    fn from(error: SimulationControlError) -> Self {
        let (status, code) = match &error {
            SimulationControlError::InvalidSimulation(_) => (StatusCode::BAD_REQUEST, "HAILSTORM:SIMULATION:INVALID"),
            SimulationControlError::NotLoaded => (StatusCode::CONFLICT, "HAILSTORM:SIMULATION:NOT_LOADED"),
        };
        Self(status, ErrorJson { error_code: code, error_message: error.to_string() })
    }
}

impl From<MailboxError> for ApiError {
    fn from(error: MailboxError) -> Self {
        Self(StatusCode::INTERNAL_SERVER_ERROR, ErrorJson {
            error_code: "COMMON:CORE:INTERNAL_ERROR",
            error_message: format!("Controller unavailable - {error}"),
        })
    }
}

pub async fn load_simulation(
    Extension(controller): Extension<Addr<ControllerActor>>,
    Json(req): Json<LoadSimulationReqJson>,
) -> Result<Json<LoadSimulationResJson>, ApiError> {
    let simulation_id = controller.send(LoadSimulation::new(req.into())).await??;
    Ok(Json(LoadSimulationResJson { simulation_id }))
}

pub async fn start_simulation(
    Extension(controller): Extension<Addr<ControllerActor>>,
) -> Result<Json<OperationResultJson>, ApiError> {
    controller.send(StartSimulation::at(SystemTime::now())).await??;
    Ok(Json(OperationResultJson { outcome: ActionOutcome::Ok }))
}

pub async fn stop_simulation(
    Extension(controller): Extension<Addr<ControllerActor>>,
) -> Result<Json<OperationResultJson>, ApiError> {
    controller.send(StopSimulation).await?;
    Ok(Json(OperationResultJson { outcome: ActionOutcome::Ok }))
}

pub async fn simulation_status(
    Extension(controller): Extension<Addr<ControllerActor>>,
) -> Result<Json<SimulationStatusJson>, ApiError> {
    Ok(Json(controller.send(GetSimulationStatus).await?.into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::LOCAL_AGENT_ID;
    use hailstorm::agent::builder::{AgentBuilder, SimulationParams};
    use hailstorm::controller::embedded::{EmbeddedUpstream, StartEmbeddedController};
    use std::sync::{Arc, atomic::{AtomicUsize, Ordering}};
    use std::time::Duration;

    const SCRIPT: &str = r#"
        struct Bot;
        impl Bot {
            pub fn new(args) { Self }
            pub fn register_bot(bot) {
                bot.set_interval_millis(20);
                bot.register_action(hailstorm::bot::ActionTrigger::alive(1.0), Self::action);
            }
            pub fn action(self) { test::acted(); }
        }
    "#;

    fn request(model: &str, shape: &str) -> Json<LoadSimulationReqJson> {
        Json(LoadSimulationReqJson {
            users: vec![SimulationUser { model: model.into(), shape: shape.into() }],
            script: SCRIPT.into(),
        })
    }

    async fn wait_for_outcome(controller: &Addr<ControllerActor>, expected: &str) -> SimulationStatusJson {
        tokio::time::timeout(Duration::from_secs(20), async {
            loop {
                let Ok(Json(status)) = simulation_status(Extension(controller.clone())).await else { panic!("status failed") };
                if status.outcome == expected {
                    return status;
                }
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        }).await.unwrap_or_else(|_| panic!("timed out waiting for {expected}"))
    }

    #[actix::test]
    async fn desktop_commands_load_start_and_stop_a_real_rune_bot() {
        let actions = Arc::new(AtomicUsize::new(0));
        let action_counter = actions.clone();
        let runtime = AgentBuilder::default()
            .agent_id(LOCAL_AGENT_ID)
            .upstream([(String::from("embedded"), ())].into_iter().collect())
            .simulation_params(SimulationParams::default().max_running(1).max_rate(1))
            .rune_context_builder(move |_| {
                let mut context = rune::Context::with_default_modules().unwrap();
                let mut native = rune::Module::with_crate("test").unwrap();
                native.function("acted", move || { action_counter.fetch_add(1, Ordering::SeqCst); }).build().unwrap();
                context.install(native).unwrap();
                context
            })
            .launch::<EmbeddedUpstream>();
        let controller = runtime.clients_ref()[0].send(StartEmbeddedController).await.unwrap();
        let controller = || Extension(controller.clone());

        let Err(ApiError(status, _)) = start_simulation(controller()).await else { panic!("start must fail") };
        assert_eq!(status, StatusCode::CONFLICT);
        let Err(ApiError(status, _)) = load_simulation(controller(), request("Bot", "10 *")).await else { panic!("load must fail") };
        assert_eq!(status, StatusCode::BAD_REQUEST);

        let Ok(Json(loaded)) = load_simulation(controller(), request("Bot", "1")).await else { panic!("load failed") };
        let ready = wait_for_outcome(&controller().0, "ready").await;
        assert_eq!(ready.simulation_id.as_deref(), Some(loaded.simulation_id.as_str()));
        assert_eq!(ready.agents[0].agent_id, LOCAL_AGENT_ID);
        assert_eq!(actions.load(Ordering::SeqCst), 0, "loading must not start the bot");

        assert!(start_simulation(controller()).await.is_ok());
        wait_for_outcome(&controller().0, "running").await;
        tokio::time::timeout(Duration::from_secs(5), async {
            while actions.load(Ordering::SeqCst) == 0 { tokio::time::sleep(Duration::from_millis(50)).await; }
        }).await.expect("the bot must run its action");

        assert!(stop_simulation(controller()).await.is_ok());
        wait_for_outcome(&controller().0, "idle").await;
    }
}
