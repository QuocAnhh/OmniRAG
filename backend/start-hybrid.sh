#!/bin/sh
set -eu

ARGS="--host 0.0.0.0 --port ${PDF_HYBRID_PORT:-5002}"
ARGS="$ARGS --ocr-engine ${PDF_HYBRID_OCR_ENGINE:-auto}"

if [ "${PDF_HYBRID_FORCE_OCR:-false}" = "true" ]; then
  ARGS="$ARGS --force-ocr"
fi

if [ -n "${PDF_HYBRID_OCR_LANG:-}" ]; then
  ARGS="$ARGS --ocr-lang ${PDF_HYBRID_OCR_LANG}"
fi

if [ "${PDF_HYBRID_ENRICH_PICTURE:-false}" = "true" ]; then
  ARGS="$ARGS --enrich-picture-description"
fi

if [ "${PDF_HYBRID_ENRICH_FORMULA:-false}" = "true" ]; then
  ARGS="$ARGS --enrich-formula"
fi

ARGS="$ARGS --device ${PDF_HYBRID_DEVICE:-cpu}"

if [ -n "${PDF_HYBRID_MAX_FILE_SIZE:-}" ]; then
  ARGS="$ARGS --max-file-size ${PDF_HYBRID_MAX_FILE_SIZE}"
fi

exec opendataloader-pdf-hybrid $ARGS
