use tauri::{command, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem, WindowEvent};

#[cfg(target_os = "macos")]
use cocoa::base::id;
#[cfg(target_os = "macos")]
use objc::runtime::YES;
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};

#[command]
fn update_window_spaces(app_handle: tauri::AppHandle, show_on_all_spaces: bool) {
    #[cfg(target_os = "macos")]
    {
        if let Some(main_window) = app_handle.get_window("main") {
            if let Ok(ns_window) = main_window.ns_window() {
                unsafe {
                    let ns_window: id = ns_window as *mut std::ffi::c_void as id;
                    
                    let mut collection_behavior: i32 = 0;
                    
                    if show_on_all_spaces {
                        collection_behavior |= 1 << 0; // NSWindowCollectionBehaviorCanJoinAllSpaces
                        collection_behavior |= 1 << 4; // NSWindowCollectionBehaviorStationary (always stay in place when on all spaces)
                    } else {
                        // Reset to normal window behavior
                        collection_behavior = 0;
                    }
                    
                    let _: () = msg_send![ns_window, setCollectionBehavior: collection_behavior];
                    println!("Updated window spaces: show_on_all_spaces={}", show_on_all_spaces);
                }
            }
        }
    }
}

#[command]
fn set_window_position(app_handle: tauri::AppHandle, grid_position: i32, random_position: bool, manual_position: bool, manual_x: f64, manual_y: f64, auto_detect_grid: bool, manual_grid_cols: i32, manual_grid_rows: i32, preferred_monitor: String) {
    use tauri::LogicalPosition;
    
    // Get target monitor based on preference
    let (screen_size, screen_offset) = if let Some(main_window) = app_handle.get_window("main") {
        if let Ok(all_monitors) = main_window.available_monitors() {
            // Get current monitor info for comparison
            let current_monitor_pos = if let Ok(current_monitor) = main_window.current_monitor() {
                if let Some(monitor) = current_monitor {
                    let pos = monitor.position();
                    Some((pos.x as f64, pos.y as f64))
                } else {
                    None
                }
            } else {
                None
            };
            
            let target_monitor = match preferred_monitor.as_str() {
                "primary" => {
                    // Use first monitor (typically primary)
                    if !all_monitors.is_empty() {
                        Some(&all_monitors[0])
                    } else {
                        None
                    }
                },
                "current" => {
                    // Use current monitor where window is by finding it in all_monitors
                    if let Some((curr_x, curr_y)) = current_monitor_pos {
                        all_monitors.iter().find(|monitor| {
                            let pos = monitor.position();
                            pos.x as f64 == curr_x && pos.y as f64 == curr_y
                        })
                    } else {
                        None
                    }
                },
                monitor_index if monitor_index.parse::<usize>().is_ok() => {
                    // Use specific monitor by index
                    let idx = monitor_index.parse::<usize>().unwrap();
                    if idx < all_monitors.len() {
                        Some(&all_monitors[idx])
                    } else {
                        None
                    }
                },
                _ => {
                    // "auto" or unknown - use current monitor
                    if let Some((curr_x, curr_y)) = current_monitor_pos {
                        all_monitors.iter().find(|monitor| {
                            let pos = monitor.position();
                            pos.x as f64 == curr_x && pos.y as f64 == curr_y
                        })
                    } else {
                        None
                    }
                }
            };
            
            if let Some(monitor) = target_monitor {
                let size = monitor.size();
                let pos = monitor.position();
                ((size.width as f64, size.height as f64), (pos.x as f64, pos.y as f64))
            } else {
                // Fallback to first available monitor or default
                if !all_monitors.is_empty() {
                    let monitor = &all_monitors[0];
                    let size = monitor.size();
                    let pos = monitor.position();
                    ((size.width as f64, size.height as f64), (pos.x as f64, pos.y as f64))
                } else {
                    ((1920.0, 1080.0), (0.0, 0.0)) // Fallback
                }
            }
        } else {
            ((1920.0, 1080.0), (0.0, 0.0)) // Fallback
        }
    } else {
        ((1920.0, 1080.0), (0.0, 0.0)) // Fallback
    };
    
    let window_size = (400.0, 300.0); // Window dimensions from config
    
    let (x, y) = if manual_position {
        // Use manual position set by dragging (already in screen coordinates)
        (manual_x, manual_y)
    } else if random_position {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        use std::time::{SystemTime, UNIX_EPOCH};
        
        // Generate random position using time as seed
        let mut hasher = DefaultHasher::new();
        SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos().hash(&mut hasher);
        let hash = hasher.finish();
        
        let margin = 100.0;
        let max_x = screen_size.0 - window_size.0 - margin;
        let max_y = screen_size.1 - window_size.1 - margin;
        
        let relative_x = margin + ((hash % max_x as u64) as f64);
        let relative_y = margin + (((hash >> 32) % max_y as u64) as f64);
        
        // Add monitor offset for correct monitor positioning
        let x = screen_offset.0 + relative_x;
        let y = screen_offset.1 + relative_y;
        (x, y)
    } else {
        // Calculate grid dimensions - use manual override or auto-detect
        let (cols, rows) = if auto_detect_grid {
            let aspect_ratio = screen_size.0 / screen_size.1;
            println!("Auto-detecting grid based on aspect ratio: {}", aspect_ratio);
            
            if aspect_ratio > 2.0 {
                println!("Ultra-wide detected: 6x3 grid");
                (6, 3)
            } else if aspect_ratio > 1.8 {
                println!("Wide screen detected: 5x3 grid");
                (5, 3)
            } else if aspect_ratio > 1.5 {
                println!("Standard wide detected: 4x3 grid");
                (4, 3)
            } else {
                println!("Square-ish screen detected: 3x4 grid");
                (3, 4)
            }
        } else {
            println!("Using manual grid override: {}x{}", manual_grid_cols, manual_grid_rows);
            (manual_grid_cols, manual_grid_rows)
        };
        
        let total_positions = cols * rows;
        let safe_position = grid_position % total_positions; // Ensure we don't overflow
        
        let row = safe_position / cols;
        let col = safe_position % cols;
        
        println!("Grid position {} -> row:{}, col:{} in {}x{} grid", grid_position, row, col, cols, rows);
        
        let margin = 50.0;
        let available_width = screen_size.0 - window_size.0 - (2.0 * margin);
        let available_height = screen_size.1 - window_size.1 - (2.0 * margin);
        
        // For single column/row, center it. Otherwise distribute evenly
        let relative_x = if cols == 1 {
            margin + available_width / 2.0
        } else {
            margin + (col as f64 * available_width / (cols - 1) as f64)
        };
        
        let relative_y = if rows == 1 {
            margin + available_height / 2.0
        } else {
            margin + (row as f64 * available_height / (rows - 1) as f64)
        };
        
        // Add monitor offset to position on correct monitor
        let x = screen_offset.0 + relative_x;
        let y = screen_offset.1 + relative_y;
        (x, y)
    };
    
    // Get the main window specifically
    if let Some(main_window) = app_handle.get_window("main") {
        println!("Monitor: {}x{} at offset ({}, {}), Setting position to ({}, {}) - grid:{}, random:{}, manual:{}, monitor:{}", 
                screen_size.0, screen_size.1, screen_offset.0, screen_offset.1, x, y, grid_position, random_position, manual_position, preferred_monitor);
        let _ = main_window.set_position(LogicalPosition::new(x, y));
    } else {
        println!("Warning: Could not find main window to set position");
    }
}

