# Features Guide

## File Management

### Browsing Files

The main drive view shows files and folders in the current directory. Navigate into folders by clicking them. Use the breadcrumb at the top to go back up the tree.

Files can be sorted by name, size, or date by clicking the column headers in the file list.

### Uploading Files

Click **Upload** in the toolbar to open the upload zone. You can:

- Drag and drop files onto the zone
- Click the zone to open a file picker

Multiple files can be uploaded at once. Each file shows a progress bar. Uploads can be cancelled individually.

**Small files (< 10 MB)** are uploaded in a single request.

**Large files (≥ 10 MB)** use chunked multipart upload automatically. If the connection drops, the upload does not need to restart from the beginning — uploaded chunks are preserved on the server (for up to the session TTL).

### Creating Folders

Click **New Folder** in the toolbar and enter a name. Folders can be nested to any depth.

### Renaming

Right-click a file or folder (or use the ⋯ menu) and choose **Rename**.

### Moving

Right-click and choose **Move**. A dialog will show the folders in the current directory to move to. To move to a different location, navigate there first, then move.

### Deleting

- **Single item**: right-click → **Delete**, or use the ⋯ menu.
- **Multiple items**: check the checkboxes next to items, then click **Delete (N)** in the toolbar.

Deleting a folder permanently deletes all its contents and their R2 objects.

### Downloading

- Click the download icon on a file row, or right-click → **Download**.
- Authenticated users download directly through the worker, which streams from R2.
- Public share downloads also stream from R2 with appropriate headers.

---

## Share Links

### Creating a Share

1. Right-click a file → **Share**, or use the ⋯ menu.
2. The Share dialog shows existing share links for that file.
3. Click **Create Share** to generate a new link.
4. Configure optional limits:
   - **Expires in** — hours from now (0 = no expiry)
   - **Max views** — maximum times the share page can be viewed (0 = unlimited)
   - **Max downloads** — maximum times the file can be downloaded (0 = unlimited)

The default values for these fields come from the site settings (configurable by admins).

### Share Page

Each share link points to a public page at `/share/:token`. This page shows:
- File name, type, and size
- Remaining views and downloads (if limits were set)
- Expiry date (if set)
- A download button

No authentication is required to view or download from a share page.

### Share URL vs Download URL

| URL | Behaviour |
|-----|-----------|
| `/share/:token` | Public info page with download button |
| `/api/share/:token/download` | Direct file download (use for `<a href>` or `curl`) |

### Limits and Expiry

Once a share's view or download limit is reached, the share page returns a "not found" error — the link effectively becomes dead. The admin or owner can delete the share and create a new one.

Expired shares (past `expires_at`) behave the same way.

---

## Accounts

### Roles

| Role | Can upload | Can manage files | Admin panel |
|------|-----------|-----------------|-------------|
| `admin` | Yes | Yes (all users' files) | Yes |
| `user` | Yes | Yes (own files) | No |
| `guest` | No | No (read-only) | No |

Guest users can browse and download files (if `guest_can_download` is enabled in settings) but cannot upload, create folders, rename, delete, or create shares.

### Changing Your Password

Go to **Settings** → **Security** → **Change Password**.

---

## Two-Factor Authentication

### TOTP (Authenticator App)

1. Go to **Settings** → **Security** → **Set up authenticator**.
2. Scan the QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.).
3. Enter the 6-digit code to confirm and enable TOTP.

On future logins, after entering your password you'll be prompted for the 6-digit code.

TOTP can be disabled from Settings (requires your current password).

### Passkeys (WebAuthn)

Passkeys use device biometrics or hardware security keys for authentication.

**Adding a passkey:**
1. Go to **Settings** → **Security** → **Add Passkey**.
2. Follow your browser/device prompts (Face ID, Touch ID, Windows Hello, security key, etc.).
3. Give the passkey a name to identify it later.

**Logging in with a passkey:**
- On the login page, click **Sign in with Passkey** instead of entering a username/password.
- Select your passkey when prompted by the browser.

**Managing passkeys:**
- View all registered passkeys in Settings, including their creation date and last used date.
- Delete passkeys you no longer use.

### Recovery Codes

Recovery codes are a fallback if you lose access to your TOTP device or passkeys.

- **Generate codes**: Settings → Security → **Generate Recovery Codes**.
- 8 codes are generated. Each can only be used once.
- Store them somewhere safe (password manager, printed, etc.).
- Generating new codes invalidates all previous codes.

On the login page, if prompted for 2FA, click **Use a recovery code** and enter one of your codes.

---

## Admin Panel

### Users

The Users tab shows all accounts. Admins can:

- **Create users** — specify username, password, and role.
- **Edit users** — change username, password, role, or disable/enable the account.
- **Delete users** — permanently removes the user and all their files.

Restrictions:
- You cannot change your own role or disable your own account.
- The built-in `admin` and `guest` accounts cannot be deleted.

### Settings

The Settings tab controls site-wide configuration:

| Setting | Description |
|---------|-------------|
| Site Name | Displayed in the UI header |
| Allow Registration | If enabled, anyone can create an account at `/register` |
| Guest Can Download | Whether guest users can download files |
| Default Share Expiry | Default expiry for new shares (hours; 0 = no expiry) |
| Default Max Views | Default view limit for new shares (0 = unlimited) |
| Default Max Downloads | Default download limit for new shares (0 = unlimited) |
| Chunk Size | Size of each chunk for large file uploads (bytes) |

### Stats

The Stats tab shows:

- Total registered users
- Total files (not including folders)
- Total folders
- Total storage used (sum of all file sizes)
- Total active share links
