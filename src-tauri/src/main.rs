#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;

use actix::Addr;
use axum::{Extension, Router};
use axum::routing::{get, post};
use hailstorm::agent::builder::{AgentBuilder, SimulationParams};
use hailstorm::controller::embedded::{EmbeddedUpstream, StartEmbeddedController};
use hailstorm::simulation::rune::extension;
use hailstorm::simulation::rune::extension::env::EnvModuleConf;
use hailstorm::simulation::rune::extension::storage::initializer::empty::EmptyInitializer;
use hailstorm::simulation::rune::extension::storage::StorageModuleArgs;
use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{App, AppHandle, Emitter, Wry};
use tauri_plugin_cli::{CliExt, Matches};
use tauri_plugin_fs::FsExt;
use tower_http::cors::CorsLayer;

mod rest;

pub(crate) const LOCAL_AGENT_ID: u32 = 1998186;

fn main() {
    env_logger::init();

    log::debug!("Initializing agent runtime");
    let (exit_snd, exit_rcv) = tokio::sync::oneshot::channel();
    let handler = AgentBuilder::default()
        .agent_id(LOCAL_AGENT_ID)
        .upstream([(String::from("embedded"), ())].into_iter().collect())
        .rune_context_builder(|_sim| {
            let mut ctx = rune::Context::with_default_modules().expect("Error loading default rune modules");
            ctx.install(extension::storage::module(StorageModuleArgs::default().with_initializer(EmptyInitializer)).expect("Error initializing storage extension module")).expect("Error loading storage extension module");
            ctx.install(extension::env::module(EnvModuleConf::default().with_prefix("hsa")).expect("Error initializing env extension module")).expect("Error loading env extension module");
            ctx
        })
        .simulation_params(SimulationParams::default().max_running(1000).max_rate(100))
        .spawn::<EmbeddedUpstream>(exit_rcv);

    let client = handler.runtime.clients_ref().first()
        .expect("At least one client was expected")
        .clone();


    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .menu(build_window_menu)
        .on_menu_event(|app, event| {
            if let Err(err) = app.emit("menu_event", event.id().as_ref()) {
                log::error!("Error emitting menu event - {err}");
            }
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
    match app.cli().matches() {
        // `matches` here is a Struct with { args, subcommand }.
        // `args` is `HashMap<String, ArgData>` where `ArgData` is a struct with { value, occurances }.
        // `subcommand` is `Option<Box<SubcommandMatches>>` where `SubcommandMatches` is a struct with { name, matches }.
        Ok(Matches { args, .. }) => {
            let maybe_project = args.get("project")
                .and_then(|p| p.value.as_str())
                .map(|path_str| PathBuf::from(path_str.to_string()));
            if let Some(project_path) = maybe_project {
                if let Err(err) = app.fs_scope().allow_file(project_path) {
                    log::error!("Error adding project to allowlist - {err}");
                }
            }
        }
        Err(err) => {
            log::error!("Error parsing args - {err}")
        }
    }
}

fn spawn_http_server(client: Addr<EmbeddedUpstream>) -> impl std::future::Future<Output=()> + Send + 'static {
    Box::pin(async move {
        log::info!("Starting axum server");
        let controller = client.send(StartEmbeddedController).await
            .expect("Error starting the embedded controller");
        let cors = CorsLayer::permissive();

        // Same routes, responses and errors as the hailstorm service controller.
        let app = Router::new()
            .route("/hailstorm/shape/compute", post(rest::expression::compute_shape))
            .route("/hailstorm/simulation/load", post(rest::simulation::load_simulation))
            .route("/hailstorm/simulation/start", post(rest::simulation::start_simulation))
            .route("/hailstorm/simulation/stop", post(rest::simulation::stop_simulation))
            .route("/hailstorm/simulation/status", get(rest::simulation::simulation_status))
            .layer(Extension(controller))
            .layer(cors);

        let addr = SocketAddr::from(([127, 0, 0, 1], 54321));

        axum::Server::bind(&addr)
            .serve(app.into_make_service())
            .await
            .unwrap();
    })
}

fn build_window_menu(handle: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let file_new = MenuItemBuilder::with_id("new", "New").build(handle)?;
    let file_open = MenuItemBuilder::with_id("open", "Open")
        .accelerator("CmdOrControl+O")
        .build(handle)?;
    let file_save = MenuItemBuilder::with_id("save", "Save")
        .accelerator("CmdOrControl+S")
        .build(handle)?;
    let file_save_as = MenuItemBuilder::with_id("save-as", "Save As...")
        .accelerator("CmdOrControl+Shift+S")
        .build(handle)?;
    let file_menu = SubmenuBuilder::new(handle, "File")
        .item(&file_new)
        .item(&file_open)
        .item(&file_save)
        .item(&file_save_as)
        .build()?;

    MenuBuilder::new(handle)
        .item(&file_menu)
        .build()
}
