FROM debian:bookworm-slim

ARG TARGETARCH
ARG SLIPGATE_VERSION=v1.6.8

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl libssl3 openssh-server openssl \
 && rm -rf /var/lib/apt/lists/* /etc/ssh/ssh_host_* \
 && mkdir -p /run/sshd

RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) sums="\
fa92109a566b62d31e1af17984281abc6b30e16af42d06fef472e9badf936fc5  slipgate\n\
c5e627b03e1e79329450833adcd52cf907d8102fd9d2498a2ffbdee1d69ff02f  dnstt-server\n\
d0254a986e7841cc1555fec459db6df562dd24c1186af6656c20a4a90d9e11ef  slipstream-server\n\
9a6efbd0764ea1f9da199b1b16eb6f536c2a53700d4d5255bd8ea20203737b7e  vaydns-server\n\
88099ffd284666727b1d3e8224320e9190e1171932f9c3a5e871dc2f67380fef  caddy-naive" ;; \
      arm64) sums="\
c856bdd2f0aeb700de237f2d4b6e06a5d3e8ecb49f988ec758d951128c39e42c  slipgate\n\
29bbfca9f306754c98203307c69ef304f74035f68fa70fd12fc51d4ed7339474  dnstt-server\n\
2f9effd90f8bd73e07ac100ad0362573d91476731fe8223909da454272e15bb3  slipstream-server\n\
ed96fc18d71bb14933d4847770d4e4bf1fe6c9d7eefcfff72aa8875040bbb7db  vaydns-server\n\
80ceab25305e7b31454bb0f9949054d55e48c25253891a83e289c0f61f65359c  caddy-naive" ;; \
      *) echo "unsupported arch $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    cd /usr/local/bin; \
    for bin in slipgate dnstt-server slipstream-server vaydns-server caddy-naive; do \
      curl -fsSL -o "$bin" "https://github.com/anonvector/slipgate/releases/download/${SLIPGATE_VERSION}/${bin}-linux-${TARGETARCH}"; \
    done; \
    printf "$sums\n" | sha256sum -c -; \
    chmod 0755 slipgate dnstt-server slipstream-server vaydns-server caddy-naive
