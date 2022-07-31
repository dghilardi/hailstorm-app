use std::collections::HashMap;
use axum::Json;
use axum::response::IntoResponse;
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
    let mut ctx = meval::Context::new();
    ctx.func("rect", |x| if x.abs() > 0.5 { 0.0 } else if x.abs() == 0.5 { 0.5 } else { 1.0 })
        .func("tri", |x| if x.abs() < 1.0 { 1.0 - x.abs() } else { 0.0 })
        .func("step", |x| if x < 0.0 { 0.0 } else if x == 0.0 { 0.5 } else { 1.0 })
    ;

    models.into_iter()
        .filter_map(|(name, expr)| evaluate_shape(ctx.clone(), xs, expr).ok().map(|ys| (name, ys)))
        .collect()
}

fn evaluate_shape(ctx: meval::Context, xs: &[u32], expression: String) -> Result<Vec<u32>, meval::Error> {
    let expr: meval::Expr = expression.parse()?;
    let shape_fun = expr.bind_with_context(ctx, "t")?;
    let res = xs.iter()
        .map(|x| shape_fun(*x as f64) as u32)
        .collect();
    Ok(res)
}