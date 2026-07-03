# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | ✅ |
| < 1.0 | ❌ |

## Reporting a vulnerability

If you find a security vulnerability in select-lab, **please do not open a public issue**.

Instead, use GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/MonsDz/select_lab/security) of this repository.
2. Click **"Report a vulnerability"**.
3. Describe the issue: what it affects, how to reproduce it, and its potential impact.

You'll get a private response, and a fix + disclosure timeline will be coordinated with you before anything is made public.

## Scope

select-lab is a client-side UI component: it makes no network requests of its own — it only calls the `dataSource`/`src` you configure, against your own API. It stores nothing (no cookies, no `localStorage`, no telemetry). The main risk surface to be aware of as a consumer: the `icon` field (and `renderOption`/`renderLabel`/`iconRenderer` escape hatches) can render raw markup — treat it like `innerHTML` and don't feed it untrusted, unsanitized user input.
