# Changelog (English)

This document records all version updates for **MCP Feedback Enhanced**.

## [v2.6.0] - 2025-06-28 - Intelligent Session Management & Automation Enhancement

### 🌟 Version Highlights
Significantly enhanced session management capabilities with automatic command execution, export features, and notification system, providing a more intelligent development experience.

### ✨ New Features
- 🚀 **Auto Command Execution**: Automatically execute preset commands after creating new sessions or commits
- 📊 **Session Export Feature**: Support exporting session records to multiple formats
- ⏸️ **Auto-commit Control**: Added pause and resume buttons for better control over auto-commit timing
- 🔔 **System Notifications**: System-level notifications for important events with real-time alerts

### 🚀 Improvements
- ⏱️ **Session Timeout Optimization**: Redesigned session management with more flexible configuration options
- 🌏 **I18n Enhancement**: Refactored internationalization architecture with full multilingual support for notifications
- 🎨 **UI Simplification**: Significantly simplified user interface for improved user experience

### 🐛 Bug Fixes
- Fixed command execution functionality issues
- Fixed WebSocket status detection import errors
- Improved session history multilingual support

---

## [v2.5.0] - 2025-06-15 - Desktop Application & Performance Optimization

### 🌟 Version Highlights
Introducing cross-platform desktop application supporting Windows, macOS, and Linux. Significant performance improvements with debounce/throttle mechanisms and enhanced system stability.

### ✨ New Features
- 🖥️ **Desktop Application**: Native cross-platform desktop app based on Tauri framework, supporting Windows x64, macOS (Intel/Apple Silicon), Linux x64
- 📊 **Server-side Session History Storage**: Session records migrated from localStorage to server-side local file storage for improved data consistency and reliability
- 🔧 **Multi-platform Build Support**: Complete CI/CD pipeline supporting automated multi-platform desktop application builds
- 📝 **Desktop Mode Configuration**: Added `MCP_DESKTOP_MODE` environment variable for desktop/web mode switching
- 📋 **AI Work Summary Markdown Display**: Support for Markdown syntax rendering including headers, bold text, code blocks, lists, links and other formats

### 🚀 Improvements
- ⚡ **Significant Performance Enhancement**: Introduced debounce/throttle mechanisms to reduce unnecessary rendering and network requests
- 🌐 **Network Connection Stability**: Improved WebSocket reconnection mechanism with network status detection and intelligent reconnection
- 🎨 **UI Rendering Optimization**: Optimized rendering performance for session management, statistics, and status indicators
- 📱 **Responsive Improvements**: Adjusted heartbeat frequency and timeout thresholds to reduce system load
- 🔄 **Enhanced Modularity**: Optimized JavaScript module structure with better logging management

### 🐛 Bug Fixes
- 🌐 **Network Reconnection Improvements**: Optimized reconnection algorithm with exponential backoff strategy and random jitter
- 🖥️ **Desktop Mode Adaptation**: Fixed browser auto-launch issues in desktop mode
- 📊 **Rendering Performance Fixes**: Resolved duplicate rendering and unnecessary state update issues

### 🛠️ Technical Improvements
- 🏗️ **Build Process Optimization**: Added Makefile desktop application build commands supporting debug/release modes
- 📦 **Dependency Management**: Integrated Rust toolchain supporting cross-platform compilation and packaging
- 🔍 **Enhanced Development Tools**: Added environment checks, build validation, and cleanup tools
- 📚 **Documentation Enhancement**: Added desktop application build guide and workflow documentation
- 🔒 **Security Enhancement**: Introduced DOMPurify for XSS protection ensuring content security

### 📋 Usage Instructions
- **Desktop Mode**: Set `"MCP_DESKTOP_MODE": "true"` in MCP configuration (refer to `examples/mcp-config-desktop.json`)
- **Web Mode**: Set `"MCP_DESKTOP_MODE": "false"` in MCP configuration (default, refer to `examples/mcp-config-web.json`)
- **Test Desktop Mode**: `uvx mcp-feedback-enhanced@latest test --desktop`
- **Build Desktop Application**: `make build-desktop-release`

---

## [v2.4.3] - 2025-06-14 - Session Management Refactoring & Audio Notifications

### 🌟 Version Highlights
Migrated session management from sidebar to dedicated tab, resolving browser compatibility issues. Added audio notification system with custom audio support.

### ✨ New Features
- 🔊 **Audio Notification System**: Play audio alerts for session updates, supports built-in and custom audio uploads
- 📚 **Session History Management**: Local session record storage with export and cleanup functionality
- 💾 **Input Height Memory**: Automatically save and restore textarea input height settings
- 📋 **One-Click Copy**: Project path and session ID support click-to-copy

