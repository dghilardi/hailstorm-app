#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

mod rest;

use axum::Router;
use axum::routing::post;
use std::net::SocketAddr;
use tauri::{CustomMenuItem, Menu, Submenu};
use tower_http::cors::CorsLayer;

fn main() {
    tauri::Builder::default()
        .menu(build_window_menu())
        .on_menu_event(|event| {
            let e: &str = event.menu_item_id();
            event.window().emit("menu_event", e).unwrap();
        })
        .setup(|_app| {
            tauri::async_runtime::spawn(spawn_http_server());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn spawn_http_server() -> impl std::future::Future<Output=()> + Send + 'static {
    Box::pin(async {
        let cors = CorsLayer::permissive();

        let app = Router::new()
            .route("/simulation/compute_shape", post(rest::expression::compute_shape))
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