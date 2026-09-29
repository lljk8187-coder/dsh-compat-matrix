# Changelog

## [0.1.0] — 2026-09-29

Phase1 MVP / M6 收口。

### Added / Completed (M1–M6)

- **M1**：MIT LICENSE、README、TypeScript 脚手架、stub `probe` / `run`
- **M2**：本地夹具 + 临时 `DSH_HOME` + hang-layer（`--dump-config`）探测
- **M3**：三态 probe（`install_ok` / `config_hang_ok` / `load_ok`）+ 正/负向 fixtures + lite schema load
- **M4**：`MatrixReport` 落盘（`report.json` + `report.md`）+ CLI `run`
- **M5**：`targets` 串行批量（`--targets` / `targets.example.json`）
- **M6**：GitHub Actions CI（typecheck + test；best-effort 安装 dsh）+ README 护栏 / 文档收口

### Guardrails

- dump ≠ boot；临时 `DSH_HOME` only；不启 web / 不全量 boot
- CI 仅 fixture / `targets.example.json`；无真网插件矩阵
