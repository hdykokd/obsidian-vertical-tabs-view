#!/bin/bash

set -ex

version=$1

if [ -z "$version" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

pnpm run version
git add .
git commit -m "chore: release $version"
git tag -a $version -m "$version"
git push origin "$version"