#[command]
fn get_all_monitors_info(app_handle: tauri::AppHandle) -> Vec<(i32, f64, f64, f64, f64, bool)> {
    let mut monitors_info = Vec::new();
    
    if let Some(main_window) = app_handle.get_window("main") {
        if let Ok(all_monitors) = main_window.available_monitors() {
            for (index, monitor) in all_monitors.iter().enumerate() {
                let size = monitor.size();
                let position = monitor.position();
                let is_primary = index == 0; // First monitor is typically primary
                
                monitors_info.push((
                    index as i32,
                    position.x as f64,
                    position.y as f64,
                    size.width as f64,
                    size.height as f64,
                    is_primary
                ));
            }
        }
    }
    
    if monitors_info.is_empty() {
        // Fallback if no monitors detected
        monitors_info.push((0, 0.0, 0.0, 1920.0, 1080.0, true));
    }
    
    monitors_info
}

#[command]
fn get_screen_info(app_handle: tauri::AppHandle, auto_detect_grid: bool, manual_grid_cols: i32, manual_grid_rows: i32) -> (f64, f64, i32, i32) {
    if let Some(main_window) = app_handle.get_window("main") {
        if let Ok(monitor) = main_window.current_monitor() {
            if let Some(monitor) = monitor {
                let size = monitor.size();
                let aspect_ratio = size.width as f64 / size.height as f64;
                
                let (cols, rows) = if auto_detect_grid {
                    // Auto-detect based on aspect ratio
                    let grid = if aspect_ratio > 2.0 {
                        (6, 3) // Ultra-wide
                    } else if aspect_ratio > 1.8 {
                        (5, 3) // Wide
                    } else if aspect_ratio > 1.5 {
                        (4, 3) // Standard
                    } else {
                        (3, 4) // Square-ish
                    };
                    println!("get_screen_info: Auto-detecting grid {}x{} for aspect ratio {:.2}", grid.0, grid.1, aspect_ratio);
                    grid
                } else {
                    // Use manual grid override
                    println!("get_screen_info: Using manual grid override {}x{}", manual_grid_cols, manual_grid_rows);
                    (manual_grid_cols, manual_grid_rows)
                };
                
                return (size.width as f64, size.height as f64, cols, rows);
            }
        }
    }
    (1920.0, 1080.0, 4, 3) // Fallback
}

