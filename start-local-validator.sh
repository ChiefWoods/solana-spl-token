#!/usr/bin/env bash

here="$(cd "$(dirname "$0")" && pwd)"
cd "${here}"

TOKEN_2022_SO=./fixtures/spl_token_2022.so
TRANSFER_HOOK_SO=./fixtures/spl_transfer_hook_example_no_default_features.so

if [[ ! -f "${TOKEN_2022_SO}" ]]; then
  echo "Missing ${TOKEN_2022_SO}."
  exit 1
fi

if [[ ! -f "${TRANSFER_HOOK_SO}" ]]; then
  echo "Missing ${TRANSFER_HOOK_SO}."
  exit 1
fi

ARGS=(
  -r
  -q
  --bpf-program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb "${TOKEN_2022_SO}"
  --bpf-program TokenHookExampLe8smaVNrxTBezWTRbEwxwb1Zykrb "${TRANSFER_HOOK_SO}"
)
PORT=8899
PID=$(lsof -t -i:$PORT)

if [ -n "$PID" ]; then
  echo "Detected test validator running on PID $PID. Restarting..."
  kill "$PID"
  sleep 1
fi

echo "Starting Solana test validator..."
solana-test-validator "${ARGS[@]}" &
VALIDATOR_PID=$!

cleanup() {
  echo -e "\nStopping test validator (PID $VALIDATOR_PID)..."
  kill "$VALIDATOR_PID" 2>/dev/null
  wait "$VALIDATOR_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM

# Wait for test validator to move past slot 0.
echo -n "Waiting for validator to stabilize"
for i in {1..8}; do
  if ! kill -0 "$VALIDATOR_PID" 2>/dev/null; then
    echo -e "\nTest validator exited early."
    exit 1
  fi

  SLOT=$(solana slot -ul 2>/dev/null)
  if [[ "$SLOT" =~ ^[0-9]+$ ]] && [ "$SLOT" -gt 0 ]; then
    echo -e "\nTest validator is ready. Slot: $SLOT"
    echo "Press Ctrl+C to stop the validator."
    wait "$VALIDATOR_PID"
    exit $?
  fi

  echo -n "."
  sleep 1
done

echo -e "\nTimed out waiting for validator to stabilize."
kill "$VALIDATOR_PID" 2>/dev/null
exit 1
