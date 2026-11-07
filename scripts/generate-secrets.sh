#!/usr/bin/env bash
set -euo pipefail
echo "JWT_SIGNING_KEY=$(openssl rand -base64 48)"
echo "AUDIT_HMAC_KEY=$(openssl rand -base64 48)"
