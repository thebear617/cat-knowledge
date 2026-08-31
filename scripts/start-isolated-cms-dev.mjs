import { cp, mkdtemp, lstat, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const verificationRoot = await mkdtemp(path.join(os.tmpdir(), 'cats-cms-verify-'));

await cp(path.join(projectRoot, 'src'), path.join(verificationRoot, 'src'), { recursive: true });

for (const name of ['astro.config.mjs', 'public', 'node_modules', 'package.json', 'tsconfig.json', 'css', 'js']) {
  const source = path.join(projectRoot, name);
  try {
    await lstat(source);
    await symlink(source, path.join(verificationRoot, name));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

console.log(`猫猫手册隔离验收服务工作目录：${verificationRoot}`);
const astro = path.join(projectRoot, 'node_modules', '.bin', 'astro');
const child = spawn(astro, ['dev', '--root', verificationRoot, ...process.argv.slice(2)], {
  cwd: projectRoot,
  env: { ...process.env, CMS_CONTENT_ROOT: path.join(verificationRoot, 'src', 'content', 'science'), CMS_ISOLATED_DEV: '1' },
  stdio: 'inherit',
});

child.once('exit', (code, signal) => process.exitCode = code ?? (signal ? 1 : 0));
