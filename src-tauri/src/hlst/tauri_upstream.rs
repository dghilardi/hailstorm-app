use actix::{Actor, ActorFutureExt, AtomicResponse, Context, Handler, WrapFuture};
use actix::dev::Request;
use hailstorm::agent::actor::{AgentCoreActor, ConnectedClientMessage};
use hailstorm::UpstreamAgentActor;
use hailstorm::controller::message::{LoadSimulation, StartSimulation};
use hailstorm::controller::model::simulation::SimulationState;
use hailstorm::grpc::{AgentDistribution, ControllerCommand, CommandItem, StopCommand, LoadSimCommand, LaunchCommand};
use hailstorm::grpc::command_item::Command;
use crate::LOCAL_AGENT_ID;
pub struct TauriUpstream {
    core_addr: actix::Addr<AgentCoreActor>,
    simulation: SimulationState,
}

impl Actor for TauriUpstream {
    type Context = Context<Self>;
}

impl TauriUpstream {
    fn send_simulation_state(&self) -> Request<AgentCoreActor, ConnectedClientMessage> {
        self.core_addr.send(ConnectedClientMessage::new( ControllerCommand {
                commands: self.generate_simulation_state_commands()
                    .into_iter().map(|cmd| CommandItem { command: Some(cmd) }).collect(),
                target: None,
            }
        ))
    }

    fn generate_simulation_state_commands(&self) -> Vec<Command> {
        let agents_count = 1;
        match &self.simulation {
            SimulationState::Idle => vec![
                Command::Stop(StopCommand { reset: true }),
                Command::UpdateAgentsCount(agents_count as u32),
                Command::UpdateAgents(AgentDistribution { agent_ids: vec![LOCAL_AGENT_ID] }),
            ],
            SimulationState::Ready { simulation } => vec![
                Command::Stop(StopCommand { reset: true }),
                Command::UpdateAgentsCount(agents_count as u32),
                Command::UpdateAgents(AgentDistribution { agent_ids: vec![LOCAL_AGENT_ID] }),
                Command::Load(LoadSimCommand {
                    clients_evolution: simulation.bots_ref().iter()
                        .cloned().map(Into::into)
                        .collect(),
                    script: simulation.script_ref().to_string(),
                }),
            ],
            SimulationState::Launched { start_ts, simulation, } => vec![
                Command::Stop(StopCommand { reset: true }),
                Command::UpdateAgentsCount(agents_count as u32),
                Command::UpdateAgents(AgentDistribution { agent_ids: vec![LOCAL_AGENT_ID] }),
                Command::Load(LoadSimCommand {
                    clients_evolution: simulation.bots_ref().iter()
                        .cloned().map(Into::into)
                        .collect(),
                    script: simulation.script_ref().to_string(),
                }),
                Command::Launch(LaunchCommand { start_ts: Some((*start_ts).into()) }),
            ],
        }
    }
}

impl UpstreamAgentActor for TauriUpstream {
    type Config = ();
    type InitializationError = std::io::Error;

    fn new(_cfg: Self::Config, core_addr: actix::Addr<AgentCoreActor>) -> Result<Self, Self::InitializationError> {
        Ok(Self {
            core_addr,
            simulation: SimulationState::Idle,
        })
    }
}

impl Handler<LoadSimulation> for TauriUpstream {
    type Result = AtomicResponse<Self, ()>;

    fn handle(&mut self, command: LoadSimulation, _ctx: &mut Self::Context) -> Self::Result {
        self.simulation = SimulationState::Ready {
            simulation: command.extract_definition(),
        };

        AtomicResponse::new(Box::pin(async {}.into_actor(self)
            .then(|_, act, _ctx| act.send_simulation_state().into_actor(act))
            .map(|res, _, _| if let Err(err) = res {
                log::error!("Error sending load-sim command - {err}");
            })
        ))
    }
}

impl Handler<StartSimulation> for TauriUpstream {
    type Result = AtomicResponse<Self, ()>;

    fn handle(&mut self, command: StartSimulation, _ctx: &mut Self::Context) -> Self::Result {
        let start_ts = command.extract_ts();
        self.simulation = match &self.simulation {
            SimulationState::Idle => {
                log::warn!("Ignoring StartSimulation command as state is idle");
                SimulationState::Idle
            }
            SimulationState::Ready { simulation } => SimulationState::Launched { start_ts, simulation: simulation.clone() },
            SimulationState::Launched { simulation, .. } => SimulationState::Launched { start_ts, simulation: simulation.clone() },
        };

        AtomicResponse::new(Box::pin(async move {}.into_actor(self)
            .then(|_, act, _ctx| act.send_simulation_state().into_actor(act))
            .map(|res, _, _| if let Err(err) = res {
                log::error!("Error sending load-sim command - {err}");
            })
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hailstorm::agent::builder::{AgentBuilder, SimulationParams};
    use hailstorm::controller::model::simulation::{BotDef, SimulationDef};
    use std::{sync::{Arc, atomic::{AtomicUsize, Ordering}}, time::{Duration, SystemTime}};

    #[actix::test]
    async fn desktop_commands_load_and_start_a_real_rune_bot() {
        let actions = Arc::new(AtomicUsize::new(0));
        let action_counter = actions.clone();
        let entered = Arc::new(tokio::sync::Notify::new());
        let action_entered = entered.clone();
        let runtime = AgentBuilder::default()
            .agent_id(LOCAL_AGENT_ID)
            .upstream([(String::from("desktop"), ())].into_iter().collect())
            .simulation_params(SimulationParams::default().max_running(1).max_rate(1))
            .rune_context_builder(move |_| {
                let mut context = rune::Context::with_default_modules().unwrap();
                let mut native = rune::Module::with_crate("test").unwrap();
                native.function("acted", move || {
                    action_counter.fetch_add(1, Ordering::SeqCst);
                    action_entered.notify_one();
                }).build().unwrap();
                context.install(native).unwrap();
                context
            })
            .launch::<TauriUpstream>();
        let upstream = runtime.clients_ref().first().unwrap();
        let simulation = SimulationDef::default()
            .bots(vec![BotDef::default().model("Bot").shape("1")])
            .script(r#"
                struct Bot;
                impl Bot {
                    pub fn new(args) { Self }
                    pub fn register_bot(bot) {
                        bot.set_interval_millis(20);
                        bot.register_action(hailstorm::bot::ActionTrigger::alive(1.0), Self::action);
                    }
                    pub fn action(self) { test::acted(); }
                }
            "#.to_string());
        upstream.send(LoadSimulation::new(simulation)).await.unwrap();
        tokio::time::sleep(Duration::from_millis(1750)).await;
        assert_eq!(actions.load(Ordering::SeqCst), 0, "loading must not start the bot");
        upstream.send(StartSimulation::at(SystemTime::now())).await.unwrap();
        tokio::time::timeout(Duration::from_secs(5), entered.notified()).await.unwrap();
        assert!(actions.load(Ordering::SeqCst) > 0);
    }
}