#[command]
fn save_manual_position(app_handle: tauri::AppHandle) -> (f64, f64) {
    if let Some(main_window) = app_handle.get_window("main") {
        if let Ok(position) = main_window.outer_position() {
            let x = position.x as f64;
            let y = position.y as f64;
            println!("Saving manual position: ({}, {})", x, y);
            return (x, y);
        }
    }
    (100.0, 100.0) // Fallback
}

#[command]
fn show_settings_window(app_handle: tauri::AppHandle) {
    if let Some(settings_window) = app_handle.get_window("settings") {
        // Get main window position and size
        if let Some(main_window) = app_handle.get_window("main") {
            if let (Ok(main_pos), Ok(main_size)) = (main_window.outer_position(), main_window.outer_size()) {
                // Get all available monitors
                if let Ok(all_monitors) = main_window.available_monitors() {
                    // Find which monitor the main window is on
                    let main_x = main_pos.x as f64;
                    let main_y = main_pos.y as f64;
                    let main_w = main_size.width as f64;
                    let main_h = main_size.height as f64;
                    let main_center_x = main_x + main_w / 2.0;
                    let main_center_y = main_y + main_h / 2.0;
                    
                    let mut target_monitor = None;
                    
                    // Find the monitor containing the center of the main window
                    for monitor in &all_monitors {
                        let mon_pos = monitor.position();
                        let mon_size = monitor.size();
                        let mon_x = mon_pos.x as f64;
                        let mon_y = mon_pos.y as f64;
                        let mon_w = mon_size.width as f64;
                        let mon_h = mon_size.height as f64;
                        
                        if main_center_x >= mon_x && main_center_x < mon_x + mon_w &&
                           main_center_y >= mon_y && main_center_y < mon_y + mon_h {
                            target_monitor = Some((mon_x, mon_y, mon_w, mon_h));
                            break;
                        }
                    }
                    
                    // Fallback to first monitor if main window monitor not found
                    if target_monitor.is_none() && !all_monitors.is_empty() {
                        let monitor = &all_monitors[0];
                        let mon_pos = monitor.position();
                        let mon_size = monitor.size();
                        target_monitor = Some((mon_pos.x as f64, mon_pos.y as f64, mon_size.width as f64, mon_size.height as f64));
                    }
                    
                    if let Some((screen_x, screen_y, screen_w, screen_h)) = target_monitor {
                        // Settings window size (from tauri.conf.json)
                        let settings_width = 400.0;
                        let settings_height = 600.0;
                        
                        // Try different positions in order of preference
                        let mut settings_x = screen_x + (screen_w - settings_width) / 2.0; // default center
                        let mut settings_y = screen_y + (screen_h - settings_height) / 2.0;
                        
                        let gap = 20.0;
                        let buffer = 50.0; // Extra space to ensure fit
                        
                        // 1. Try to the right of main window (same monitor)
                        if main_x + main_w + settings_width + gap + buffer <= screen_x + screen_w {
                            settings_x = main_x + main_w + gap;
                            settings_y = main_y.max(screen_y).min(screen_y + screen_h - settings_height);
                        }
                        // 2. Try to the left of main window (same monitor)
                        else if main_x - settings_width - gap >= screen_x + buffer {
                            settings_x = main_x - settings_width - gap;
                            settings_y = main_y.max(screen_y).min(screen_y + screen_h - settings_height);
                        }
                        // 3. Try below main window (same monitor)
                        else if main_y + main_h + settings_height + gap <= screen_y + screen_h - buffer {
                            settings_x = main_x.max(screen_x).min(screen_x + screen_w - settings_width);
                            settings_y = main_y + main_h + gap;
                        }
                        // 4. Try above main window (same monitor)
                        else if main_y - settings_height - gap >= screen_y + buffer {
                            settings_x = main_x.max(screen_x).min(screen_x + screen_w - settings_width);
                            settings_y = main_y - settings_height - gap;
                        }
                        // 5. Try on a different monitor if available and allowed
                        else if all_monitors.len() > 1 {
                            // Find best alternative monitor
                            for (i, monitor) in all_monitors.iter().enumerate() {
                                let mon_pos = monitor.position();
                                let mon_size = monitor.size();
                                let alt_x = mon_pos.x as f64;
                                let alt_y = mon_pos.y as f64;
                                let alt_w = mon_size.width as f64;
                                let alt_h = mon_size.height as f64;
                                
                                // Skip the current monitor
                                if (alt_x, alt_y) == (screen_x, screen_y) {
                                    continue;
                                }
                                
                                // Check if settings window fits comfortably on this monitor
                                if alt_w >= settings_width + 100.0 && alt_h >= settings_height + 100.0 {
                                    settings_x = alt_x + (alt_w - settings_width) / 2.0;
                                    settings_y = alt_y + (alt_h - settings_height) / 2.0;
                                    println!("Settings positioned on alternative monitor {} due to space constraints", i);
                                    break;
                                }
                            }
                        }
                        // 6. Final fallback: offset from corner of current monitor
                        else {
                            settings_x = screen_x + 50.0;
                            settings_y = screen_y + 50.0;
                        }
                        
                        // Ensure settings window stays within the chosen screen bounds
                        settings_x = settings_x.max(screen_x).min(screen_x + screen_w - settings_width);
                        settings_y = settings_y.max(screen_y).min(screen_y + screen_h - settings_height);
                        
                        // Position the settings window
                        let _ = settings_window.set_position(tauri::LogicalPosition::new(settings_x, settings_y));
                        
                        println!("Settings positioned at ({:.1}, {:.1}) to avoid main window at ({:.1}, {:.1}) on monitor {}x{}", 
                                settings_x, settings_y, main_x, main_y, screen_w, screen_h);
                    }
                } else {
                    // Fallback if monitor detection fails
                    let _ = settings_window.center();
                }
            }
        }
        
        let _ = settings_window.show();
        let _ = settings_window.set_focus();
    }
}

