---
layout: home

hero:
  name: KRNL Drive
  text: Self-hosted file storage on Cloudflare
  tagline: R2 storage · Share links · 2FA · Chunked uploads · Admin panel
  actions:
    - theme: brand
      text: Get Started
      link: /setup
    - theme: alt
      text: API Reference
      link: /api

features:
  - title: Cloudflare-native
    details: Runs entirely on Cloudflare Workers, D1, and R2. No servers to manage, scales globally, generous free tier.
  - title: Share links
    details: Generate public share links with configurable expiry dates, view limits, and download limits. Share a dedicated page or a direct download URL.
  - title: Two-factor authentication
    details: Secure accounts with TOTP (authenticator apps), passkeys (WebAuthn / biometrics), and single-use recovery codes.
  - title: Chunked uploads
    details: Large files are uploaded in 5 MB chunks using R2 Multipart Upload. Automatic fallback to simple upload for small files.
  - title: Account management
    details: Admin, user, and guest roles. Admins can create, disable, rename, and delete users from the built-in admin panel.
  - title: Fluent UI
    details: Clean, accessible interface built with Microsoft's Fluent UI v9. Automatic dark and light theme based on system preference.
---
