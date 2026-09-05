# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **homelab Kubernetes infrastructure repository** managing a single-node k3s cluster on Ubuntu. The cluster runs media automation services (Plex, *arr stack), MCP memory services, and various self-hosted applications.

## Cluster Context

**This repo targets the `lab` kubectl context. ALWAYS verify before running kubectl.**

```bash
# Verify context (MUST be 'lab')
kubectl config current-context
# Switch if needed
kubectl config use-context lab
```

Namespaces are named for a domain / ownership boundary, never a wire protocol — `mcp` is reserved for actual MCP tool servers; new workloads go to a domain namespace. See [ADR-0002](docs/adr/0002-namespace-domain-convention.md).

## Common Commands

```bash
# Apply all manifests in a directory
kubectl apply -f k8s/media/

# Apply a single manifest
kubectl apply -f k8s/media/plex.yaml

# Check deployment status
kubectl get pods -n <namespace> -w
kubectl describe pod <pod-name> -n <namespace>
kubectl logs -f deployment/<name> -n <namespace>

# View cluster events (useful for debugging)
kubectl get events -A --sort-by='.lastTimestamp'

# Check GPU allocation
kubectl get nodes -o jsonpath='{.items[0].status.allocatable.nvidia\.com/gpu}'

# Verify VPN connectivity (qBittorrent)
kubectl exec -it -n torrents deployment/qbittorrent-vpn -c gluetun -- wget -qO- ifconfig.me

# Verify hardlinks working (after import)
kubectl exec -it -n media deployment/sonarr -- ls -li /data/torrents/tv/
kubectl exec -it -n media deployment/sonarr -- ls -li /data/media/tv/

# Minecraft / Crafty Controller
kubectl get pods -n minecraft
kubectl logs -f -n minecraft deployment/crafty
# Panel access: https://<node-ip>:30443
# Game servers: <loadbalancer-ip>:25565-25570
```

## Architecture

### Namespace Layout
- `media` - Plex, Sonarr, Radarr, Prowlarr, and other media services (GPU access enabled)
- `torrents` - qBittorrent with Gluetun VPN sidecar (ProtonVPN WireGuard, isolated)
- `mcp` - MCP memory service with Qdrant vector store
- `immich` - Self-hosted photo management
- `minecraft` - Crafty Controller 4 (Minecraft server management platform)
- `gaming` - Game servers (may overlap with minecraft)
- `monitoring` - VictoriaMetrics stack, Grafana, exporters
- `arc-runners` / `arc-systems` - GitHub Actions runners
- `crowdsec` - CrowdSec security
- `obsidian` - Obsidian sync
- `recsys` - Recommendation system
- `vectors` - Vector database services
- `cert-manager` - TLS certificate automation
- `flux-system` - Flux GitOps controller

### Storage Strategy (TRaSH-Guides compliant)
All media services share `/home/fish/media/data` via hostPath, enabling hardlinks:
```
/home/fish/media/data/
├── torrents/           # qBittorrent downloads (seeding)
│   ├── movies/
│   └── tv/
├── media/              # Organized content (hardlinked)
│   ├── movies/
│   ├── tv/
│   ├── music/
│   └── books/
└── transcode/          # Plex transcoding cache
```

Config directories per-app: `/home/fish/media/<app>-config/`

**Migration planned**: When 4TB drive attached, update hostPaths from `/home/fish/media/data` to `/mnt/4tb-wd-red/data`.

### VPN Architecture
qBittorrent runs in `torrents` namespace with Gluetun sidecar:
- Gluetun provides VPN gateway (ProtonVPN WireGuard)
- Kill switch via `FIREWALL=on`
- Port forwarding auto-syncs to qBittorrent API
- *arr services bypass VPN (direct connection to qBittorrent service)

### GPU Configuration
- GTX 1060 6GB with NVIDIA device plugin
- Time-slicing enabled (2 replicas) for concurrent transcodes
- Plex requests `nvidia.com/gpu: 1` with NVENC environment variables

