#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Building native/pepper-audio-capture..."
swiftc native/pepper-audio-capture/main.swift -o native/pepper-audio-capture/pepper-audio-capture -O

echo "Built native/pepper-audio-capture/pepper-audio-capture"
