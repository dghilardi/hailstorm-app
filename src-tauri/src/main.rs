#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;

use actix::{Addr, System};
use axum::{Extension, Router};
use axum::routing::post;
use hailstorm::agent::builder::AgentBuilder;
use hailstorm::simulation::actor::simulation::SimulationParams;
use hailstorm::simulation::rune::extension;
use hailstorm::simulation::rune::extension::env::EnvModuleConf;
use hailstorm::simulation::rune::extension::storage::initializer::empty::EmptyInitializer;
use hailstorm::simulation::rune::extension::storage::StorageModuleArgs;
use tauri::{App, CustomMenuItem, Manager, Menu, Submenu, Wry};
use tauri::api::cli::Matches;
use tauri::async_runtime::TokioRuntime;
use tokio::time::{Duration, sleep};
use tower_http::cors::CorsLayer;

use crate::hlst::tauri_upstream::TauriUpstream;

mod rest;
mod hlst;
fn main() {
    env_logger::init();

    log::debug!("Initializing agent runtime");
    let (exit_snd, exit_rcv) = tokio::sync::oneshot::channel();
    let handler = AgentBuilder {
        agent_id: 1998186,
        downstream: (),
        upstream: [(String::from("tauri"), ())].into_iter().collect(),
        rune_context_builder:  |_sim| {
            let mut ctx = rune::Context::with_default_modules().expect("Error loading default rune modules");
            ctx.install(&extension::storage::module(StorageModuleArgs { initializer: EmptyInitializer } ).expect("Error initializing storage extension module")).expect("Error loading storage extension module");
            ctx.install(&extension::env::module(EnvModuleConf { prefix: Some(String::from("hsa")) }).expect("Error initializing env extension module")).expect("Error loading env extension module");

            ctx
        },
        simulation_params: SimulationParams {
            max_running: Some(1000),
            max_rate: Some(100),
        },
    }.spawn::<TauriUpstream>(exit_rcv);

    let client = handler.runtime.clients.get(0)
        .expect("At least one client was expected")
        .clone();


    tauri::Builder::default()
        .menu(build_window_menu())
        .on_menu_event(|event| {
            let e: &str = event.menu_item_id();
            event.window().emit("menu_event", e).unwrap();
        })
        .setup(|app| {
            handle_args(&app);

            log::debug!("Initializing axum server");
            tauri::async_runtime::spawn(spawn_http_server(client));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    exit_snd.send(()).expect("Error sending exit signal");
    handler.handle.join().expect("Error joining agent thread");

}

fn handle_args(app: &App<Wry>) {
    match app.get_cli_matches() {
        // `matches` here is a Struct with { args, subcommand }.
        // `args` is `HashMap<String, ArgData>` where `ArgData` is a struct with { value, occurances }.
        // `subcommand` is `Option<Box<SubcommandMatches>>` where `SubcommandMatches` is a struct with { name, matches }.
        Ok(Matches { args, .. }) => {
            let maybe_project = args.get("project")
                .and_then(|p| p.value.as_str())
                .map(|path_str| PathBuf::from(path_str.to_string()));
            if let Some(project_path) = maybe_project {
                app.fs_scope().allow_file(project_path)
                    .expect("Error adding project to allowlist");
            }
        }
        Err(err) => {
            log::error!("Error parsing args - {err}")
        }
    }
}

fn spawn_http_server(client: Addr<TauriUpstream>) -> impl std::future::Future<Output=()> + Send + 'static {
    Box::pin(async {
        log::info!("Starting axum server");
        let cors = CorsLayer::permissive();

        let app = Router::new()
            .route("/hailstorm/shape/compute", post(rest::expression::compute_shape))
            .route("/hailstorm/simulation/load", post(rest::simulation::load_simulation))
            .route("/hailstorm/simulation/start", post(rest::simulation::start_simulation))
            .layer(Extension(client))
            .layer(cors);

        let addr = SocketAddr::from(([127, 0, 0, 1], 54321));

        axum::Server::bind(&addr)
            .serve(app.into_make_service())
            .await
            .unwrap();
    })
}

fn build_window_menu() -> Menu {
    let file_new = CustomMenuItem::new("new".to_string(), "New");
    let file_open = CustomMenuItem::new("open".to_string(), "Open")
        .accelerator("CmdOrControl+O");
    let file_save = CustomMenuItem::new("save".to_string(), "Save")
        .accelerator("CmdOrControl+S");
    let file_save_as = CustomMenuItem::new("save-as", "Save As...")
        .accelerator("CmdOrControl+Shift+S");
    let file_menu = Submenu::new("File",
                                 Menu::new()
                                     .add_item(file_new)
                                     .add_item(file_open)
                                     .add_item(file_save)
                                     .add_item(file_save_as),
    );

    Menu::new()
        .add_submenu(file_menu)
}