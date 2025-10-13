#!/usr/bin/env bash
set -euo pipefail

prefix="/opt/lpp"
venv="$prefix/.venv"

echo "[LPP] Creating directories…"
sudo mkdir -p "$prefix" /var/lib/lpp /var/log/lpp /etc/lpp
sudo chown -R root:root "$prefix" /var/lib/lpp /var/log/lpp /etc/lpp

echo "[LPP] Installing Python + venv…"
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -y && sudo apt-get install -y python3 python3-venv
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y python3 python3-venv
elif command -v pacman >/dev/null 2>&1; then
  sudo pacman -Sy --noconfirm python
fi

echo "[LPP] Creating venv…"
sudo python3 -m venv "$venv"

echo "[LPP] Installing package…"
sudo "$venv/bin/pip" install --upgrade pip wheel

# Option 1: install from this working directory (requires proper Python package layout)
# If your project has pyproject.toml and lpp_agent/ package:
if [ -f "pyproject.toml" ]; then
  sudo "$venv/bin/pip" install .
else
  echo "[LPP] ERROR: pyproject.toml not found. Make sure your agent is a Python package."
  echo "       Minimal fix: place your code under lpp_agent/ and add a pyproject.toml (I can give you one)."
  exit 1
fi

echo "[LPP] Linking binary…"
echo -e '#!/usr/bin/env bash\nexec "'"$venv"'/bin/lpp-agent" "$@"' | sudo tee /usr/local/bin/lpp-agent >/dev/null
sudo chmod +x /usr/local/bin/lpp-agent

echo "[LPP] Installing systemd service…"
# Expect a file named lpp-agent.service in the current directory
if [ -f "lpp-agent.service" ]; then
  sudo cp lpp-agent.service /etc/systemd/system/lpp-agent.service
else
  echo "[LPP] WARN: lpp-agent.service not found here. Skipping service install."
fi
sudo systemctl daemon-reload || true
sudo systemctl enable --now lpp-agent || true

echo "[LPP] Done. Try:"
echo "  which lpp-agent"
echo "  sudo lpp-agent enroll <TOKEN> <API-BASE-WITH-/api>"
