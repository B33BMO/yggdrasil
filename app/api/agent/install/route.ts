import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * This endpoint returns a shell script. It:
 * - installs Python & creates /opt/lpp/.venv
 * - pip installs lpp-agent from NEXT_PUBLIC_AGENT_PIP_SPEC (or fallback)
 * - creates /usr/local/bin/lpp-agent wrapper
 * - enrolls with --token and --api passed to the script
 * - installs & starts a background service (systemd on Linux, launchd on macOS)
 *
 * Customize the package source with:
 *   NEXT_PUBLIC_AGENT_PIP_SPEC="git+https://github.com/yourorg/lpp-agent.git@main#egg=lpp-agent"
 *     OR a wheel URL, e.g.:
 *   NEXT_PUBLIC_AGENT_PIP_SPEC="https://your-cdn.example.com/lpp_agent-0.2.0-py3-none-any.whl"
 */
export async function GET() {
  const pipSpec =
    process.env.NEXT_PUBLIC_AGENT_PIP_SPEC ??
    "git+https://github.com/yourorg/lpp-agent.git@main#egg=lpp-agent";

  const script = `#!/usr/bin/env bash
set -euo pipefail

TOKEN=""
API=""
CUSTOMER=""
OS=""
HOSTNAME="$(hostname)"
PIP_SPEC="${pipSpec}"

# parse args passed via: bash -s -- --token ... --api ... --customer ... --os ... [--hostname ...]
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2;;
    --api) API="$2"; shift 2;;
    --customer) CUSTOMER="$2"; shift 2;;
    --os) OS="$2"; shift 2;;
    --hostname) HOSTNAME="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 2;;
  esac
done

if [[ -z "$TOKEN" || -z "$API" ]]; then
  echo "Usage: curl -fsSL <base>/api/agent/install | sudo bash -s -- --token <TOKEN> --api <BASE-WITH-/api> [--customer <ID>] [--os <id>] [--hostname <name>]"
  exit 2
fi

if [[ $EUID -ne 0 ]]; then
  echo "[LPP] This installer must run as root (use sudo)."; exit 1
fi

OS_NAME="$(uname -s)"
PREFIX="/opt/lpp"
VENV="$PREFIX/.venv"
BIN_WRAPPER="/usr/local/bin/lpp-agent"
SERVICE_NAME="lpp-agent"

echo "[LPP] Installing prerequisites…"
if [[ "$OS_NAME" == "Linux" ]]; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y python3 python3-venv curl ca-certificates
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y python3 python3-venv curl ca-certificates
  elif command -v pacman >/dev/null 2>&1; then
    pacman -Sy --noconfirm python curl ca-certificates
  else
    echo "[LPP] Unsupported Linux distro (need apt, dnf, or pacman)"; exit 1
  fi
elif [[ "$OS_NAME" == "Darwin" ]]; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "[LPP] Homebrew is required on macOS. Install from https://brew.sh and rerun."; exit 1
  fi
  brew list python@3 >/dev/null 2>&1 || brew install python@3
else
  echo "[LPP] Unsupported OS: $OS_NAME"; exit 1
fi

echo "[LPP] Creating directories & venv…"
mkdir -p "$PREFIX" /var/lib/lpp /var/log/lpp /etc/lpp
python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip wheel

echo "[LPP] Installing agent package from: $PIP_SPEC"
if [[ "$PIP_SPEC" =~ \\.whl$ ]]; then
  # wheel URL
  TMP_WHL="/tmp/lpp-agent-$$.whl"
  curl -fsSL "$PIP_SPEC" -o "$TMP_WHL"
  "$VENV/bin/pip" install "$TMP_WHL"
  rm -f "$TMP_WHL"
else
  # git+https or package name
  "$VENV/bin/pip" install "$PIP_SPEC"
fi

echo "[LPP] Creating CLI wrapper at $BIN_WRAPPER"
cat > "$BIN_WRAPPER" <<EOF
#!/usr/bin/env bash
exec "$VENV/bin/lpp-agent" "\$@"
EOF
chmod +x "$BIN_WRAPPER"

echo "[LPP] Enrolling host…"
"$BIN_WRAPPER" enroll "$TOKEN" "$API" || { echo "[LPP] Enroll failed"; exit 1; }

if [[ "$OS_NAME" == "Linux" ]]; then
  echo "[LPP] Installing systemd service…"
  cat > /etc/systemd/system/${SERVICE_NAME}.service <<'UNIT'
[Unit]
Description=Linux Policy Platform Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/lpp-agent run
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable --now ${SERVICE_NAME}
  systemctl status ${SERVICE_NAME} --no-pager -l || true
  echo "[LPP] Service started via systemd."
elif [[ "$OS_NAME" == "Darwin" ]]; then
  echo "[LPP] Installing launchd service…"
  PLIST="/Library/LaunchDaemons/com.lpp.agent.plist"
  cat > "$PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.lpp.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/lpp-agent</string>
    <string>run</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/var/log/lpp/agent.out</string>
  <key>StandardErrorPath</key><string>/var/log/lpp/agent.err</string>
</dict>
</plist>
PLIST
  chown root:wheel "$PLIST"
  chmod 644 "$PLIST"
  touch /var/log/lpp/agent.out /var/log/lpp/agent.err || true
  launchctl bootout system com.lpp.agent 2>/dev/null || true
  launchctl bootstrap system "$PLIST"
  launchctl enable system/com.lpp.agent
  launchctl kickstart -k system/com.lpp.agent
  echo "[LPP] Service started via launchd."
fi

echo "[LPP] Done."
`;
  return new NextResponse(script, {
    status: 200,
    headers: { "Content-Type": "text/x-shellscript; charset=utf-8" },
  });
}
