# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Package a self-contained web frontend with local Monaco assets, source metadata and checksums, and attach it to desktop draft releases.
- Support browser startup, project import/export, same-origin controller APIs under `/api` and agent status, reporting controller error messages, with guarded simulation controls while retaining desktop configuration and surfacing file-loading errors.

### Changed
- Refresh desktop build workflows, authenticate Protoc downloads and run the agent integration test on Linux, macOS and Windows.
- Align the desktop agent with Hailstorm 0.3 and Rune 0.14 using the public builder and command APIs, and upgrade to Tauri 2 (webkit2gtk-4.1) with CLI, dialog and file system plugins for current Linux builds.

## [0.2.2] 2022-10-05
