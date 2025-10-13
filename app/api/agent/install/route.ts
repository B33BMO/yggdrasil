import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Default to your repo’s /agent subdirectory
const DEFAULT_PIP_SPEC =
  "git+https://github.com/B33BMO/yggdrasil.git@main#subdirectory=agent";

export async function GET() {
  try {
    const pipSpec =
      (process.env.NEXT_PUBLIC_AGENT_PIP_SPEC || DEFAULT_PIP_SPEC).trim();

    const script = `#!/usr/bin/env bash
set -euo pipefail

TOKEN=""
API=""
CUSTOMER=""
OS=""
HOSTNAME="$(hostname)"
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
    apt-get update -y && apt-get install -y python3 python3-venv curl ca-certificates git
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y python3 python3-venv curl ca-certificates git
  elif command -v pacman >/dev/null 2>&1; then
    pacman -Sy --noconfirm python curl ca-certificates git
  else
    echo "[LPP] Unsupported Linux distro (need apt, dnf, or pacman)"; exit 1
  fi
elif [[ "$OS_NAME" == "Darwin" ]]; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "[LPP] Homebrew is required on macOS. Install from https://brew.sh and rerun."; exit 1
  fi
  brew list python@3 >/dev/null 2>&1 || brew install python@3
  brew list git >/dev/null 2>&1 || brew install git
else
  echo "[LPP] Unsupported OS: $OS_NAME"; exit 1
fi

echo "[LPP] Creating directories & venv…"
mkdir -p "$PREFIX" /var/lib/lpp /var/log/lpp /etc/lpp
python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip wheel

echo "[LPP] Installing agent package from: $PIP_SPEC"
"$VENV/bin/pip" install "$PIP_SPEC"

# detect console script or fall back to module
ENTRY=""
for CAND in "lpp-agent" "ygg-agent" "yggdrasil-agent"; do
  if [[ -x "$VENV/bin/$CAND" ]]; then ENTRY="$CAND"; break; fi
done
if [[ -z "$ENTRY" ]]; then
  if "$VENV/bin/python3" -c "import lpp_agent" 2>/dev/null; then
    ENTRY="python3 -m lpp_agent.main"
  elif "$VENV/bin/python3" -c "import yggdrasil_agent" 2>/dev/null; then
    ENTRY="python3 -m yggdrasil_agent.main"
  else
    echo "[LPP] ERROR: No console script or module found"; exit 1
  fi
fi

echo "[LPP] Creating CLI wrapper at $BIN_WRAPPER"
cat > "$BIN_WRAPPER" <<EOF
#!/usr/bin/env bash
exec "$VENV/bin/\${ENTRY}" "\$@"
EOF
chmod +x "$BIN_WRAPPER"

echo "[LPP] Enrolling host…"
"$BIN_WRAPPER" enroll "$TOKEN" "$API" || { echo "[LPP] Enroll failed"; exit 1; }

if [[ "$OS_NAME" == "Linux" ]]; then
  echo "[LPP] Installing systemd service…"
  cat > /etc/systemd/system/\${SERVICE_NAME}.service <<'UNIT'
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
  systemctl enable --now \${SERVICE_NAME}
  systemctl status \${SERVICE_NAME} --no-pager -l || true
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
  } catch (err: any) {
    const msg = (err?.stack || err?.message || String(err)).slice(0, 5000);
    return new NextResponse(`# installer generation error\n${msg}\n`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
