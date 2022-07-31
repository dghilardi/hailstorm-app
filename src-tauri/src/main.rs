#![cfg_attr(
all(not(debug_assertions), target_os = "windows"),
windows_subsystem = "windows"
)]

mod rest;

use axum::Router;
use axum::routing::post;
use std::net::SocketAddr;
use axum::http::Method;
use tauri::Manager;
use tower_http::cors::CorsLayer;

fn main() {
    tauri::Builder::default()
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