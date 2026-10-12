import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const dist = path.join(root, 'dist');
function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)],
    );
}
function verify() {
    if (!existsSync(path.join(dist, 'index.html'))) throw new Error('Bitte zuerst npm run build ausführen.');
    const artifacts = files(dist);
    if (artifacts.some(file => /(?:\.map|\.env|\.DS_Store)$/.test(file)))
        throw new Error('Unerwartete Dateien im Build.');
    const scripts = artifacts
        .filter(file => /\.(js|html)$/.test(file))
        .map(file => readFileSync(file, 'utf8'))
        .join('\n');
    if (/gitlab\.ct-srv\.de|@churchtools\/(styleguide|utils)/.test(scripts))
        throw new Error('Private Package-Referenz im Build.');
    const envFile = path.join(root, '.env');
    if (existsSync(envFile)) {
        const env = readFileSync(envFile, 'utf8');
        for (const name of ['VITE_USERNAME', 'VITE_PASSWORD']) {
            const match = env.match(new RegExp(`^${name}=(.*)$`, 'm'));
            const value = match?.[1]?.trim().replace(/^['"]|['"]$/g, '');
            if (value && value.length > 3 && scripts.includes(value))
                throw new Error(`Entwicklungs-Zugangsdaten (${name}) sind im Build enthalten.`);
        }
    }
}
try {
    verify();
    if (process.argv.includes('--verify-only')) {
        console.log('Build-Paket geprüft.');
    } else {
        const content = createHash('sha256');
        for (const file of files(dist)
            .filter(file => !file.endsWith('/build.json'))
            .sort())
            content.update(path.relative(dist, file)).update(readFileSync(file));
        const contentHash = content.digest('hex').slice(0, 12);
        const gitHash = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
        const releases = path.join(root, 'releases');
        mkdirSync(releases, { recursive: true });
        const archive = path.join(releases, `${pkg.name}-v${pkg.version}-${gitHash}-${contentHash}.zip`);
        if (existsSync(archive)) unlinkSync(archive);
        execFileSync('zip', ['-r', archive, 'dist/', '-x', '*.map', '*.DS_Store'], { cwd: root, stdio: 'pipe' });
        console.log(`Paket erstellt: ${archive} (${(statSync(archive).size / 1024 / 1024).toFixed(2)} MB)`);
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
