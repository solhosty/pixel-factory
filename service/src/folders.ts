import { mkdir, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ServiceError } from './types.js';

export async function canonicalDirectory(candidate: unknown): Promise<string> {
  if (typeof candidate !== 'string' || !isAbsolute(candidate)) throw new ServiceError('INVALID_PATH', 'Choose an absolute local folder path');
  try { const canonical = await realpath(candidate); if (!(await stat(canonical)).isDirectory()) throw new ServiceError('INVALID_PATH', 'The selected path is not a folder'); return canonical; }
  catch (error) { if (error instanceof ServiceError) throw error; throw new ServiceError('PATH_UNAVAILABLE', 'The selected folder is unavailable', { path: candidate }); }
}

export async function browseDirectory(candidate: unknown) {
  const canonical = await canonicalDirectory(typeof candidate === 'string' && candidate ? candidate : homedir());
  const entries = await readdir(canonical, { withFileTypes: true });
  const folders = await Promise.all(entries.filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map(async (entry) => {
    const path = resolve(canonical, entry.name);
    try { return { name: entry.name, path, canonical_path: await canonicalDirectory(path) }; } catch { return null; }
  }));
  return { path: canonical, folders: folders.filter(Boolean).sort((a, b) => a!.name.localeCompare(b!.name)) };
}

export async function createDirectory(parent: unknown, name: unknown) {
  if (typeof name !== 'string' || !/^[^/\\]+$/.test(name.trim()) || name.trim() === '.' || name.trim() === '..') throw new ServiceError('INVALID_FOLDER_NAME', 'Use a single folder name');
  const canonicalParent = await canonicalDirectory(parent);
  const destination = resolve(canonicalParent, name.trim());
  if (!destination.startsWith(`${canonicalParent}/`)) throw new ServiceError('INVALID_PATH', 'Folder must be created inside the selected parent');
  try { await mkdir(destination); } catch (error: unknown) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  return canonicalDirectory(destination);
}

const exec = promisify(execFile);

/** Opens the macOS system folder chooser. The browser never supplies a path. */
export async function chooseNativeDirectory() {
  if (process.platform !== 'darwin') throw new ServiceError('CAPABILITY_MISSING', 'The native folder chooser is available on macOS only', {}, 501);
  try {
    const { stdout } = await exec('osascript', ['-e', 'POSIX path of (choose folder with prompt "Choose a local project folder for Pixel Harness")'], { timeout: 120_000 });
    return canonicalDirectory(stdout.trim());
  } catch (error: unknown) {
    const detail = String((error as { stderr?: string }).stderr || 'Folder selection was cancelled');
    if (/User canceled|cancelled/i.test(detail)) throw new ServiceError('FOLDER_SELECTION_CANCELLED', 'No folder was selected', {}, 409);
    throw new ServiceError('NATIVE_PICKER_FAILED', 'The macOS folder chooser could not open', {}, 502);
  }
}
