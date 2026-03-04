"""
RGA Binary Finder - Locate ripgrep-all binary.

This module provides utilities to find the rga binary, supporting:
1. Bundled binary in ai_service/bin/{platform}/
2. System-installed rga in PATH
3. Custom path via environment variable
"""

import os
import platform
import shutil
from pathlib import Path
from typing import Optional

# Environment variable to override rga path
RGA_PATH_ENV = "FLOWBOARD_RGA_PATH"


def get_platform_name() -> str:
    """Get normalized platform name."""
    system = platform.system().lower()
    if system == "windows":
        return "windows"
    elif system == "linux":
        return "linux"
    elif system == "darwin":
        return "macos"
    else:
        return system


def get_binary_name() -> str:
    """Get the rga binary name for current platform."""
    if platform.system().lower() == "windows":
        return "rga.exe"
    return "rga"


def find_bundled_rga() -> Optional[Path]:
    """
    Find rga binary bundled with the application.
    
    Looks in ai_service/bin/{platform}/ directory.
    """
    # Get ai_service root directory
    # This file is at: ai_service/app/sirchmunk/utils/rga_finder.py
    # ai_service root is 4 levels up
    current_file = Path(__file__).resolve()
    ai_service_root = current_file.parent.parent.parent.parent
    
    platform_name = get_platform_name()
    binary_name = get_binary_name()
    
    # Check in bin/{platform}/
    bundled_path = ai_service_root / "bin" / platform_name / binary_name
    if bundled_path.exists() and bundled_path.is_file():
        return bundled_path
    
    # Also check in bin/ directly (fallback for single-platform builds)
    bundled_path = ai_service_root / "bin" / binary_name
    if bundled_path.exists() and bundled_path.is_file():
        return bundled_path
    
    return None


def find_system_rga() -> Optional[Path]:
    """
    Find rga binary in system PATH.
    """
    binary_name = get_binary_name()
    rga_path = shutil.which(binary_name)
    if rga_path:
        return Path(rga_path)
    return None


def find_rga_binary() -> Path:
    """
    Find rga binary using multiple strategies.
    
    Search order:
    1. Environment variable FLOWBOARD_RGA_PATH
    2. Bundled binary in ai_service/bin/{platform}/
    3. System PATH
    
    Raises:
        FileNotFoundError: If rga binary cannot be found
    
    Returns:
        Path to the rga binary
    """
    # 1. Check environment variable
    env_path = os.environ.get(RGA_PATH_ENV)
    if env_path:
        path = Path(env_path)
        if path.exists() and path.is_file():
            return path
        # If env var is set but invalid, warn but continue searching
        import warnings
        warnings.warn(f"{RGA_PATH_ENV}={env_path} is not a valid file, searching elsewhere")
    
    # 2. Check bundled binary
    bundled = find_bundled_rga()
    if bundled:
        return bundled
    
    # 3. Check system PATH
    system_rga = find_system_rga()
    if system_rga:
        return system_rga
    
    # Not found anywhere
    raise FileNotFoundError(
        "ripgrep-all (rga) binary not found. Please either:\n"
        "1. Run 'python scripts/download_rga.py' to download bundled binary\n"
        "2. Install rga system-wide: https://github.com/phiresky/ripgrep-all#installation\n"
        f"3. Set {RGA_PATH_ENV} environment variable to the rga binary path"
    )


def get_rga_command() -> list:
    """
    Get the rga command as a list for subprocess.
    
    Returns:
        List starting with the path to rga binary
    """
    rga_path = find_rga_binary()
    return [str(rga_path)]


def check_rga_available() -> bool:
    """
    Check if rga is available.
    
    Returns:
        True if rga can be found, False otherwise
    """
    try:
        find_rga_binary()
        return True
    except FileNotFoundError:
        return False


def get_rga_version() -> Optional[str]:
    """
    Get the version of rga.
    
    Returns:
        Version string or None if unable to determine
    """
    import subprocess
    
    try:
        rga_path = find_rga_binary()
        result = subprocess.run(
            [str(rga_path), "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            # First line usually contains version
            return result.stdout.strip().split("\n")[0]
    except Exception:
        pass
    
    return None


# Module-level cache for rga path
_cached_rga_path: Optional[Path] = None


def get_cached_rga_path() -> Path:
    """
    Get cached rga path for performance.
    
    Returns:
        Cached path to rga binary
    """
    global _cached_rga_path
    if _cached_rga_path is None:
        _cached_rga_path = find_rga_binary()
    return _cached_rga_path


def clear_rga_cache() -> None:
    """Clear the cached rga path."""
    global _cached_rga_path
    _cached_rga_path = None
