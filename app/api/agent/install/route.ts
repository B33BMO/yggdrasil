// app/api/agent/install/route.ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PIP_SPEC =
  "git+https://github.com/B33BMO/yggdrasil.git@main#subdirectory=agent";

export async function GET() {
  const pipSpec = (process.env.NEXT_PUBLIC_AGENT_PIP_SPEC || DEFAULT_PIP_SPEC).trim();
  const script = `#!/usr/bin/env bash
set -euo pipefail
TOKEN=""; API=""; CUSTOMER=""; OS=""; HOSTNAME="$(hostname)"
PIP_SPEC="${pipSpec}"

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

[[ -n "$TOKEN" && -n "$API" ]] || { echo "Usage: ... --token <TOKEN> --api <BASE-WITH-/api>"; exit 2; }
[[ $EUID -eq 0 ]] || { echo "[LPP] run as root (sudo)."; exit 1; }

OS_NAME="$(uname -s)"; PREFIX="/opt/lpp"; VENV="$PREFIX/.venv"
BIN_WRAPPER="/usr/local/bin/lpp-agent"; SERVICE_NAME="lpp-agent"

echo "[LPP] Installing prerequisites…"
if [[ "$OS_NAME" == "Linux" ]]; then
  if command -v apt-get >/dev/null 2>&1; then apt-get update -y && apt-get install -y python3 python3-venv curl ca-certificates git
  elif command -v dnf >/dev/null 2>&1; then dnf install -y python3 python3-venv curl ca-certificates git
  elif command -v pacman >/dev/null 2>&1; then pacman -Sy --noconfirm python curl ca-certificates git
  else echo "[LPP] Unsupported Linux distro"; exit 1; fi
elif [[ "$OS_NAME" == "Darwin" ]]; then
  command -v brew >/dev/null 2>&1 || { echo "[LPP] Install Homebrew first: https://brew.sh"; exit 1; }
  brew list python@3 >/dev/null 2>&1 || brew install python@3
  brew list git >/dev/null 2>&1 || brew install git
else
  echo "[LPP] Unsupported OS: $OS_NAME"; exit 1
fi

echo "[LPP] Creating venv…"
mkdir -p "$PREFIX" /var/lib/lpp /var/log/lpp /etc/lpp
python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip wheel

echo "[LPP] Installing agent from: $PIP_SPEC"
"$VENV/bin/pip" install "$PIP_SPEC"

echo "[LPP] Writing wrapper at $BIN_WRAPPER"
tee "$BIN_WRAPPER" >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
VENV="/opt/lpp/.venv"
if [[ -x "$VENV/bin/lpp-agent" ]]; then exec "$VENV/bin/lpp-agent" "$@"; fi
if [[ -x "$VENV/bin/python3" ]]; then exec "$VENV/bin/python3" -m lpp_agent.main "$@"; fi
echo "[lpp-agent] error: expected VENV at $VENV"; exit 127
EOF
chmod +x "$BIN_WRAPPER"

echo "[LPP] Enrolling…"
"$BIN_WRAPPER" enroll "$TOKEN" "$API"

if [[ "$OS_NAME" == "Linux" ]]; then
  echo "[LPP] Installing systemd unit…"
  tee /etc/systemd/system/${SERVICE_NAME}.service >/dev/null <<'UNIT'
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
elif [[ "$OS_NAME" == "Darwin" ]]; then
  echo "[LPP] Installing launchd plist…"
  tee /Library/LaunchDaemons/com.lpp.agent.plist >/dev/null <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
 "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.lpp.agent</string>
  <key>ProgramArguments</key>
  <array><string>/usr/local/bin/lpp-agent</string><string>run</string></array>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/var/log/lpp/agent.out</string>
  <key>StandardErrorPath</key><string>/var/log/lpp/agent.err</string>
</dict></plist>
PLIST
  chown root:wheel /Library/LaunchDaemons/com.lpp.agent.plist
  chmod 644 /Library/LaunchDaemons/com.lpp.agent.plist
  touch /var/log/lpp/agent.out /var/log/lpp/agent.err || true
  launchctl bootout system com.lpp.agent 2>/dev/null || true
  launchctl bootstrap system /Library/LaunchDaemons/com.lpp.agent.plist
  launchctl enable system/com.lpp.agent
  launchctl kickstart -k system/com.lpp.agent
fi

echo "[LPP] Done."
`;
  return new NextResponse(script, { status: 200, headers: { "Content-Type": "text/x-shellscript; charset=utf-8" } });
}
