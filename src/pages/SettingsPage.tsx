import { useState, useEffect } from 'react';
import {
  Title2, Text, Button, Field, Input, Spinner, Card, Avatar,
  Divider, Badge, Accordion, AccordionItem, AccordionHeader,
  AccordionPanel, Toast, useToastController,
  MessageBar, MessageBarBody, Table, TableHeader, TableRow, TableHeaderCell,
  TableBody, TableCell, TableCellLayout, makeStyles, shorthands,
} from '@fluentui/react-components';
import {
  ShieldCheckmarkRegular, KeyRegular, FingerprintRegular, CopyRegular,
  DeleteRegular, CheckmarkRegular, AddRegular, LockClosedRegular, LinkRegular, PersonRegular
} from '@fluentui/react-icons';
import { useAuth } from '../contexts/AuthContext.tsx';
import { authApi } from '../api.ts';
import { startRegistration } from '@simplewebauthn/browser';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import type { Passkey } from '../types.ts';
import { ChangePasswordDialog } from '../components/Dialogs.tsx';

const useStyles = makeStyles({
  root: {
    maxWidth: '720px',
    margin: '0 auto',
    ...shorthands.padding('24px', '16px'),
  },
  title: {
    marginBottom: '24px',
  },
  card: {
    marginBottom: '16px',
  },
  cardContent: {
    ...shorthands.padding('16px'),
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardContentLargeGap: {
    ...shorthands.padding('16px'),
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  alignStart: {
    alignSelf: 'flex-start',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  qrContainer: {
    backgroundColor: 'white',
    ...shorthands.padding('16px'),
    ...shorthands.borderRadius('8px'),
    textAlign: 'center',
    ...shorthands.border('1px', 'solid', 'var(--colorNeutralStroke2)'),
  },
  qrImage: {
    width: '200px',
    height: '200px',
  },
  secretContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  secretText: {
    fontFamily: 'monospace',
    letterSpacing: '2px',
  },
  inputGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-end',
  },
  flex1: {
    flexGrow: 1,
  },
  successText: {
    color: 'var(--colorPaletteGreenForeground1)',
  },
  dangerButton: {
    backgroundColor: 'var(--colorPaletteRedBackground3)',
    color: 'white',
    '&:hover': {
      backgroundColor: 'var(--colorPaletteRedBackground3Hover)',
      color: 'white',
    },
    '&:active': {
      backgroundColor: 'var(--colorPaletteRedBackground3Pressed)',
      color: 'white',
    }
  },
  recoveryCodesContainer: {
    backgroundColor: 'var(--colorNeutralBackground3)',
    ...shorthands.borderRadius('8px'),
    ...shorthands.padding('16px'),
  },
  recoveryWarning: {
    marginBottom: '8px',
  },
  recoverySubWarning: {
    color: 'var(--colorNeutralForeground3)',
    marginBottom: '12px',
  },
  codesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px',
    marginBottom: '12px',
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: '13px',
  },
  emptyText: {
    color: 'var(--colorNeutralForeground3)',
  },
  columnWidth60: {
    width: '60px',
  },
  avatarPreviewRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
});

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      appearance="subtle"
      size="small"
      icon={copied ? <CheckmarkRegular /> : <CopyRegular />}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    />
  );
}

