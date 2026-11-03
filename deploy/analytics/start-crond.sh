#!/bin/sh
set -eu
printf '%s\n' '0 0 * * * /usr/sbin/logrotate /etc/logrotate.d/blog-analytics' >> /etc/crontabs/root
crond
