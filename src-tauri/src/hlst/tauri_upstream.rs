use actix::{Actor, ActorFutureExt, AtomicResponse, Context, Handler, WrapFuture};
use actix::dev::Request;
use hailstorm::agent::actor::{AgentCoreActor, ConnectedClientMessage};
use hailstorm::communication::upstream::contract::UpstreamAgentActor;
use hailstorm::controller::controller_actor::{ControllerActor, LoadSimulation, StartSimulation};
use hailstorm::controller::model::simulation::SimulationState;
use hailstorm::grpc::{ControllerCommand, CommandItem, StopCommand, LoadSimCommand, LaunchCommand};
use hailstorm::grpc::command_item::Command;
pub struct TauriUpstream {
    core_addr: actix::Addr<AgentCoreActor>,
    simulation: SimulationState,
}

impl Actor for TauriUpstream {
    type Context = Context<Self>;
}

impl TauriUpstream {
    fn send_simulation_state(&self) -> Request<AgentCoreActor, ConnectedClientMessage> {
        self.core_addr.send(ConnectedClientMessage {
            message: ControllerCommand {
                commands: self.generate_simulation_state_commands()
                    .into_iter().map(|cmd| CommandItem { command: Some(cmd) }).collect(),
                target: None,
            }
        })
    }

    fn generate_simulation_state_commands(&self) -> Vec<Command> {
        let agents_count = 1;
        match &self.simulation {
            SimulationState::Idle => vec![
                Command::Stop(StopCommand { reset: true }),
                Command::UpdateAgentsCount(agents_count as u32),
            ],
            SimulationState::Ready { simulation } => vec![
                Command::Stop(StopCommand { reset: true }),
                Command::UpdateAgentsCount(agents_count as u32),
                Command::Load(LoadSimCommand {
                    clients_evolution: simulation.bots.iter()
                        .cloned().map(Into::into)
                        .collect(),
                    script: simulation.script.clone(),
                }),
            ],
            SimulationState::Launched { start_ts, simulation, } => vec![
                Command::Stop(StopCommand { reset: true }),
                Command::UpdateAgentsCount(agents_count as u32),
                Command::Load(LoadSimCommand {
                    clients_evolution: simulation.bots.iter()
                        .cloned().map(Into::into)
                        .collect(),
                    script: simulation.script.clone(),
                }),
                Command::Launch(LaunchCommand { start_ts: Some((*start_ts).into()) }),
            ],
        }
    }
}

impl UpstreamAgentActor for TauriUpstream {
    type Config = ();
    type InitializationError = std::io::Error;

    fn new(cfg: Self::Config, core_addr: actix::Addr<AgentCoreActor>) -> Result<Self, Self::InitializationError> {
        Ok(Self {
            core_addr,
            simulation: SimulationState::Idle,
        })
    }
}

impl Handler<LoadSimulation> for TauriUpstream {
    type Result = AtomicResponse<Self, ()>;

    fn handle(&mut self, LoadSimulation(simulation): LoadSimulation, _ctx: &mut Self::Context) -> Self::Result {
        self.simulation = SimulationState::Ready {
            simulation
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

    fn handle(&mut self, StartSimulation(start_ts): StartSimulation, _ctx: &mut Self::Context) -> Self::Result {
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