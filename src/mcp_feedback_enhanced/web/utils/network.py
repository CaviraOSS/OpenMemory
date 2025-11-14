#!/usr/bin/env python3
"""
網絡工具函數
============

提供網絡相關的工具函數，如端口檢測等。
"""

import socket


def find_free_port(
    start_port: int = 8765, max_attempts: int = 100, preferred_port: int = 8765
) -> int:
    """
    尋找可用的端口，優先使用偏好端口

    Args:
        start_port: 起始端口號
        max_attempts: 最大嘗試次數
        preferred_port: 偏好端口號（用於保持設定持久性）

    Returns:
        int: 可用的端口號

    Raises:
        RuntimeError: 如果找不到可用端口
    """
    # 首先嘗試偏好端口（通常是 8765）
    if is_port_available("127.0.0.1", preferred_port):
        return preferred_port

    # 如果偏好端口不可用，嘗試其他端口
    for i in range(max_attempts):
        port = start_port + i
        if port == preferred_port:  # 跳過已經嘗試過的偏好端口
            continue
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.bind(("127.0.0.1", port))
                return port
        except OSError:
            continue

    raise RuntimeError(
        f"無法在 {start_port}-{start_port + max_attempts - 1} 範圍內找到可用端口"
    )


def is_port_available(host: str, port: int) -> bool:
    """
    檢查端口是否可用

    Args:
        host: 主機地址
        port: 端口號

    Returns:
        bool: 端口是否可用
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind((host, port))
            return True
    except OSError:
        return False
