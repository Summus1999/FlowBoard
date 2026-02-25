#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const lockFilePath = path.join(projectRoot, 'package-lock.json');
const nodeModulesPath = path.join(projectRoot, 'node_modules');
const cacheDir = path.join(os.homedir(), '.cache', 'flowboard');
const lockHashFilePath = path.join(cacheDir, 'npm-lock.sha256');

function log(message) {
    console.log(`[deps] ${message}`);
}

function ensureCacheDir() {
    fs.mkdirSync(cacheDir, { recursive: true });
}

function readFileSafe(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8').trim();
    } catch (_error) {
        return '';
    }
}

function writeFileSafe(filePath, content) {
    fs.writeFileSync(filePath, content, 'utf8');
}

function fileExists(filePath) {
    return fs.existsSync(filePath);
}

function computeLockHash() {
    const lockContent = fs.readFileSync(lockFilePath);
    return crypto.createHash('sha256').update(lockContent).digest('hex');
}

function runNpmInstallByLock() {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const env = { ...process.env };

    if (!env.ELECTRON_MIRROR) {
        env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
    }

    const result = spawnSync(
        npmCmd,
        ['ci', '--prefer-offline', '--no-audit'],
        {
            cwd: projectRoot,
            stdio: 'inherit',
            env
        }
    );

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

function main() {
    if (!fileExists(lockFilePath)) {
        log('package-lock.json not found, skip dependency bootstrap.');
        process.exit(0);
    }

    ensureCacheDir();

    const currentHash = computeLockHash();
    const cachedHash = readFileSafe(lockHashFilePath);
    const hasNodeModules = fileExists(nodeModulesPath);
    const lockChanged = currentHash !== cachedHash;
    const shouldInstall = !hasNodeModules || lockChanged;

    if (!shouldInstall) {
        log('Dependencies are up to date, skip npm ci.');
        process.exit(0);
    }

    const reason = !hasNodeModules ? 'node_modules missing' : 'lockfile changed';
    log(`Running npm ci (${reason}) ...`);
    runNpmInstallByLock();
    writeFileSafe(lockHashFilePath, currentHash);
    log('Dependency bootstrap completed.');
}

main();
