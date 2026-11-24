# AGENTS.md

This is a StartOS service-package repository — it builds a `.s9pk` for StartOS.

Develop it inside a StartOS packaging workspace created by `start-cli s9pk init-workspace`,
which provides the packaging guide and agent context one level up. If you're reading this in a
bare clone with no workspace, the full guide is at <https://docs.start9.com/packaging>.

- Never call `slipgate tunnel`, `slipgate users add` or `slipgate install` from the package. They run `systemctl`, `useradd` and firewall commands and prompt on stdin. `slipgate users configs` is the one management command that is safe: it only reads `config.json`.
- Keep Caddy's site address on a non-443 port. Caddy rejects `http://:443` with "scheme and port violate convention", and the error surfaces only from `caddy adapt`, not from `caddy run`.
- `naive.port` and `stuntls.port` in `config.json` are written into client profiles only. The container listens on `naiveListenPort` and `stunTlsListenPort` from `startos/utils.ts`.
- The image build needs an OCI-capable buildx builder. Select one with `BUILDX_BUILDER=<name>` if the default builder uses the `docker` driver.
