use std::collections::HashMap;
use axum::Json;
use axum::response::IntoResponse;
use hailstorm::simulation::actor::simulation::SimulationActor;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct ComputeShapeReq {
    xmax: u32,
    resolution: u32,
    models: HashMap<String, String>,
}

#[derive(Serialize)]
pub struct ComputeShapeRes {
    x: Vec<u32>,
    y: HashMap<String, Vec<u32>>,
}

pub async fn compute_shape(Json(payload): Json<ComputeShapeReq>) -> impl IntoResponse {
    let step = payload.xmax as f32 / (payload.resolution-1) as f32;
    let xs = (0..payload.resolution)
        .into_iter()
        .map(|idx| (step * (idx as f32)) as u32)
        .collect::<Vec<_>>();
    Json(ComputeShapeRes {
        y: compute_shapes(&xs, payload.models),
        x: xs,
    })
}

fn compute_shapes(xs: &[u32], models: HashMap<String, String>) -> HashMap<String, Vec<u32>> {
    models.into_iter()
        .filter_map(|(name, expr)| evaluate_shape(xs, expr).ok().map(|ys| (name, ys)))
        .collect()
}

fn evaluate_shape(xs: &[u32], expression: String) -> Result<Vec<u32>, meval::Error> {
    let shape_fun = SimulationActor::parse_shape_fun(expression)?;
    let res = xs.iter()
        .map(|x| shape_fun(*x as f64) as u32)
        .collect();
    Ok(res)
}