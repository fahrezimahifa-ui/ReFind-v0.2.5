# Private runtime storage

Direct HTTP access is denied by Apache. Images are served only through the photo endpoint and its authorization checks.

- `auth/`: per-install secret and atomically locked login-attempt records.
- `sessions/`: PHP server-side sessions, isolated per app/test copy.
- `setup/`: installation receipts and **generated demonstration credentials**. `demo-accounts.json` is local, private, Git-ignored, and excluded from submission ZIP.
- `items/`, `evidence/`, `claims/`: current signed-in report photos, private Lost evidence and private claim evidence collections.
- `avatars/`: prepared profile JPEGs referenced by `users.avatar_path`, delivered through authenticated `api/avatar.php`. Include these files in backups and recovery checks.

These runtime files are not application source. Do not publish the secret, sessions, or generated credential receipts.

Registration uses private `auth/registration-attempts.json`. Configuration rollback backups stay outside Apache, Git worktrees and exported evidence. Never copy main runtime files into QA.
