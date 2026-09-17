import { execFile } from 'node:child_process';
import { PixelDatabase } from './database.js';
import { ServiceError } from './types.js';

type Command = (path: string, args: string[]) => Promise<string>;

function command(binary: string, path: string, args: string[]) {
  return new Promise<string>((resolve, reject) => execFile(binary, binary === 'git' ? ['-C', path, ...args] : args, { cwd: binary === 'git' ? undefined : path, encoding: 'utf8', timeout: binary === 'gh' ? 20_000 : 10_000 }, (error, stdout, stderr) => error ? reject(new Error(String(stderr || error.message).trim())) : resolve(String(stdout).trim())));
}

async function refExists(git: Command, path: string, ref: string) { try { await git(path, ['show-ref', '--verify', '--quiet', ref]); return true; } catch { return false; } }

export async function executeDelivery(db: PixelDatabase, taskId: string, confirmed: boolean, dependencies: { git?: Command; gh?: Command } = {}) {
  if (!confirmed) throw new ServiceError('DELIVERY_CONFIRMATION_REQUIRED', 'Confirm this explicit delivery action before it can run.', {}, 409);
  const git = dependencies.git || ((path, args) => command('git', path, args));
  const gh = dependencies.gh || ((path, args) => command('gh', path, args));
  const task = db.taskDetail(taskId); if (!task) throw new ServiceError('NOT_FOUND', 'Task not found', {}, 404);
  const attempt = db.beginDelivery(taskId) as any;
  for (const outcome of attempt.outcomes as any[]) {
    if (outcome.status === 'delivered') continue;
    const folder = (task.folders as any[]).find((item) => item.folder_id === outcome.folder_id); if (!folder) continue;
    if (!['local', 'branch', 'pull_request'].includes(attempt.mode)) { db.recordDeliveryOutcome(taskId, { delivery_attempt_id: attempt.delivery_attempt_id, folder_id: outcome.folder_id, status: 'failed', detail: 'Merge execution is not supported in this local release rehearsal.' }); continue; }
    const baseline = JSON.parse(String(outcome.baseline_json || '{}'));
    try {
      if (!baseline.repository) throw new Error('Selected folder is not a Git repository.');
      if (baseline.status) throw new Error('Pre-existing dirty work was present when delivery began; it was preserved and not committed.');
      const current = await git(folder.canonical_path, ['status', '--porcelain=v1']);
      if (attempt.mode === 'local') { if (!current) throw new Error('No local changes are available for delivery.'); const head = await git(folder.canonical_path, ['rev-parse', 'HEAD']); db.recordDeliveryOutcome(taskId, { delivery_attempt_id: attempt.delivery_attempt_id, folder_id: outcome.folder_id, status: 'delivered', destination: `local working tree at ${head}`, detail: 'Changes deliberately remain uncommitted in the selected repository.' }); continue; }
      const branch = `pixel-harness/${String(taskId).replace(/^tsk_/, '')}`, ref = `refs/heads/${branch}`, currentBranch = await git(folder.canonical_path, ['branch', '--show-current']);
      const exists = await refExists(git, folder.canonical_path, ref);
      if (!current && !exists) { db.recordDeliveryOutcome(taskId, { delivery_attempt_id: attempt.delivery_attempt_id, folder_id: outcome.folder_id, status: 'delivered', destination: `no changes at ${await git(folder.canonical_path, ['rev-parse', 'HEAD'])}`, detail: 'No delivery was needed for this selected repository.' }); continue; }
      if (exists && currentBranch !== branch) throw new Error(`Isolated delivery branch ${branch} already exists; it was preserved instead of being reused.`);
      if (!exists) await git(folder.canonical_path, ['switch', '-c', branch]);
      if (current) { await git(folder.canonical_path, ['add', '-A']); await git(folder.canonical_path, ['commit', '-m', `Pixel Harness: ${String(task.title).slice(0, 72)}`]); }
      const commit = await git(folder.canonical_path, ['rev-parse', 'HEAD']);
      if (attempt.mode === 'branch') { db.recordDeliveryOutcome(taskId, { delivery_attempt_id: attempt.delivery_attempt_id, folder_id: outcome.folder_id, status: 'delivered', destination: `branch ${branch} at ${commit}`, detail: exists ? 'Retried the existing isolated delivery branch.' : 'Created from a clean delivery baseline.' }); continue; }
      await git(folder.canonical_path, ['remote', 'get-url', 'origin']);
      await git(folder.canonical_path, ['push', '--set-upstream', 'origin', branch]);
      let url = ''; try { url = JSON.parse(await gh(folder.canonical_path, ['pr', 'view', '--head', branch, '--json', 'url'])).url || ''; } catch { /* a missing PR is normal */ }
      if (!url) { const settings = db.delivery(String(task.project_id)) as any; const base = String(settings?.default_branch || baseline.branch || 'main'); url = (await gh(folder.canonical_path, ['pr', 'create', '--base', base, '--head', branch, '--title', `Pixel Harness: ${String(task.title).slice(0, 72)}`, '--body', `Created by Pixel Harness delivery attempt ${attempt.delivery_attempt_id}.`])).trim(); }
      if (!url) throw new Error('GitHub did not return a pull request URL.');
      db.recordDeliveryOutcome(taskId, { delivery_attempt_id: attempt.delivery_attempt_id, folder_id: outcome.folder_id, status: 'delivered', destination: url, detail: `Pushed ${branch} at ${commit}; reused an existing PR when present.` });
    } catch (error) { db.recordDeliveryOutcome(taskId, { delivery_attempt_id: attempt.delivery_attempt_id, folder_id: outcome.folder_id, status: 'failed', detail: (error as Error).message }); }
  }
  return db.deliveryForTask(taskId);
}
