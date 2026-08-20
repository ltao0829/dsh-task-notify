# Security Policy

## Reporting a vulnerability

If you discover a security issue, please report it privately — do **not** open a public issue.

Preferred: open a private security advisory at
<https://github.com/ltao0829/dsh-task-notify/security/advisories/new>

## Scope

`dsh-task-notify` is a client-side notification plugin. It has:

- no server, network service, or database
- no telemetry or analytics
- no API keys, secrets, or credentials
- local-only configuration (`localStorage`)

Because notifications are generated locally and no conversation content leaves the browser, the attack surface is intentionally small.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | Yes |
