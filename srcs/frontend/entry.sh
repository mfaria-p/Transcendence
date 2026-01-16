#!/bin/sh
envsubst < src/config.ts.template > src/config.ts
npm run build