### 🚀 Improvements
- 📋 **Session Management Refactoring**: Migrated from sidebar to "Session Management" tab, fixing button click issues in small windows
- 🎨 **Interface Layout Optimization**: AI summary auto-expansion, submit button repositioning, removed redundant descriptions
- 🌐 **Multilingual Enhancement**: Added tooltip and button multilingual support

### 🐛 Bug Fixes
- Fixed current session details button unresponsive issue
- Fixed session details modal close delay issue
- Fixed audio notification language initialization issue
- Corrected auto-submit processing logic

---

## [v2.4.2] - Web-Only Architecture Refactoring & Smart Feature Enhancement

### 🌟 Version Highlights
This version underwent major architectural refactoring, **completely removing PyQt6 GUI dependencies** and transitioning to a pure Web UI architecture, dramatically simplifying deployment and maintenance. Additionally, multiple smart features were added, including prompt management, auto-submit, session management, and more, comprehensively enhancing user experience and work efficiency.

### 🔄 Major Architectural Changes
- 🏗️ **Complete PyQt6 GUI Removal**: Thoroughly removed desktop application dependencies, simplifying installation and deployment processes
- 🌐 **Pure Web UI Architecture**: Unified use of Web interface, supporting all platforms and environments
- 📦 **Dramatically Simplified Dependencies**: Removed PyQt6, related GUI libraries and other heavy dependencies, significantly reducing installation package size
- 🚀 **Simpler Deployment**: No need to consider GUI environment configuration, suitable for all development environments

### ✨ Brand New Features
- 📝 **Smart Prompt Management System**:
  - CRUD operations for common prompts (Create, Edit, Delete, Use)
  - Usage frequency statistics and intelligent sorting
  - Quick selection and one-click application functionality
  - Support for auto-submit marking and priority display
- ⏰ **Auto-Timed Submit Feature**:
  - Configurable countdown timer from 1-86400 seconds
  - Visual countdown display and status indicators
  - Deep integration with prompt management system
  - Support for pause, resume, and cancel operations
- 📊 **Session Management & Tracking**:
  - Real-time current session status display
  - Session history records and statistical analysis
  - Today's session count and average duration statistics
  - Session detail viewing and management functions
- 🔗 **Connection Monitoring System**:
  - Real-time WebSocket connection status monitoring
  - Latency measurement and connection quality indicators
  - Auto-reconnection mechanism and error handling
  - Detailed connection statistical information
- ⌨️ **Enhanced Shortcuts**: Added Ctrl+I quick focus input box feature (Thanks @penn201500)

### 🚀 Feature Improvements
- 🎨 **Comprehensive UI/UX Optimization**:
  - Added left session management panel with collapse/expand support
  - Top connection status bar with real-time system status display
  - Responsive design adapting to different screen sizes
  - Unified design language and visual style
- 🌐 **Enhanced Multi-language System**:
  - Optimized language switching mechanism with instant switching support
  - Added extensive translation text, improving localization coverage
  - Improved language selector UI with dropdown design
  - Fixed display issues during language switching
- 🖼️ **Image Settings Integration**:
  - Moved image settings from workspace to settings tab
  - Unified settings management interface
  - Improved organization and layout of setting items
- 📱 **Interface Layout Optimization**:
  - Adjusted layout to accommodate multi-language display requirements
  - Optimized button styles and spacing
  - Improved visual design of form elements
  - Enhanced accessibility and usability

### 🐛 Bug Fixes
- 🔧 **Session Management Fixes**:
  - Fixed session statistics information not updating correctly
  - Fixed session count calculation errors
  - Improved session state tracking mechanism
- 🎯 **Prompt Feature Fixes**:
  - Fixed common prompt management unable to correctly set auto-submit
  - Improved prompt selection and application logic
- 🌐 **Localization Switch Fixes**:
  - Fixed partial text not updating during language switching
  - Improved multi-language text loading mechanism
- 🏗️ **Architecture Stability Fixes**:
  - Fixed session management initialization issues
  - Improved error handling and resource cleanup
  - Optimized module loading order and dependencies

### 🛠️ Technical Improvements
- 📦 **Modular Architecture**:
  - Complete JavaScript code modular refactoring
  - Adopted ES6+ syntax and modern development patterns
  - Clear module separation and responsibility division
- 📊 **Performance Enhancement**:
  - Optimized WebSocket communication efficiency
  - Improved frontend resource loading speed
  - Reduced memory usage and CPU load