export default function SettingsPage() {
  const styles = useStyles();
  const { user, refresh } = useAuth();
  const { dispatchToast } = useToastController();

  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(false);

  // TOTP setup state
  const [totpSetupData, setTotpSetupData] = useState<{ secret: string; uri: string } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disableTotpCode, setDisableTotpCode] = useState('');

  // Passkey state
  const [passkeyName, setPasskeyName] = useState('');
  const [addingPasskey, setAddingPasskey] = useState(false);

  // Password dialog
  const [pwDialogOpen, setPwDialogOpen] = useState(false);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '');
  const [savingAvatar, setSavingAvatar] = useState(false);

  const handleSaveAvatar = async () => {
    setSavingAvatar(true);
    try {
      await authApi.updateMe({ avatarUrl: avatarUrl.trim() || null });
      await refresh();
      toast('Avatar updated');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setSavingAvatar(false);
    }
  };

  // User share defaults
  const [defaultShareTitle, setDefaultShareTitle] = useState(user?.default_share_title ?? '');
  const [defaultShareDescription, setDefaultShareDescription] = useState(user?.default_share_description ?? '');
  const [savingDefaults, setSavingDefaults] = useState(false);

  const handleSaveDefaults = async () => {
    setSavingDefaults(true);
    try {
      await authApi.updateMe({
        defaultShareTitle: defaultShareTitle.trim() || null,
        defaultShareDescription: defaultShareDescription.trim() || null,
      });
      await refresh();
      toast('Share defaults updated');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update', 'error');
    } finally {
      setSavingDefaults(false);
    }
  };

  const toast = (msg: string, intent: 'success' | 'error' = 'success') =>
    dispatchToast(
      <Toast>
        <MessageBar intent={intent}><MessageBarBody>{msg}</MessageBarBody></MessageBar>
      </Toast>,
      { intent }
    );

  const loadPasskeys = async () => {
    setLoadingPasskeys(true);
    try {
      const res = await authApi.listPasskeys();
      setPasskeys(res.passkeys);
    } finally {
      setLoadingPasskeys(false);
    }
  };

  useEffect(() => { void loadPasskeys(); }, []);

  // ─── TOTP ────────────────────────────────────────────────────────────────────
  const handleTotpSetup = async () => {
    setTotpLoading(true);
    try {
      const res = await authApi.setupTotp();
      setTotpSetupData(res);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setTotpLoading(false);
    }
  };

  const handleTotpVerify = async () => {
    setTotpLoading(true);
    try {
      const res = await authApi.verifyTotpSetup(totpCode);
      setRecoveryCodes(res.recoveryCodes);
      setTotpSetupData(null);
      setTotpCode('');
      await refresh();
      toast('Two-factor authentication enabled!');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Invalid code', 'error');
    } finally {
      setTotpLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    setTotpLoading(true);
    try {
      await authApi.disableTotp(disableTotpCode);
      setDisableTotpCode('');
      await refresh();
      toast('Two-factor authentication disabled');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally {
      setTotpLoading(false);
    }
  };

  const handleRegenerateRecoveryCodes = async () => {
    try {
      const res = await authApi.regenerateRecoveryCodes();
      setRecoveryCodes(res.codes);
      toast('Recovery codes regenerated');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };

  // ─── Passkeys ────────────────────────────────────────────────────────────────
  const handleAddPasskey = async () => {
    setAddingPasskey(true);
    try {
      const begin = await authApi.passkeyRegisterBegin();
      const response = await startRegistration({ optionsJSON: begin.options as Parameters<typeof startRegistration>[0]['optionsJSON'] });
      await authApi.passkeyRegisterComplete(begin.challengeId, response as unknown as RegistrationResponseJSON, passkeyName || 'My Passkey');
      setPasskeyName('');
      await loadPasskeys();
      toast('Passkey added successfully!');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to add passkey', 'error');
    } finally {
      setAddingPasskey(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    try {
      await authApi.deletePasskey(id);
      await loadPasskeys();
      toast('Passkey removed');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error');
    }
  };

  if (user?.role === 'guest') {
    return (
      <div className={styles.root}>
        <Title2 className={styles.title}>Account Settings</Title2>
        <MessageBar intent="warning">
          <MessageBarBody>Guest accounts cannot modify account settings.</MessageBarBody>
        </MessageBar>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Title2 className={styles.title}>Account Settings</Title2>

      <Accordion collapsible multiple defaultOpenItems={['password', 'totp']}>

        {/* Avatar */}
        <AccordionItem value="avatar">
          <AccordionHeader icon={<PersonRegular />}>
            <Text weight="semibold">Profile Avatar</Text>
          </AccordionHeader>
          <AccordionPanel>
            <Card className={styles.card}>
              <div className={styles.cardContentLargeGap}>
                <div className={styles.avatarPreviewRow}>
                  <Avatar
                    name={user?.username}
                    image={avatarUrl ? { src: avatarUrl } : undefined}
                    size={64}
                  />
                  <Text size={200} style={{ color: 'var(--colorNeutralForeground3)' }}>
                    Enter a URL to use as your profile picture. Shown on share pages.
                  </Text>
                </div>
                <Field label="Avatar URL">
                  <Input
                    value={avatarUrl}
                    onChange={(_, d) => setAvatarUrl(d.value)}
                    placeholder="https://example.com/avatar.png"
                  />
                </Field>
                <Button
                  appearance="primary"
                  icon={savingAvatar ? <Spinner size="tiny" /> : <CheckmarkRegular />}
                  onClick={handleSaveAvatar}
                  disabled={savingAvatar || avatarUrl === (user?.avatar_url ?? '')}
                  className={styles.alignStart}
                >
                  Save Avatar
                </Button>
              </div>
            </Card>
          </AccordionPanel>
        </AccordionItem>

        {/* Password */}
        <AccordionItem value="password">
          <AccordionHeader icon={<LockClosedRegular />}>
            <Text weight="semibold">Password</Text>
          </AccordionHeader>
          <AccordionPanel>
            <Card className={styles.card}>
              <div className={styles.cardContent}>
                <Text>Change your account password.</Text>
                <Button
                  icon={<LockClosedRegular />}
                  onClick={() => setPwDialogOpen(true)}
                  className={styles.alignStart}
                >
                  Change password
                </Button>
              </div>
            </Card>
          </AccordionPanel>
        </AccordionItem>

        {/* Share Defaults */}
        <AccordionItem value="shareDefaults">
          <AccordionHeader icon={<LinkRegular />}>
            <Text weight="semibold">Share Link Defaults</Text>
          </AccordionHeader>
          <AccordionPanel>
            <Card className={styles.card}>
              <div className={styles.cardContentLargeGap}>
                <Text>Configure default title and description for your share links.</Text>
                <Field label="Default Share Title">
                  <Input
                    value={defaultShareTitle}
                    onChange={(_, d) => setDefaultShareTitle(d.value)}
                    placeholder="E.g., Shared by My Username"
                  />
                </Field>
                <Field label="Default Share Description">
                  <Input
                    value={defaultShareDescription}
                    onChange={(_, d) => setDefaultShareDescription(d.value)}
                    placeholder="E.g., Here is a file I shared with you."
                  />
                </Field>
                <Button
                  appearance="primary"
                  icon={savingDefaults ? <Spinner size="tiny" /> : <CheckmarkRegular />}
                  onClick={handleSaveDefaults}
                  disabled={savingDefaults || (defaultShareTitle === (user?.default_share_title ?? '') && defaultShareDescription === (user?.default_share_description ?? ''))}
                  className={styles.alignStart}
                >
                  Save Defaults
                </Button>
              </div>
            </Card>
          </AccordionPanel>
        </AccordionItem>

        {/* TOTP */}
        <AccordionItem value="totp">
          <AccordionHeader icon={<ShieldCheckmarkRegular />}>
            <div className={styles.headerContent}>
              <Text weight="semibold">Two-Factor Authentication (TOTP)</Text>
              <Badge color={user?.totp_enabled ? 'success' : 'subtle'} size="small">
                {user?.totp_enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </AccordionHeader>
          <AccordionPanel>
            <Card className={styles.card}>
              <div className={styles.cardContentLargeGap}>
                {!user?.totp_enabled && !totpSetupData && (
                  <>
                    <Text>Protect your account with a time-based one-time password (TOTP) authenticator app like Google Authenticator or Authy.</Text>
                    <Button
                      appearance="primary"
                      icon={totpLoading ? <Spinner size="tiny" /> : <ShieldCheckmarkRegular />}
                      onClick={handleTotpSetup}
                      disabled={totpLoading}
                      className={styles.alignStart}
                    >
                      Set up 2FA
                    </Button>
                  </>
                )}

                {totpSetupData && (
                  <div className={styles.cardContent}>
                    <Text weight="semibold">1. Scan the QR code or enter the key manually</Text>
                    <div className={styles.qrContainer}>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(totpSetupData.uri)}&size=200x200`}
                        alt="TOTP QR code"
                        className={styles.qrImage}
                      />
                    </div>
                    <div className={styles.secretContainer}>
                      <Text size={200} className={styles.secretText}>
                        {totpSetupData.secret}
                      </Text>
                      <CopyText text={totpSetupData.secret} />
                    </div>

                    <Divider />

                    <Text weight="semibold">2. Enter the 6-digit code from your app</Text>
                    <div className={styles.inputGroup}>
                      <Field label="Verification code" className={styles.flex1}>
                        <Input
                          value={totpCode}
                          onChange={(_, d) => setTotpCode(d.value.replace(/\D/g, ''))}
                          placeholder="000000"
                          maxLength={6}
                          inputMode="numeric"
                        />
                      </Field>
                      <Button
                        appearance="primary"
                        onClick={handleTotpVerify}
                        disabled={totpLoading || totpCode.length !== 6}
                      >
                        {totpLoading ? <Spinner size="tiny" /> : 'Verify & Enable'}
                      </Button>
                    </div>
                    <Button appearance="subtle" onClick={() => setTotpSetupData(null)}>Cancel</Button>
                  </div>
                )}

                {user?.totp_enabled && !totpSetupData && (
                  <>
                    <Text className={styles.successText}>
                      ✓ Two-factor authentication is enabled
                    </Text>

                    <Divider />

                    <Text weight="semibold">Disable 2FA</Text>
                    <div className={styles.inputGroup}>
                      <Field label="Enter current TOTP code to disable" className={styles.flex1}>
                        <Input
                          value={disableTotpCode}
                          onChange={(_, d) => setDisableTotpCode(d.value.replace(/\D/g, ''))}
                          placeholder="000000"
                          maxLength={6}
                        />
                      </Field>
                      <Button
                        onClick={handleDisableTotp}
                        disabled={totpLoading || disableTotpCode.length !== 6}
                        className={styles.dangerButton}
                      >
                        Disable 2FA
                      </Button>
                    </div>

                    <Divider />

                    <Text weight="semibold">Recovery Codes</Text>
                    <Button
                      icon={<KeyRegular />}
                      onClick={handleRegenerateRecoveryCodes}
                      className={styles.alignStart}
                    >
                      Regenerate recovery codes
                    </Button>
                  </>
                )}

                {recoveryCodes.length > 0 && (
                  <div className={styles.recoveryCodesContainer}>
                    <Text weight="semibold" block className={styles.recoveryWarning}>
                      Save these recovery codes in a safe place!
                    </Text>
                    <Text size={200} block className={styles.recoverySubWarning}>
                      Each code can only be used once. They will not be shown again.
                    </Text>
                    <div className={styles.codesGrid}>
                      {recoveryCodes.map(code => (
                        <Text key={code} className={styles.codeText}>{code}</Text>
                      ))}
                    </div>
                    <Button
                      size="small"
                      icon={<CopyRegular />}
                      onClick={() => void navigator.clipboard.writeText(recoveryCodes.join('\n'))}
                    >
                      Copy all codes
                    </Button>
                    <Button size="small" appearance="subtle" onClick={() => setRecoveryCodes([])}>
                      I've saved these codes
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </AccordionPanel>
        </AccordionItem>

        {/* Passkeys */}
        <AccordionItem value="passkeys">
          <AccordionHeader icon={<FingerprintRegular />}>
            <Text weight="semibold">Passkeys</Text>
          </AccordionHeader>
          <AccordionPanel>
            <Card className={styles.card}>
              <div className={styles.cardContentLargeGap}>
                <Text>Passkeys let you sign in with biometrics or a hardware security key.</Text>

                {/* Add passkey */}
                <div className={styles.inputGroup}>
                  <Field label="Passkey name (optional)" className={styles.flex1}>
                    <Input
                      value={passkeyName}
                      onChange={(_, d) => setPasskeyName(d.value)}
                      placeholder="My passkey"
                    />
                  </Field>
                  <Button
                    appearance="primary"
                    icon={addingPasskey ? <Spinner size="tiny" /> : <AddRegular />}
                    onClick={handleAddPasskey}
                    disabled={addingPasskey}
                  >
                    Add passkey
                  </Button>
                </div>

                {/* Passkeys list */}
                {loadingPasskeys ? <Spinner size="small" /> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell>Name</TableHeaderCell>
                        <TableHeaderCell>Created</TableHeaderCell>
                        <TableHeaderCell>Last used</TableHeaderCell>
                        <TableHeaderCell className={styles.columnWidth60}></TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {passkeys.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4}>
                            <TableCellLayout>
                              <Text className={styles.emptyText}>No passkeys added yet</Text>
                            </TableCellLayout>
                          </TableCell>
                        </TableRow>
                      ) : passkeys.map(pk => (
                        <TableRow key={pk.id}>
                          <TableCell><TableCellLayout>{pk.name}</TableCellLayout></TableCell>
                          <TableCell>
                            <TableCellLayout>
                              {new Date(pk.created_at).toLocaleDateString()}
                            </TableCellLayout>
                          </TableCell>
                          <TableCell>
                            <TableCellLayout>
                              {pk.last_used_at ? new Date(pk.last_used_at).toLocaleDateString() : '—'}
                            </TableCellLayout>
                          </TableCell>
                          <TableCell>
                            <TableCellLayout>
                              <Button
                                appearance="subtle"
                                size="small"
                                icon={<DeleteRegular />}
                                onClick={() => void handleDeletePasskey(pk.id)}
                              />
                            </TableCellLayout>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </Card>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      <ChangePasswordDialog
        open={pwDialogOpen}
        onClose={() => setPwDialogOpen(false)}
        onSubmit={async (c, n) => { await authApi.changePassword(c, n); }}
      />
    </div>
  );
}