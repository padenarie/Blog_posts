#!/bin/sh
set -eu

[ -n "${TRUSTED_PROXY_IP:-}" ] || exit 0

if ! printf '%s\n' "$TRUSTED_PROXY_IP" | awk -F. '
  NF != 4 { exit 1 }
  {
    for (i = 1; i <= 4; i++) {
      if ($i !~ /^[0-9]+$/ || $i < 0 || $i > 255) exit 1
    }
  }
'; then
  echo 'TRUSTED_PROXY_IP must be one exact IPv4 address' >&2
  exit 1
fi

case "$TRUSTED_PROXY_IP" in
  0.0.0.0|255.255.255.255)
    echo 'TRUSTED_PROXY_IP must be a proxy host address' >&2
    exit 1
    ;;
esac

printf 'set_real_ip_from %s;\nreal_ip_header X-Forwarded-For;\nreal_ip_recursive on;\n' "$TRUSTED_PROXY_IP" > /etc/nginx/real-ip/trusted.conf
