'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');

const pinnedSingletons = new Set([
  'prosemirror-model',
  'prosemirror-state',
  'prosemirror-transform',
  'prosemirror-view'
]);

function bin(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const message = options.capture
      ? (result.stderr || result.stdout || `${command} failed`).trim()
      : `${command} ${args.join(' ')} failed with exit code ${result.status}`;
    throw new Error(message);
  }

  return options.capture ? result.stdout.trim() : '';
}

function runYarn(args, options = {}) {
  return run(bin('corepack'), ['yarn', ...args], options);
}

async function getLatestVersion(packageName) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Unable to resolve latest version for ${packageName}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.version) {
    throw new Error(`Unable to resolve latest version for ${packageName}`);
  }

  return data.version;
}

function specFor(packageName, version) {
  return pinnedSingletons.has(packageName) ? version : `^${version}`;
}

function exactVersion(spec) {
  return spec.replace(/^[~^]/, '');
}

async function main() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.resolutions ||= {};

  for (const sectionName of ['dependencies', 'devDependencies']) {
    for (const name of Object.keys(packageJson[sectionName] || {})) {
      const version = await getLatestVersion(name);
      const spec = specFor(name, version);
      console.log(`Setting ${sectionName}.${name} -> ${spec}`);
      packageJson[sectionName][name] = spec;
    }
  }

  for (const name of pinnedSingletons) {
    const spec = packageJson.dependencies?.[name] || packageJson.devDependencies?.[name];
    if (spec) {
      packageJson.resolutions[name] = exactVersion(spec);
      console.log(`Setting resolutions.${name} -> ${packageJson.resolutions[name]}`);
    }
  }

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

  console.log('Running yarn install...');
  runYarn(['install']);

  console.log('Running yarn dedupe...');
  runYarn(['dedupe', '--strategy', 'highest']);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});