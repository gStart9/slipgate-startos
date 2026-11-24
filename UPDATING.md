# Updating the upstream version

Upstream is the set of release binaries published by [anonvector/slipgate](https://github.com/anonvector/slipgate). `Dockerfile` downloads them and checks each against a SHA-256 digest.

## Determining the upstream version

The pin is `SLIPGATE_VERSION` in `Dockerfile`. Find the latest stable release, skipping `-dev` prereleases:

```bash
gh release list -R anonvector/slipgate --exclude-pre-releases --limit 1
```

A stable release must carry all ten assets: `slipgate`, `dnstt-server`, `slipstream-server`, `vaydns-server` and `caddy-naive`, each for `linux-amd64` and `linux-arm64`. List them with their digests:

```bash
gh api repos/anonvector/slipgate/releases/tags/<tag> \
  --jq '.assets[] | "\(.digest) \(.name)"'
```

## Applying the bump

1. Set `SLIPGATE_VERSION` in `Dockerfile` to the new tag.
2. Replace the ten digests in the `amd64` and `arm64` lists in `Dockerfile` with the ones from the release, dropping the `sha256:` prefix.
3. Set `version` in `startos/versions/current.ts` to the tag without the `v`, followed by `:0`.
4. Compare upstream's command builders against `tunnelCommand` in `startos/main.ts`, and its config structs against `prepare.ts`. The builders are in `internal/transport/*.go`; the structs are in `internal/config/config.go` and `internal/config/tunnel.go`.