### Monitoring Architecture
- **Stack**: VictoriaMetrics k8s stack (Helm chart `victoria-metrics-k8s-stack`, manually managed via `helm upgrade`)
- **VMAgent**: `hostNetwork: true` — enables scraping Tailscale services on mem cluster
- **Dashboards**: Grafana sidecar provisions from ConfigMaps with label `grafana_dashboard: "1"`
  - `homelab-overview.json` — Node health, k8s overview, namespace resources, storage, VPN
  - `media-stack.json` — Library stats, downloads, storage, wanted items
  - `victorialogs-cluster-logs.json` — Log explorer with VictoriaLogs datasource
  - `grafana-dashboard-anthropic-lb.yaml` — Token budget, burn rates, client attribution, session sizes (per-pod scrape of the mcp-namespace deployment)
  - `grafana-dashboard-claude-code.yaml` — Claude Code process monitoring (textfile collector)
- **Custom exporters**: Node exporter textfile collector at `/var/lib/node_exporter/textfiles/`
  - `claude-code-metrics.sh` — cron script (every 30s) exposes Claude Code process metrics

### Cross-Cluster Connectivity
- **Lab pods CAN reach Tailscale IPs** (VMAgent uses `hostNetwork: true`)
- **anthropic-lb** runs on THIS cluster (`mcp` namespace, Flux-managed, 2 replicas); clients reach it via the Tailscale service VIP `100.81.156.183:8082` (`svc:anthropic-lb`); metrics are scraped per-pod (`vmpodscrape-anthropic-lb.yaml`), NOT via the VIP — the VIP lands on a random replica per connection and all LB state is per-process
- **ExternalName services** exist in `arc-runners` for `anthropic-lb.lobster-python.ts.net`
- **DNS**: Pods without hostNetwork CANNOT resolve `.ts.net` domains (CoreDNS doesn't forward to Tailscale DNS)

## Directory Structure

```
k8s/
├── base/           # Cluster-wide resources (namespaces, storage, cluster-issuer)
├── gpu/            # NVIDIA device plugin configuration
├── media/          # Media stack (Plex, arr-stack, audiobookshelf, etc.)
├── torrents/       # VPN-isolated download client
├── mcp/            # MCP memory service + Qdrant
├── immich/         # Photo management
└── minecraft/      # Game server (LoadBalancer, not Cloudflare Tunnel)
```

## GitOps Workflow (Flux)

**Flux reconciles this repo to the cluster. Git is the source of truth.**

**COMMIT BEFORE APPLYING.** If you `kubectl apply` or `helm upgrade` without pushing to git first, Flux will revert your changes on the next reconciliation cycle. The only safe workflow:

1. Edit manifests/values
2. Commit and push
3. Flux applies automatically (or `flux reconcile` to force)

If you must apply directly for an emergency fix, commit and push **immediately** after — not after a debugging detour, not "in a bit." Every minute between apply and push is a window for Flux to revert your work.

**What Flux manages:**
- Raw manifests (victorialogs.yaml, fluent-bit.yaml, etc.) via Kustomizations with `prune: false`
- The monitoring Helm chart is managed manually (`helm upgrade`), NOT via HelmRelease CRD

## Key Patterns

### Deployment Pattern
All deployments use:
- `strategy: type: Recreate` (single-node, no rolling updates)
- LinuxServer.io images with `PUID=1000`, `PGID=1000`, `TZ=Australia/Hobart`
- Resource requests/limits defined
- Liveness/readiness probes where applicable

### Secrets Management
- Secrets stored externally (not in git)
- Referenced via `secretKeyRef` in manifests
- `.gitignore` excludes `*-secret.yaml`, `*-secrets.yaml`
- **Known issue**: `immich.yaml` has plaintext secrets (see ROADMAP.md P1)

### Service Exposure
- Internal: ClusterIP services (default)
- External: Plex uses hostPort + Cloudflare Tunnel sidecar
- Minecraft: LoadBalancer (direct port forwarding recommended over tunnel)

## Active Issues (from ROADMAP.md)

### P0 - Critical
- [ ] Sync manifests to cluster (configuration drift)
- [ ] Update CoreDNS manifest with fixed forwarders

### P1 - High
- [ ] Pin all images (replace `:latest` with specific versions)
- [ ] Remove plaintext secrets from `immich.yaml`
- [ ] Enable K8s audit logging
- [ ] Add pre-commit hooks (yamllint, gitleaks)

## Reference Documents

- `lab-design.md` - Comprehensive *arr stack design guide
- `lab-implementation-design-glm.md` - GPU-optimized Plex + ProtonVPN implementation plan
- `k8s/ROADMAP.md` - Remediation roadmap (post 2025-12-24 incident)