### 📚 Documentation Updates
- 📖 **Architecture Documentation Update**: Updated system architecture description to reflect Web-Only design
- 🔧 **Installation Guide Simplification**: Removed GUI-related installation steps and dependency descriptions
- 🖼️ **Screenshot Updates**: Updated all interface screenshots to showcase new Web UI design
- 📋 **Enhanced API Documentation**: Added API descriptions for new features like prompt management and auto-submit

---

## [v2.3.0] - System Stability & Resource Management Enhancement

### 🌟 Highlights
This version focuses on improving system stability and user experience, particularly solving the browser launch issue in Cursor SSH Remote environments.

### ✨ New Features
- 🌐 **SSH Remote Environment Support**: Solved Cursor SSH Remote browser launch issues with clear usage guidance
- 🛡️ **Error Message Improvements**: Provides more user-friendly error messages and solution suggestions when errors occur
- 🧹 **Auto-cleanup Features**: Automatically cleans temporary files and expired sessions to keep the system tidy
- 📊 **Memory Monitoring**: Monitors memory usage to prevent system resource shortage

### 🚀 Improvements
- 💾 **Resource Management Optimization**: Better system resource management for improved performance
- 🔧 **Enhanced Error Handling**: Provides clearer explanations and solutions when problems occur
- 🌐 **Connection Stability**: Improved Web UI connection stability
- 🖼️ **Image Upload Optimization**: Enhanced stability of image upload functionality
- 🎯 **Auto-focus Input Box**: Automatically focus on feedback input box when window opens, improving user experience (Thanks @penn201500)

### 🐛 Bug Fixes
- 🌐 **Connection Issues**: Fixed WebSocket connection related problems
- 🔄 **Session Management**: Fixed session state tracking issues
- 🖼️ **Image Processing**: Fixed event handling issues during image upload

---

## [v2.2.5] - WSL Environment Support & Cross-Platform Enhancement

### ✨ New Features
- 🐧 **WSL Environment Detection**: Automatically identifies WSL environments and provides specialized support logic
- 🌐 **Smart Browser Launching**: Automatically invokes Windows browser in WSL environments with multiple launch methods
- 🔧 **Cross-Platform Testing Enhancement**: Test functionality integrates WSL detection for improved test coverage

### 🚀 Improvements
- 🎯 **Environment Detection Optimization**: Improved remote environment detection logic, WSL no longer misidentified as remote environment
- 📊 **System Information Enhancement**: System information tool now displays WSL environment status
- 🧪 **Testing Experience Improvement**: Test mode automatically attempts browser launching for better testing experience

---

## [v2.2.4] - GUI Experience Optimization & Bug Fixes

### 🐛 Bug Fixes
- 🖼️ **Image Duplicate Paste Fix**: Fixed the issue where Ctrl+V image pasting in GUI would create duplicate images
- 🌐 **Localization Switch Fix**: Fixed image settings area text not translating correctly when switching languages
- 📝 **Font Readability Improvement**: Adjusted font sizes in image settings area for better readability

---

## [v2.2.3] - Timeout Control & Image Settings Enhancement

### ✨ New Features
- ⏰ **User Timeout Control**: Added customizable timeout settings with flexible range from 30 seconds to 2 hours
- ⏱️ **Countdown Timer**: Real-time countdown timer display at the top of the interface for visual time reminders
- 🖼️ **Image Size Limits**: Added image upload size limit settings (unlimited/1MB/3MB/5MB)
- 🔧 **Base64 Compatibility Mode**: Added Base64 detail mode to improve image recognition compatibility with AI models
- 🧹 **UV Cache Management Tool**: Added `cleanup_cache.py` script to help manage and clean UV cache space

### 🚀 Improvements
- 📚 **Documentation Structure Optimization**: Reorganized documentation directory structure, moved images to `docs/{language}/images/` paths
- 📖 **Cache Management Guide**: Added detailed UV Cache management guide with automated cleanup solutions
- 🎯 **Smart Compatibility Hints**: Automatically display Base64 compatibility mode suggestions when image upload fails

### 🐛 Bug Fixes
- 🛡️ **Timeout Handling Optimization**: Improved coordination between user-defined timeout and MCP system timeout
- 🖥️ **Interface Auto-close**: Fixed interface auto-close and resource cleanup logic after timeout
- 📱 **Responsive Layout**: Optimized timeout control component display on small screen devices

---

## [v2.2.2] - Timeout Auto-cleanup Fix

