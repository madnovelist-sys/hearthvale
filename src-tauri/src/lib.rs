// The desktop (and later mobile) shell around the web game in ../src.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Hearthwork");
}
