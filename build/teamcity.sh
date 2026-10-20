#!/usr/bin/env bash
# TeamCity Linux Docker entry point. Cake owns verification and publication.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

mode="${RELEASE_MODE:---verify-only}"
case "$mode" in
    --verify-only|--dry-run|--publish) ;;
    *) printf '%s\n' 'RELEASE_MODE must be --verify-only, --dry-run or --publish.' >&2; exit 2 ;;
esac

if [[ "$mode" == --publish ]]; then
    : "${NPM_TOKEN:?Configure the protected env.NPM_TOKEN TeamCity parameter.}"
    export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
    : "${GH_TOKEN:?Configure the protected env.GITHUB_TOKEN TeamCity parameter.}"
fi

export CI=true DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
# TeamCity's checkout is mounted into a root-owned Docker step.
export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0="$PWD"
# The Docker image supplies Node 24. Use the repository's npm and .NET 10.
tools_dir="$(mktemp -d)"
cleanup() {
    # Keep partial-release archives available when a later publication step fails.
    if [[ "$mode" != --verify-only && -f output/release/release-manifest.json ]]; then
        printf "##teamcity[publishArtifacts 'output/release/* => npm-release.zip']\n"
    fi
    rm -rf -- "$tools_dir"
}
trap cleanup EXIT
if [[ "$mode" != --verify-only ]]; then
    # Do not attach an older candidate if bootstrap or verification fails.
    rm -rf -- "$PWD/output/release"
fi
# Playwright installs Xvfb without its recommended xauth package; xvfb-run needs both.
apt-get update
apt-get install --yes --no-install-recommends xauth
curl --fail --silent --show-error --location https://dot.net/v1/dotnet-install.sh -o "$tools_dir/dotnet-install.sh"
bash "$tools_dir/dotnet-install.sh" --channel 10.0 --install-dir "$tools_dir/dotnet" --no-path
export PATH="$tools_dir/dotnet:$PATH"
npm install --global "$(node -p "require('./package.json').packageManager")"

if [[ "$mode" == --verify-only ]]; then
    # Verification does not need publishing credentials, including inherited ones.
    unset NPM_TOKEN NODE_AUTH_TOKEN GH_TOKEN GITHUB_TOKEN
    dotnet run --project build -- --target Verify
    exit
fi

version="$(node -p "require('./packages/core/package.json').version")"
if [[ "$mode" == --dry-run ]]; then
    unset NPM_TOKEN NODE_AUTH_TOKEN GH_TOKEN GITHUB_TOKEN
    dotnet run --project build -- --target Release --release-version "$version" --dry-run
else
    # Only the variable reference reaches disk; npm expands the token in memory.
    printf '%s\n' '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > "$tools_dir/npmrc"
    export NPM_CONFIG_USERCONFIG="$tools_dir/npmrc"
    # Install the same GitHub CLI used by UI.Workbench, from its official release.
    case "$(uname -m)" in
        x86_64) arch=amd64 ;;
        aarch64) arch=arm64 ;;
        *) printf '%s\n' 'GitHub CLI requires an amd64 or arm64 agent.' >&2; exit 2 ;;
    esac
    curl --fail --silent --show-error --location "https://github.com/cli/cli/releases/download/v2.102.0/gh_2.102.0_linux_${arch}.tar.gz" -o "$tools_dir/gh.tar.gz"
    tar -xzf "$tools_dir/gh.tar.gz" -C "$tools_dir"
    export PATH="$tools_dir/gh_2.102.0_linux_${arch}/bin:$PATH"
    npm whoami --registry https://registry.npmjs.org/ > /dev/null
    gh auth status > /dev/null 2>&1
    dotnet run --project build -- --target Release --release-version "$version"
fi
