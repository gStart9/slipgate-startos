# SlipGate

SlipGate needs a domain you control, and its **DNS Tunnels** interface published on a gateway with a public address, usually your StartTunnel.

## Documentation

- [SlipNet](https://github.com/anonvector/SlipNet/blob/main/README.md) — the Android client app: installing it, importing profiles, and choosing DNS resolvers.

## What you get on StartOS

- **DNS Tunnels** — port 53 over UDP and TCP. One router answers for every DNS tunnel and hands each query to the right one by its subdomain.
- **NaiveProxy** — an HTTPS proxy that looks like an ordinary website. StartOS provides its certificate.
- **StunTLS** — SSH over TLS and WebSocket, for networks that allow only TLS.

Each user gets a login that works on every tunnel, and a set of `slipnet://` profiles to import into the SlipNet app.

## Getting set up

1. Run **Configure**. Enter your domain (for example `example.com`) and choose the tunnels you want.
2. Publish the **DNS Tunnels** interface on the gateway clients will reach, usually your StartTunnel, by enabling its public address there. SlipGate uses that gateway's public IP in your DNS records and profiles. **Show DNS Records** lists the records once the address is enabled.
3. At your DNS provider, create those records: an `A` record for `ns.<your domain>` pointing at the public address, and an `NS` record for each tunnel subdomain pointing at `ns.<your domain>`. If NaiveProxy is on, also create an `A` record for the domain itself.
4. On your StartTunnel, forward public port 53 (UDP and TCP) to the **DNS Tunnels** interface. If NaiveProxy is on, forward the NaiveProxy port you chose in **Configure** to the **NaiveProxy** interface. If StunTLS is on, forward its port to the **StunTLS** interface.
5. If NaiveProxy is on, add your domain to the **NaiveProxy** interface as a public domain so that StartOS obtains its certificate.
6. Run **Add User** for each person who will connect.
7. Start SlipGate.
8. Run **Show Client Profiles**, choose a user, and scan the QR codes into SlipNet on that person's phone.

You can run **Show DNS Records** at any time to see the records again.

## Using SlipGate

### Choosing a tunnel

Profiles come in pairs. The plain one carries traffic through SlipGate's SOCKS proxy; the one ending in `-ssh` carries it over SSH instead. Try the DNS tunnels first on networks that block VPNs, since they ride on ordinary DNS queries through the network's own resolver. They are slow, typically tens to a few hundred kilobits per second. NaiveProxy and StunTLS are much faster but need the network to allow TLS to your address.

**Soar (direct)** is off by default. It has no login, so anyone who finds its subdomain can use your server to reach websites. Turn it on in **Configure** only if you want a profile you can hand out freely.

### Actions

- **Configure** — changes the domain, tunnels or public ports. SlipGate restarts to apply the change. Changing the domain changes every profile, so hand out new profiles afterwards.
- **Add User** and **Remove User** — manage logins. Removing a user stops their profiles from working.
- **Show Client Profiles** — shows a user's profiles as text and QR codes. Profiles stay the same until you change the domain, the gateway the **DNS Tunnels** interface is published on, or the ports.
- **Show DNS Records** — lists the records your domain needs for the tunnels that are on.

### Outbound traffic

Traffic your users send through SlipGate leaves from this server, so the sites they visit see the server's outbound address. If you publish SlipGate through a tunnel to keep your home IP private, send the server's outbound traffic through that tunnel too. If you use the tunnel for another reason, such as a port your router cannot forward, there is nothing to change.
