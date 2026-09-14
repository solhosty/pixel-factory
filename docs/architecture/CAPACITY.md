# Execution capacity contract

Packet 2C establishes admission per execution host. It does not enable parallel execution.

The local host is sampled immediately before admission using Node's logical CPU availability and total/free memory. On macOS, available memory also includes the smaller of inactive and file-backed pages from `vm_stat`, treating only that overlap as reclaimable. Measurements expire after 30 seconds. Missing, invalid, or stale measurements produce an effective limit of zero until the next request refreshes the sample.

Each admitted Codex session reserves 2 logical CPUs and 4 GiB of available memory. The policy retains 25% of logical CPUs, with at least one CPU, and 12.5% of total memory, with at least 2 GiB, for macOS, Pixel Harness, and other processes. The resource limit is the smaller CPU-derived and memory-derived limit. A nonnegative user ceiling may lower it. Packet 2C then applies the existing sequential ceiling of one; milestone 5A may add parallel scheduling without bypassing these resource limits.

These are conservative admission estimates, not a guarantee that a workload will fit. CPU and RAM do not capture disk, network, provider, repository, or workload-specific constraints.

Capacity counts `reserved` and `active` session/process slots on their shared `host_id`; employee records do not consume capacity. Admission reserves a slot in the same SQLite transaction that creates the session, attempt, and worker lease. The slot becomes active when the service-owned app-server process has a PID. Cancellation or exit releases the slot only after process ownership reconciliation confirms the process is gone. A lower limit never kills running work.

Rejected assignments remain persisted. Their task receives a distinct waiting-for-capacity record with the effective limit and reason. Packet 2C requires an explicit launch retry after capacity becomes available. Packet 2D owns restart scheduling and automatic recovery.

Coder environments and deterministic remote fixtures persist separately from employee identity and assignments. Until milestone 6, their health remains `not connected`, their measured capacity remains unavailable, and launch returns `REMOTE_UNAVAILABLE`.
