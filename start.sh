#!/usr/bin/env sh
set -eu
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY in your environment first}"
exec node server.js