#[command]
fn show_main_window(app_handle: tauri::AppHandle) {
    if let Some(window) = app_handle.get_window("main") {
        println!("=== DEBUG: Attempting to show main window ===");
        
        // Get current position and size
        if let Ok(current_pos) = window.outer_position() {
            println!("Current window position: ({}, {})", current_pos.x, current_pos.y);
        }
        if let Ok(current_size) = window.outer_size() {
            println!("Current window size: {}x{}", current_size.width, current_size.height);
        }
        
        // Force window to be visible
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_resizable(true);
        
        // Force position to center of main screen (not current monitor)
        let window_width = 450.0;
        let window_height = 220.0;
        
        // Get all monitors and use the primary one
        if let Ok(monitors) = window.available_monitors() {
            if let Some(primary_monitor) = monitors.into_iter().next() {
                let monitor_size = primary_monitor.size();
                let monitor_pos = primary_monitor.position();
                
                // Force to center of primary monitor
                let x = monitor_pos.x as f64 + (monitor_size.width as f64 - window_width) / 2.0;
                let y = monitor_pos.y as f64 + (monitor_size.height as f64 - window_height) / 2.0;
                
                println!("Forcing main window to ({}, {}) on primary monitor {}x{}", x, y, monitor_size.width, monitor_size.height);
                let _ = window.set_position(tauri::LogicalPosition::new(x, y));
            }
        } else {
            // Fallback: force to absolute screen center
            let x = 100.0;
            let y = 100.0;
            println!("Fallback: Forcing main window to ({}, {})", x, y);
            let _ = window.set_position(tauri::LogicalPosition::new(x, y));
        }
        
        // Ensure it's on top and focused
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();
        let _ = window.set_size(tauri::LogicalSize::new(window_width, window_height));
        
        // Final position check
        if let Ok(final_pos) = window.outer_position() {
            println!("Final window position: ({}, {})", final_pos.x, final_pos.y);
        }
        
        // Force window to be completely opaque and visible
        #[cfg(target_os = "macos")]
        {
            if let Ok(ns_window) = window.ns_window() {
                unsafe {
                    let ns_window: id = ns_window as *mut std::ffi::c_void as id;
                    // Force window to be opaque
                    let _: () = msg_send![ns_window, setOpaque: YES];
                    // Set window level higher
                    let level: i32 = 10; // Higher than normal floating level
                    let _: () = msg_send![ns_window, setLevel: level];
                    // Make sure it's visible
                    let _: () = msg_send![ns_window, orderFront: ns_window];
                }
            }
        }
        
        println!("=== Main window show command completed ===");
    } else {
        println!("ERROR: Could not find main window");
    }
}

