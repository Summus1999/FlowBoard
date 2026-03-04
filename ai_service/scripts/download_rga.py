#!/usr/bin/env python3
"""
Download ripgrep-all (rga) binary for bundling with FlowBoard.

This script downloads the appropriate rga binary for the current platform
and extracts it to ai_service/bin/ for packaging.

Usage:
    python scripts/download_rga.py [--platform windows|linux|macos]
"""

import argparse
import os
import platform
import shutil
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path
from urllib.request import urlretrieve

# ripgrep-all release versions (Windows uses older version as latest doesn't have Windows builds)
RGA_VERSION_UNIX = "0.10.10"
RGA_VERSION_WINDOWS = "0.9.6"

# Download URLs for each platform
RGA_DOWNLOADS = {
    "windows": {
        "url": f"https://github.com/phiresky/ripgrep-all/releases/download/v{RGA_VERSION_WINDOWS}/ripgrep_all-v{RGA_VERSION_WINDOWS}-x86_64-pc-windows-msvc.zip",
        "archive_type": "zip",
        "binary_name": "rga.exe",
        "extra_binaries": ["rga-preproc.exe"],
    },
    "linux": {
        "url": f"https://github.com/phiresky/ripgrep-all/releases/download/v{RGA_VERSION_UNIX}/ripgrep_all-v{RGA_VERSION_UNIX}-x86_64-unknown-linux-musl.tar.gz",
        "archive_type": "tar.gz",
        "binary_name": "rga",
        "extra_binaries": ["rga-preproc"],
    },
    "macos": {
        "url": f"https://github.com/phiresky/ripgrep-all/releases/download/v{RGA_VERSION_UNIX}/ripgrep_all-v{RGA_VERSION_UNIX}-x86_64-apple-darwin.tar.gz",
        "archive_type": "tar.gz",
        "binary_name": "rga",
        "extra_binaries": ["rga-preproc"],
    },
}


def get_current_platform() -> str:
    """Detect current platform."""
    system = platform.system().lower()
    if system == "windows":
        return "windows"
    elif system == "linux":
        return "linux"
    elif system == "darwin":
        return "macos"
    else:
        raise RuntimeError(f"Unsupported platform: {system}")


def download_file(url: str, dest: Path, progress: bool = True) -> None:
    """Download file with optional progress indicator."""
    print(f"Downloading: {url}")
    
    def reporthook(block_num, block_size, total_size):
        if progress and total_size > 0:
            downloaded = block_num * block_size
            percent = min(100, downloaded * 100 // total_size)
            bar_len = 40
            filled = int(bar_len * percent // 100)
            bar = "=" * filled + "-" * (bar_len - filled)
            sys.stdout.write(f"\r[{bar}] {percent}%")
            sys.stdout.flush()
    
    urlretrieve(url, dest, reporthook if progress else None)
    
    if progress:
        print()  # newline after progress bar


def extract_archive(archive_path: Path, dest_dir: Path, archive_type: str) -> Path:
    """Extract archive and return the extracted directory."""
    print(f"Extracting: {archive_path.name}")
    
    if archive_type == "zip":
        with zipfile.ZipFile(archive_path, 'r') as zf:
            zf.extractall(dest_dir)
    elif archive_type == "tar.gz":
        with tarfile.open(archive_path, 'r:gz') as tf:
            tf.extractall(dest_dir)
    else:
        raise ValueError(f"Unknown archive type: {archive_type}")
    
    # Find the extracted directory (usually the first directory)
    for item in dest_dir.iterdir():
        if item.is_dir():
            return item
    
    return dest_dir


def download_rga(target_platform: str = None, output_dir: Path = None) -> Path:
    """
    Download and extract rga binary.
    
    Args:
        target_platform: Target platform (windows, linux, macos)
        output_dir: Output directory for binaries
    
    Returns:
        Path to the bin directory containing rga
    """
    if target_platform is None:
        target_platform = get_current_platform()
    
    if target_platform not in RGA_DOWNLOADS:
        raise ValueError(f"Unsupported platform: {target_platform}")
    
    config = RGA_DOWNLOADS[target_platform]
    
    # Determine output directory
    if output_dir is None:
        script_dir = Path(__file__).parent.parent
        output_dir = script_dir / "bin" / target_platform
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Check if already downloaded
    binary_path = output_dir / config["binary_name"]
    if binary_path.exists():
        print(f"rga already exists at: {binary_path}")
        return output_dir
    
    # Download to temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)
        
        # Download archive
        archive_name = config["url"].split("/")[-1]
        archive_path = tmpdir / archive_name
        download_file(config["url"], archive_path)
        
        # Extract
        extracted_dir = extract_archive(archive_path, tmpdir, config["archive_type"])
        
        # Copy binaries
        binaries_to_copy = [config["binary_name"]] + config.get("extra_binaries", [])
        
        for binary_name in binaries_to_copy:
            src = extracted_dir / binary_name
            if src.exists():
                dst = output_dir / binary_name
                shutil.copy2(src, dst)
                # Make executable on Unix
                if target_platform != "windows":
                    dst.chmod(dst.stat().st_mode | 0o755)
                print(f"Installed: {dst}")
            else:
                print(f"Warning: {binary_name} not found in archive")
    
    print(f"\nrga successfully installed to: {output_dir}")
    return output_dir


def download_all_platforms(output_base: Path = None) -> None:
    """Download rga for all platforms."""
    if output_base is None:
        script_dir = Path(__file__).parent.parent
        output_base = script_dir / "bin"
    
    for plat in RGA_DOWNLOADS.keys():
        print(f"\n{'='*50}")
        print(f"Downloading rga for {plat}")
        print('='*50)
        try:
            download_rga(target_platform=plat, output_dir=output_base / plat)
        except Exception as e:
            print(f"Error downloading for {plat}: {e}")


def main():
    parser = argparse.ArgumentParser(description="Download ripgrep-all binary")
    parser.add_argument(
        "--platform",
        choices=["windows", "linux", "macos", "all"],
        default=None,
        help="Target platform (default: current platform)"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output directory"
    )
    
    args = parser.parse_args()
    
    if args.platform == "all":
        download_all_platforms(args.output)
    else:
        download_rga(target_platform=args.platform, output_dir=args.output)


if __name__ == "__main__":
    main()
