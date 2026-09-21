use objc2_app_kit::NSWindow;

pub fn update_opacity(window: &tauri::Window) {
    let target = window.clone();
    // AppKit access must occur on the main thread. Read the current focus state
    // there too, so a queued event cannot apply an outdated opacity.
    if let Err(error) = window.run_on_main_thread(move || {
        let result = (|| -> tauri::Result<()> {
            let focused = target.is_focused()?;
            let pointer = target.ns_window()?;
            // SAFETY: Tauri owns this live NSWindow; the reference is only used
            // synchronously on the main thread and never stored.
            let native_window = unsafe { &*pointer.cast::<NSWindow>() };
            native_window.setAlphaValue(if focused { 1.0 } else { 0.65 });
            Ok(())
        })();
        if let Err(error) = result {
            eprintln!("Could not update DevDesk window opacity: {error}");
        }
    }) {
        eprintln!("Could not schedule DevDesk window opacity update: {error}");
    }
}