#[command]
fn initialize_window_position(app_handle: tauri::AppHandle, grid_position: i32, random_position: bool, manual_position: bool, manual_x: f64, manual_y: f64, auto_detect_grid: bool, manual_grid_cols: i32, manual_grid_rows: i32, preferred_monitor: String) {
    // Call the existing set_window_position function to set initial position based on saved settings
    set_window_position(app_handle, grid_position, random_position, manual_position, manual_x, manual_y, auto_detect_grid, manual_grid_cols, manual_grid_rows, preferred_monitor);
}

#[command]
fn resize_window_for_content(app_handle: tauri::AppHandle, content_width: f64, content_height: f64) {
    if let Some(main_window) = app_handle.get_window("main") {
        // Add padding around the content
        let padding = 32.0; // 16px on each side
        let window_width = (content_width + padding).clamp(300.0, 800.0);
        let window_height = (content_height + padding).clamp(150.0, 400.0);
        
        println!("Resizing window to {}x{} for content {}x{}", window_width, window_height, content_width, content_height);
        
        let _ = main_window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: window_width,
            height: window_height,
        }));
    }
}

#[command]
fn debug_positions(app_handle: tauri::AppHandle, auto_detect_grid: bool, manual_grid_cols: i32, manual_grid_rows: i32) -> Vec<(i32, f64, f64)> {
    let mut positions = Vec::new();
    
    // Get screen info
    let (screen_width, screen_height, cols, rows) = if let Some(main_window) = app_handle.get_window("main") {
        if let Ok(monitor) = main_window.current_monitor() {
            if let Some(monitor) = monitor {
                let size = monitor.size();
                let aspect_ratio = size.width as f64 / size.height as f64;
                
                let (cols, rows) = if auto_detect_grid {
                    // Auto-detect based on aspect ratio
                    if aspect_ratio > 2.0 {
                        (6, 3)
                    } else if aspect_ratio > 1.8 {
                        (5, 3)
                    } else if aspect_ratio > 1.5 {
                        (4, 3)
                    } else {
                        (3, 4)
                    }
                } else {
                    // Use manual grid override
                    (manual_grid_cols, manual_grid_rows)
                };
                
                (size.width as f64, size.height as f64, cols, rows)
            } else {
                let fallback_cols = if auto_detect_grid { 4 } else { manual_grid_cols };
                let fallback_rows = if auto_detect_grid { 3 } else { manual_grid_rows };
                (1920.0, 1080.0, fallback_cols, fallback_rows)
            }
        } else {
            let fallback_cols = if auto_detect_grid { 4 } else { manual_grid_cols };
            let fallback_rows = if auto_detect_grid { 3 } else { manual_grid_rows };
            (1920.0, 1080.0, fallback_cols, fallback_rows)
        }
    } else {
        let fallback_cols = if auto_detect_grid { 4 } else { manual_grid_cols };
        let fallback_rows = if auto_detect_grid { 3 } else { manual_grid_rows };
        (1920.0, 1080.0, fallback_cols, fallback_rows)
    };
    
    println!("Debug: Screen {}x{}, Grid {}x{}, Aspect: {}", screen_width, screen_height, cols, rows, screen_width / screen_height);
    
    let window_size = (400.0, 300.0);
    let margin = 50.0;
    let available_width = screen_width - window_size.0 - (2.0 * margin);
    let available_height = screen_height - window_size.1 - (2.0 * margin);
    
    // Calculate all positions
    for grid_pos in 0..(cols * rows) {
        let row = grid_pos / cols;
        let col = grid_pos % cols;
        
        let x = if cols == 1 {
            margin + available_width / 2.0
        } else {
            margin + (col as f64 * available_width / (cols - 1) as f64)
        };
        
        let y = if rows == 1 {
            margin + available_height / 2.0
        } else {
            margin + (row as f64 * available_height / (rows - 1) as f64)
        };
        
        positions.push((grid_pos, x, y));
        println!("Position {}: ({}, {}) [row:{}, col:{}]", grid_pos, x, y, row, col);
    }
    
    positions
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let preferences = CustomMenuItem::new("preferences".to_string(), "Preferences");
    let tray_menu = SystemTrayMenu::new()
        .add_item(preferences)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit);

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![update_window_spaces, set_window_position, get_screen_info, save_manual_position, debug_positions, show_settings_window, show_main_window, initialize_window_position, resize_window_for_content, get_all_monitors_info])
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => {
                    app.exit(0);
                }
                "preferences" => {
                    if let Some(window) = app.get_window("settings") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.center();
                    }
                }
                _ => {}
            },
            _ => {}
        })
