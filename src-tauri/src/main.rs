#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "macos")]
mod window_appearance;
mod persistence;
mod time_engine;

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(persistence::DATABASE_URL, persistence::migrations())
                .build(),
        )
        .manage(time_engine::TimeEngineGate::default())
        .invoke_handler(tauri::generate_handler![
            time_engine::start_task,
            time_engine::pause_task,
            time_engine::switch_task,
            time_engine::complete_active_task,
        ])
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            if matches!(event, tauri::WindowEvent::Focused(_)) {
                window_appearance::update_opacity(window);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (window, event);
        })
        .run(tauri::generate_context!())
        .expect("error while running DevDesk");
}
