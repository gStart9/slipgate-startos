<p align="center">
  <img src="icon.svg" alt="SlipGate Logo" width="21%">
</p>

# SlipGate on StartOS

> Everything not listed in this document should behave the same as upstream
> SlipGate. If a feature, setting, or behavior is not mentioned here, the
> upstream documentation is accurate and fully applicable — see the
> Documentation section of `instructions.md` for links.

[SlipGate](https://github.com/anonvector/slipgate) is the server for the SlipNet Android app. It runs DNS tunnels (DNSTT, NoizDNS, Slipstream, VayDNS, Soar) behind one DNS router, plus NaiveProxy and StunTLS.

---

## Table of Contents

- [Image and Container Runtime](#image-and-container-runtime)
- [Volume and Data Layout](#volume-and-data-layout)
- [File Models](#file-models)
- [Dependencies](#dependencies)
- [Network Access and Interfaces](#network-access-and-interfaces)
- [Installation and First-Run Flow](#installation-and-first-run-flow)
- [Actions](#actions)
- [Tasks](#tasks)
- [Health Checks](#health-checks)
- [Backups and Restore](#backups-and-restore)
- [Limitations and Differences](#limitations-and-differences)
- [Quick Reference for AI Consumers](#quick-reference-for-ai-consumers)

---

## Image and Container Runtime

The package builds its own image from `Dockerfile`, because upstream publishes no container image. The image is Debian slim with `libssl3` (needed by `slipstream-server`), `openssh-server` and `openssl`, plus upstream's release binaries `slipgate`, `dnstt-server`, `slipstream-server`, `vaydns-server` and `caddy-naive`, each checked against its published SHA-256 digest. Architectures: x86_64 and aarch64.

Upstream's installer (`slipgate install`, `slipgate tunnel add`, `slipgate users add`) is not used: it manages systemd units, system users and firewall rules. The package writes SlipGate's configuration itself and runs each server in the foreground.

Every daemon and oneshot shares one subcontainer, `slipgate`:

| Id | Runs |
| --- | --- |
| `prepare` (oneshot) | Generates missing keys and certificates, then writes `config.json`, `socks-users.conf`, the Caddyfile and `sshd_config` |
| `socks` | `slipgate socks serve` on `127.0.0.1:1080`, with per-user credentials |
| `ssh-users` (oneshot) | Creates a system account in group `slipgate-ssh` for every user and sets its password |
| `sshd` | OpenSSH on `127.0.0.1:22`: password logins, port forwarding only, no shell |
| `tunnel-<tag>` | One per enabled tunnel |
| `dns-router` | `slipgate dnsrouter serve` on port 53, routing each query to its tunnel by subdomain |

`ssh-users` and `sshd` run only when at least one SSH-backed tunnel is enabled.

## Volume and Data Layout

Everything is on the `main` volume.

| Path in `main` | Mounted at | Contents |
| --- | --- | --- |
| `store.json` | not mounted | StartOS-side settings and users; see [File Models](#file-models) |
| `slipgate/config.json` | `/etc/slipgate/config.json` | SlipGate's config, written by the package |
| `slipgate/socks-users.conf` | `/etc/slipgate/socks-users.conf` | SOCKS logins |
| `slipgate/tunnels/<tag>/` | `/etc/slipgate/tunnels/<tag>/` | Each tunnel's keys or certificate |
| `slipgate/naive/` | `/etc/slipgate/naive/` | The Caddyfile and Caddy's data directory |
| `slipgate/ssh/` | `/etc/slipgate/ssh/` | `sshd_config` and the SSH host key |

## File Models

`store.json` holds everything the user chose: `domain`, `enabledTunnels`, `naivePort`, `stunTlsPort` and `users` (username and password in plain text, because SlipGate's own config and the SOCKS, SSH and NaiveProxy servers need the plain password). Only the actions write it.

`prepare` rewrites `config.json`, `socks-users.conf`, `naive/Caddyfile` and `ssh/sshd_config` from `store.json` on every start, and before **Show Client Profiles** runs. Hand edits to those four files are lost.

Keys and certificates are generated once and then left alone, so client profiles stay valid:

- DNSTT and VayDNS: Curve25519 key pairs, from each server's `-gen-key`.
- Soar: an Ed25519 seed and public key in base64.
- Slipstream: a self-signed P-256 certificate whose common name is the tunnel's domain. It is regenerated only when the domain changes.
- StunTLS: a self-signed certificate.
- SSH: an Ed25519 host key.

## Dependencies

None.

## Network Access and Interfaces

| Interface id | Type | Container port | Protocol | Purpose |
| --- | --- | --- | --- | --- |
| `dns` | `p2p` | 53 | DNS over UDP and TCP | The DNS router in front of every DNS tunnel |
| `naive` | `p2p` | 8444 | TLS terminated by StartOS, then HTTP/1.1 or HTTP/2 cleartext to Caddy | NaiveProxy |
| `stuntls` | `p2p` | 8443 | raw TCP; SlipGate terminates its own TLS | StunTLS |

`naive` and `stuntls` exist only while their tunnel is enabled. External port 53 is already in use on the server, so `dns` gets another external port on the LAN; behind StartTunnel the user forwards public port 53 to it.

The public NaiveProxy and StunTLS ports in **Configure** are written into client profiles and requested as each interface's external port. They do not change what the container listens on. A client reaches NaiveProxy with a publicly trusted certificate only after the user adds the domain to the `naive` interface as a public domain, so that StartOS obtains it.

Tunnel servers listen on loopback ports 5310 to 5317, reached only through the router. Their SOCKS and SSH backends are on `127.0.0.1:1080` and `127.0.0.1:22`.

## Installation and First-Run Flow

Two critical tasks hold the service stopped: **Configure** (no domain yet) and **Add User** (no users yet).

The public address in DNS records, in `config.json`'s `public_address` and in StunTLS profiles is read from the `dns` interface: the public IPv4 of the gateway the user enabled it on. With several, the lowest by string order is used. It is never entered by hand. Nothing is generated until the first start or the first **Show Client Profiles**, whichever comes first.

## Actions

- **Configure** — writes the domain, enabled tunnels and public ports to `store.json` and returns the DNS records to create. Changing any of them restarts the service; a new domain regenerates the Slipstream certificates and changes every profile. Safe to repeat.
- **Show DNS Records** — read-only; lists the records for the current settings. Fails until the `dns` interface has a public IPv4 enabled.
- **Add User** — adds a username and password to `store.json`. The restart that follows adds the login to the SOCKS proxy, to NaiveProxy and, when an SSH tunnel is enabled, to `sshd`. Fails if the username exists.
- **Remove User** — removes the user. Their SOCKS, NaiveProxy and SSH logins stop working after the restart that follows.
- **Show Client Profiles** — runs `prepare` and then `slipgate users configs` in a temporary container, and returns the chosen user's `slipnet://` profiles, plus the login-free Soar (direct) profile when that tunnel is on. Read-only apart from generating missing keys; safe to repeat.

## Tasks

- **Configure** (`critical`) — raised while `store.json` has no domain. Cleared by running **Configure**.
- **Add User** (`critical`) — raised while there are no users. Cleared by adding one; returns if every user is removed.
- **Show DNS Records** (`important`) — raised while the `dns` interface has no public IPv4 enabled on any gateway. Cleared when the user enables one; returns if it is disabled again.

## Health Checks

Each daemon reports whether its port is listening: `socks` (1080), `sshd` (22), each `tunnel-<tag>` on its own port, and `dns-router` (53). A tunnel stuck at "Not listening" usually means its server exited; the log shows the reason. The DNS router starts only after every enabled tunnel is listening.

A green check proves only that the servers are up. Whether clients can reach them depends on the DNS records and StartTunnel forwards, which the package cannot test.

## Backups and Restore

The whole `main` volume is copied: settings, users, keys, certificates, the SSH host key and Caddy's data. A restored instance serves the same profiles as before and needs nothing further.

## Limitations and Differences

1. The package manages users and tunnels through its actions; SlipGate's interactive menu and its `tunnel`, `users`, `config`, `update`, `backup` and `restore` commands are not used.
2. The tunnel set is fixed: one instance of each transport and backend pair, on fixed subdomains (`t`, `ts`, `s`, `ss`, `v`, `vs`, `r`, `rs`, and the bare domain for NaiveProxy). The direct SSH, direct SOCKS5 and external transports are not offered.
3. WARP outbound is not supported.
4. NaiveProxy's TLS is terminated by StartOS with the certificate it obtains for the domain, rather than by Caddy with its own Let's Encrypt certificate.
5. Every user's credentials work on NaiveProxy. Upstream accepts only the first user's there, even though it issues every user a NaiveProxy profile.
6. Passwords are limited to letters, digits and `. _ ~ + = -`.

---

## Quick Reference for AI Consumers

```yaml
package_id: slipgate
image: built from Dockerfile (upstream release binaries)
architectures: [x86_64, aarch64]
subcontainers: [slipgate]
volumes:
  main: /etc/slipgate (subpath slipgate)
file_models:
  - store.json
startos_managed_env_vars:
  - XDG_DATA_HOME
dependencies: none
interfaces:
  dns: { type: p2p, port: 53 }
  naive: { type: p2p, port: 8444 }
  stuntls: { type: p2p, port: 8443 }
actions:
  - configure
  - show-dns-records
  - add-user
  - remove-user
  - show-profiles
tasks:
  - { action: configure, severity: critical }
  - { action: add-user, severity: critical }
health_checks:
  - socks
  - sshd
  - tunnel-<tag>
  - dns-router
```