### 🐛 Bug Fixes
- 🔄 **Timeout Auto-cleanup**: Fixed GUI/Web UI not automatically closing after MCP session timeout (default 600 seconds)
- 🛡️ **Resource Management Optimization**: Improved timeout handling mechanism to ensure proper cleanup and closure of all UI resources on timeout
- ⚡ **Enhanced Timeout Detection**: Strengthened timeout detection logic to correctly handle timeout events in various scenarios

---

## [v2.2.1] - Window Optimization & Unified Settings Interface

### 🚀 Improvements
- 🖥️ **Window Size Constraint Removal**: Removed GUI main window minimum size limit from 1000×800 to 400×300
- 💾 **Real-time Window State Saving**: Implemented real-time saving mechanism for window size and position changes
- ⚙️ **Unified Settings Interface Optimization**: Improved GUI settings page configuration saving logic to avoid setting conflicts

### 🐛 Bug Fixes
- 🔧 **Window Size Constraint**: Fixed GUI window unable to resize to small dimensions issue
- 🛡️ **Setting Conflicts**: Fixed potential configuration conflicts during settings save operations

---

## [v2.2.0] - Layout & Settings UI Enhancements

### ✨ New Features
- 🎨 **Horizontal Layout Mode**: GUI & Web UI combined mode adds left-right layout option for summary and feedback

### 🚀 Improvements
- 🎨 **Improved Settings Interface**: Optimized the settings page for both GUI and Web UI
- ⌨️ **GUI Shortcut Enhancement**: Submit feedback shortcut now fully supports numeric keypad Enter key

### 🐛 Bug Fixes
- 🔧 **Image Duplication Fix**: Resolved Web UI image pasting duplication issue

---

## [v2.1.1] - Window Positioning Optimization

### ✨ New Features
- 🖥️ **Smart Window Positioning**: Added "Always show window at primary screen center" setting option
- 🌐 **Multi-Monitor Support**: Perfect solution for complex multi-monitor setups like T-shaped screen arrangements
- 💾 **Position Memory**: Auto-save and restore window position with intelligent visibility detection

---

## [v2.1.0] - Complete Refactored Version

### 🎨 Major Refactoring
- 🏗️ **Complete Refactoring**: GUI and Web UI adopt modular architecture
- 📁 **Centralized Management**: Reorganized folder structure, improved maintainability
- 🖥️ **Interface Optimization**: Modern design and improved user experience

### ✨ New Features
- 🍎 **macOS Interface Optimization**: Specialized improvements for macOS user experience
- ⚙️ **Feature Enhancement**: New settings options and auto-close page functionality
- ℹ️ **About Page**: Added about page with version info, project links, and acknowledgments

---

## [v2.0.14] - Shortcut & Image Feature Enhancement

### 🚀 Improvements
- ⌨️ **Enhanced Shortcuts**: Ctrl+Enter supports numeric keypad
- 🖼️ **Smart Image Pasting**: Ctrl+V directly pastes clipboard images

---

## [v2.0.9] - Multi-language Architecture Refactor

### 🔄 Refactoring
- 🌏 **Multi-language Architecture Refactor**: Support for dynamic loading
- 📁 **Modularized Language Files**: Modular organization of language files

---

## [v2.0.3] - Encoding Issues Fix

### 🐛 Critical Fixes
- 🛡️ **Complete Chinese Character Encoding Fix**: Resolved all Chinese display related issues
- 🔧 **JSON Parsing Error Fix**: Fixed data parsing errors

---

## [v2.0.0] - Web UI Support

### 🌟 Major Features
- ✅ **Added Web UI Support**: Support for remote environments
- ✅ **Auto Environment Detection**: Automatically choose appropriate interface
- ✅ **WebSocket Real-time Communication**: Real-time bidirectional communication

---

## Legend

| Icon | Meaning |
|------|---------|
| 🌟 | Version Highlights |
| ✨ | New Features |
| 🚀 | Improvements |
| 🐛 | Bug Fixes |
| 🔄 | Refactoring Changes |
| 🎨 | UI Optimization |
| ⚙️ | Settings Related |
| 🖥️ | Window Related |
| 🌐 | Multi-language/Network Related |
| 📁 | File Structure |
| ⌨️ | Shortcuts |
| 🖼️ | Image Features |
| 📝 | Prompt Management |
| ⏰ | Auto-Submit |
| 📊 | Session Management |
| 🔗 | Connection Monitoring |
| 🏗️ | Architecture Changes |
| 🛠️ | Technical Improvements |
| 📚 | Documentation Updates |

---

**Full Project Info:** [GitHub - mcp-feedback-enhanced](https://github.com/Minidoracat/mcp-feedback-enhanced)
