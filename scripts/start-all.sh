#!/usr/bin/env bash
# Starts the hot-reload backend and Vite frontend concurrently.
# Prints a session summary when both processes exit.

printf "Starting dev session (Ctrl+C to stop both)\n"
printf "%-12s %s\n" "api"      "http://localhost:5080"
printf "%-12s %s\n" "frontend" "http://localhost:5173"
printf "\n"

concurrently \
  --names "api,frontend" \
  --prefix-colors "cyan,magenta" \
  "npm run api:watch" \
  "npm run dev"
EXIT=$?

printf "\n"
printf "%-40s\n" "=========================================="
printf " Dev session ended\n"
if [ $EXIT -eq 0 ]; then
  printf " Status: all processes exited cleanly\n"
else
  printf " Status: one or more processes exited with errors (code %d)\n" "$EXIT"
fi
printf "%-40s\n" "=========================================="
exit $EXIT
