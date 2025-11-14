use pyo3::prelude::*;
use tauri::{Builder, Context, Manager};
use std::sync::Mutex;

// 全局狀態管理
static APP_STATE: Mutex<Option<tauri::AppHandle>> = Mutex::new(None);

/// Tauri 應用程式狀態
#[derive(Default)]
struct AppState {
    web_url: String,
    desktop_mode: bool,
}

/// 生成 Tauri 上下文
pub fn tauri_generate_context() -> Context {
    tauri::generate_context!()
}

/// 創建 Tauri 應用程式構建器
pub fn create_tauri_builder() -> Builder<tauri::Wry> {
    Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .setup(|app| {
            // 儲存應用程式句柄到全局狀態
            {
                let mut state = APP_STATE.lock().unwrap();
                *state = Some(app.handle().clone());
            }

            // 設置應用程式狀態
            let _app_state = app.state::<AppState>();
            {
                // 這裡可以設置初始狀態
            }

            println!("Tauri 應用程式已初始化");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_web_url,
            set_web_url,
            is_desktop_mode,
            set_desktop_mode
        ])
}

/// 獲取 Web URL
#[tauri::command]
fn get_web_url(state: tauri::State<AppState>) -> String {
    state.web_url.clone()
}

/// 設置 Web URL
#[tauri::command]
fn set_web_url(url: String, _state: tauri::State<AppState>) {
    // 注意：這裡需要使用內部可變性，但 tauri::State 不支援
    // 實際實現中可能需要使用 Mutex 或其他同步原語
    println!("設置 Web URL: {}", url);
}

/// 檢查是否為桌面模式
#[tauri::command]
fn is_desktop_mode(state: tauri::State<AppState>) -> bool {
    state.desktop_mode
}

/// 設置桌面模式
#[tauri::command]
fn set_desktop_mode(enabled: bool, _state: tauri::State<AppState>) {
    println!("設置桌面模式: {}", enabled);
}

/// PyO3 模組定義
#[pymodule]
#[pyo3(name = "ext_mod")]
pub mod ext_mod {
    use super::*;

    #[pymodule_init]
    fn init(module: &Bound<'_, PyModule>) -> PyResult<()> {
        // 註冊 context_factory 函數
        module.add_function(wrap_pyfunction!(context_factory, module)?)?;

        // 註冊 builder_factory 函數
        module.add_function(wrap_pyfunction!(builder_factory, module)?)?;

        // 註冊 run_app 函數
        module.add_function(wrap_pyfunction!(run_app, module)?)?;

        Ok(())
    }

    /// 創建 Tauri 上下文的工廠函數
    #[pyfunction]
    fn context_factory() -> PyResult<String> {
        // 返回序列化的上下文信息
        // 實際實現中，這裡應該返回可以被 Python 使用的上下文
        Ok("tauri_context".to_string())
    }

    /// 創建 Tauri 構建器的工廠函數
    #[pyfunction]
    fn builder_factory() -> PyResult<String> {
        // 返回序列化的構建器信息
        // 實際實現中，這裡應該返回可以被 Python 使用的構建器
        Ok("tauri_builder".to_string())
    }

    /// 運行 Tauri 應用程式
    #[pyfunction]
    fn run_app(web_url: String) -> PyResult<i32> {
        println!("正在啟動 Tauri 應用程式，Web URL: {}", web_url);

        // 創建並運行 Tauri 應用程式
        let _builder = create_tauri_builder();
        let _context = tauri_generate_context();

        // 在實際實現中，這裡需要處理異步運行
        // 目前返回成功狀態
        match std::thread::spawn(move || {
            // 這裡應該運行 Tauri 應用程式
            // builder.run(context)
            println!("Tauri 應用程式線程已啟動");
            0
        }).join() {
            Ok(code) => Ok(code),
            Err(_) => Ok(1),
        }
    }
}
