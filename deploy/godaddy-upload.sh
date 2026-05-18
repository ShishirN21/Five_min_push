#!/usr/bin/env bash
# Upload site files to GoDaddy via FTP (cPanel → public_html).
#
# Required env vars:
#   FTP_HOST   e.g. ftp.fiveminpush.com
#   FTP_USER   your cPanel username
#   FTP_PASS   your FTP password
#
# Optional:
#   FTP_DIR    remote folder (default: public_html)
#
# Usage:
#   FTP_HOST=... FTP_USER=... FTP_PASS=... ./deploy/godaddy-upload.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="${FTP_DIR:-public_html}"

if [[ -z "${FTP_HOST:-}" || -z "${FTP_USER:-}" || -z "${FTP_PASS:-}" ]]; then
  echo "Missing FTP credentials. Set FTP_HOST, FTP_USER, and FTP_PASS."
  echo "Example:"
  echo "  FTP_HOST=ftp.yourdomain.com FTP_USER=you FTP_PASS=secret ./deploy/godaddy-upload.sh"
  exit 1
fi

if ! command -v lftp >/dev/null 2>&1; then
  echo "lftp is required. Install with: brew install lftp"
  exit 1
fi

FILES=(
  index.html
  .htaccess
  fiveminpush-logo.png
  fastpak-infographic.png
  product-1.png
  product-2.png
)

for f in "${FILES[@]}"; do
  if [[ ! -f "$ROOT/$f" ]]; then
    echo "Missing file: $ROOT/$f"
    exit 1
  fi
done

echo "Uploading to $FTP_USER@$FTP_HOST:$REMOTE_DIR ..."

lftp -u "$FTP_USER","$FTP_PASS" "$FTP_HOST" <<EOF
set ssl:verify-certificate no
set ftp:ssl-allow yes
cd $REMOTE_DIR
lcd $ROOT
mput index.html
mput .htaccess
mput fiveminpush-logo.png
mput fastpak-infographic.png
mput product-1.png
mput product-2.png
bye
EOF

echo "Done. Visit https://yourdomain.com to verify."
