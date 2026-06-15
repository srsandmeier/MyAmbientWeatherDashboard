#!/usr/bin/env bash
# Runs backend and frontend test suites sequentially.
# Both suites run regardless of the other's result.
# Prints a combined summary and exits non-zero if either suite failed.

run_suite() {
  local name="$1"
  shift
  printf "\n"
  printf "=== %s ===\n" "$name"
  "$@"
  return $?
}

run_suite "Backend (dotnet test)" npm run test:backend
BACKEND_EXIT=$?

run_suite "Frontend (Vitest)" npm run test:frontend
FRONTEND_EXIT=$?

printf "\n"
printf "==========================================\n"
printf " Test session summary\n"
printf "==========================================\n"
if [ $BACKEND_EXIT -eq 0 ]; then
  printf " %-12s PASSED\n" "backend"
else
  printf " %-12s FAILED (code %d)\n" "backend" "$BACKEND_EXIT"
fi
if [ $FRONTEND_EXIT -eq 0 ]; then
  printf " %-12s PASSED\n" "frontend"
else
  printf " %-12s FAILED (code %d)\n" "frontend" "$FRONTEND_EXIT"
fi
printf "==========================================\n"

[ $BACKEND_EXIT -eq 0 ] && [ $FRONTEND_EXIT -eq 0 ]
