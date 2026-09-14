import { execFileSync } from 'node:child_process';
import { availableParallelism, totalmem, freemem } from 'node:os';
export const GiB = 1024 ** 3;
export interface Measurement { cpu: number; total: number; available: number; measured_at: number; source: string }
export function localMeasurement(): Measurement {
  let available = freemem(), source = 'node:os availableParallelism/totalmem/freemem';
  if (process.platform === 'darwin') {
    try {
      const raw = execFileSync('/usr/bin/vm_stat', { encoding: 'utf8', timeout: 1000 });
      const page = Number(raw.match(/page size of (\d+) bytes/)?.[1]);
      const count = (label: string) => Number(raw.match(new RegExp(label + ':\\s+(\\d+)'))?.[1]);
      const reclaimable = Math.min(count('Pages inactive'), count('File-backed pages')) * page;
      if (Number.isFinite(reclaimable)) { available += reclaimable; source += ' + vm_stat min(inactive,file-backed) reclaimable estimate'; }
    } catch { source += ' (vm_stat unavailable; free memory only)'; }
  }
  return { cpu: availableParallelism(), total: totalmem(), available: Math.min(totalmem(), available), measured_at: Date.now(), source };
}
export function capacityPolicy(sample: Measurement | null, ceiling: number | null = null, time = Date.now()) {
  const fresh = !!sample && time - sample.measured_at >= 0 && time - sample.measured_at <= 30_000 && [sample.cpu, sample.total, sample.available].every(n => Number.isFinite(n) && n > 0);
  const cpu_headroom = fresh ? Math.max(1, Math.ceil(sample!.cpu * .25)) : 0;
  const memory_headroom = fresh ? Math.max(2 * GiB, sample!.total * .125) : 0;
  const cpu_limit = fresh ? Math.max(0, Math.floor((sample!.cpu - cpu_headroom) / 2)) : 0;
  const memory_limit = fresh ? Math.max(0, Math.floor((sample!.available - memory_headroom) / (4 * GiB))) : 0;
  const resource_limit = Math.min(cpu_limit, memory_limit);
  return { fresh, sample, cpu_headroom, memory_headroom, worker_cpu: 2, worker_memory: 4 * GiB, cpu_limit, memory_limit, resource_limit, user_ceiling: ceiling, effective_limit: Math.min(resource_limit, ceiling ?? resource_limit, 1), sequential_limit: 1, reason: !fresh ? 'Resource data missing or stale; refresh before launch.' : resource_limit === 0 ? 'Insufficient CPU or available memory after reserved headroom.' : ceiling === 0 ? 'User capacity ceiling is zero.' : 'One execution at a time until milestone 5A.' };
}