.on_window_event(|event| match event.event() {
            WindowEvent::CloseRequested { api, .. } => {
                // Prevent settings window from being destroyed when closed
                if event.window().label() == "settings" {
                    event.window().hide().unwrap();
                    api.prevent_close();
                }
            }
            _ => {}
        })
.setup(|app| {
            // TODO: Add global shortcut later - API changed in Tauri v1
            
            if let Some(main_window) = app.get_window("main") {
                // Set floating window level on macOS for non-interfering always-on-top behavior
                #[cfg(target_os = "macos")]
                {
                    if let Ok(ns_window) = main_window.ns_window() {
                        unsafe {
                            let ns_window: id = ns_window as *mut std::ffi::c_void as id;
                            // Set to floating window level (5) - stays on top but doesn't interfere
                            let level: i32 = 5; // NSFloatingWindowLevel
                            let _: () = msg_send![ns_window, setLevel: level];
                            // Enable dragging by mouse down anywhere on window background
                            let _: () = msg_send![ns_window, setMovableByWindowBackground: YES];
                            // Allow mouse events even when window is not focused
                            let _: () = msg_send![ns_window, setIgnoresMouseEvents: false];
                            // Ensure window accepts first mouse click for dragging
                            let _: () = msg_send![ns_window, setAcceptsMouseMovedEvents: YES];
                            // Set default window behavior (both enabled by default)
                            let collection_behavior: i32 = 1 << 0 | 1 << 4; // NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorStationary
                            let _: () = msg_send![ns_window, setCollectionBehavior: collection_behavior];
                        }
                    }
                }
                
                // Ensure window is visible and properly positioned
                let _ = main_window.set_always_on_top(true);
                let _ = main_window.show();
                let _ = main_window.center();
                let _ = main_window.set_focus();
                println!("Main window initialized and centered");
            }
            // Ensure settings window is hidden
            if let Some(settings_window) = app.get_window("settings") {
                let _ = settings_window.hide();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
