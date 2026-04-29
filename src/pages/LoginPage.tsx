import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Button,
  Input,
  Field,
  Title2,
  Text,
  Spinner,
  Card,
  Divider,
  Toast,
  Toaster,
  useToastController,
  Tab,
  TabList,
  MessageBar,
  MessageBarBody,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import {
  KeyRegular,
  PersonRegular,
  LockClosedRegular,
  FingerprintRegular,
  ShieldKeyholeRegular,
  GlobeRegular,
  CloudRegular,
} from "@fluentui/react-icons";
import { useAuth } from "../contexts/AuthContext.tsx";
import { authApi, prismApi } from "../api.ts";
import { startAuthentication } from "@simplewebauthn/browser";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background:
      "radial-gradient(circle at 20% 0%, var(--colorBrandBackground2) 0%, transparent 45%)," +
      "radial-gradient(circle at 80% 100%, var(--colorPaletteBerryBackground2, var(--colorBrandBackground2)) 0%, transparent 45%)," +
      "var(--colorNeutralBackground2)",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    paddingTop: "32px",
    paddingBottom: "28px",
    paddingLeft: "32px",
    paddingRight: "32px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    backgroundColor: "var(--colorNeutralBackground1)",
    boxShadow:
      "0 8px 32px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px var(--colorNeutralStroke2)",
    ...shorthands.borderRadius("12px"),
  },
  header: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  brandMark: {
    width: "56px",
    height: "56px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.borderRadius("14px"),
    background:
      "linear-gradient(135deg, var(--colorBrandBackground) 0%, var(--colorBrandBackgroundHover) 100%)",
    color: "var(--colorNeutralForegroundOnBrand)",
    fontSize: "28px",
    boxShadow:
      "0 6px 16px rgba(0, 90, 200, 0.25), inset 0 1px 0 rgba(255,255,255,0.2)",
  },
  brandImg: {
    width: "56px",
    height: "56px",
    objectFit: "cover",
    ...shorthands.borderRadius("14px"),
  },
  icon: {
    fontSize: "40px",
    marginBottom: "8px",
  },
  subText: {
    color: "var(--colorNeutralForeground3)",
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  primarySubmit: {
    height: "40px",
  },
  altButton: {
    height: "40px",
    justifyContent: "center",
  },
  errorText: {
    color: "var(--colorPaletteRedForeground1)",
    fontSize: "13px",
  },
  footerHint: {
    textAlign: "center",
    color: "var(--colorNeutralForeground4)",
    fontSize: "12px",
  },
});

type Step = "credentials" | "totp" | "recovery";

export default function LoginPage() {
  const styles = useStyles();
  const { login, refresh, config } = useAuth();
  const { dispatchToast } = useToastController();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [available2fa, setAvailable2fa] = useState<string[]>([]);

  // Surface OAuth callback errors passed via ?error=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const err = params.get("error");
    if (err) {
      setError(`Login failed: ${err.replace(/_/g, " ")}`);
      const next = new URL(window.location.href);
      next.searchParams.delete("error");
      window.history.replaceState({}, "", next.toString());
    }
  }, [location.search]);

  const showError = (msg: string) => {
    setError(msg);
    dispatchToast(
      <Toast>
        <MessageBar intent="error">
          <MessageBarBody>{msg}</MessageBarBody>
        </MessageBar>
      </Toast>,
      { intent: "error" },
    );
  };

  const goAfterLogin = async () => {
    await refresh();
    navigate(from, { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(username, password);
      if (res.requiresTwoFactor) {
        setAvailable2fa(res.methods ?? ["totp"]);
        setStep("totp");
      } else {
        await goAfterLogin();
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.verifyTotp(code);
      await goAfterLogin();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.verifyRecovery(code);
      await goAfterLogin();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Invalid recovery code");
    } finally {
      setLoading(false);
    }
  };

  const handlePrismLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await prismApi.start({ redirectTo: from });
      window.location.href = res.url;
    } catch (err) {
      showError(err instanceof Error ? err.message : "Prism login failed");
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const beginRes = await authApi.passkeyAuthBegin(username || undefined);
      const response = await startAuthentication({
        optionsJSON: beginRes.options as Parameters<
          typeof startAuthentication
        >[0]["optionsJSON"],
      });
      await authApi.passkeyAuthComplete(
        beginRes.challengeId,
        response as unknown as AuthenticationResponseJSON,
      );
      await goAfterLogin();
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Passkey authentication failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <Toaster position="top-end" />
      <Card className={styles.card}>
        {/* Row 1: Branding */}
        <div className={styles.header}>
          {config.siteIconUrl ? (
            <img src={config.siteIconUrl} alt="" className={styles.brandImg} />
          ) : (
            <span className={styles.brandMark}>
              <CloudRegular />
            </span>
          )}
          <Title2 style={{ marginTop: 4 }}>{config.siteName}</Title2>
          <Text className={styles.subText}>
            {step === "credentials"
              ? "Sign in to your account"
              : step === "totp"
                ? "Two-factor authentication"
                : "Enter recovery code"}
          </Text>
        </div>

        {/* Credentials step */}
        {step === "credentials" && (
          <form onSubmit={handleLogin} className={styles.form}>
            <Field label="Username">
              <Input
                contentBefore={<PersonRegular />}
                value={username}
                onChange={(_, d) => setUsername(d.value)}
                placeholder="admin"
                required
                autoFocus
              />
            </Field>
            <Field label="Password">
              <Input
                contentBefore={<LockClosedRegular />}
                type="password"
                value={password}
                onChange={(_, d) => setPassword(d.value)}
                placeholder="••••••••"
                required
              />
            </Field>
            {error && <Text className={styles.errorText}>{error}</Text>}
            <Button
              appearance="primary"
              type="submit"
              disabled={loading}
              icon={loading ? <Spinner size="tiny" /> : undefined}
              className={styles.primarySubmit}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <Divider>or continue with</Divider>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Button
                appearance="secondary"
                icon={<FingerprintRegular />}
                onClick={handlePasskeyLogin}
                disabled={loading}
                className={styles.altButton}
              >
                Passkey
              </Button>
              {config.prismEnabled && (
                <Button
                  appearance="secondary"
                  icon={<GlobeRegular />}
                  onClick={handlePrismLogin}
                  disabled={loading}
                  className={styles.altButton}
                >
                  Sign in with Prism
                </Button>
              )}
            </div>
          </form>
        )}

        {/* TOTP step */}
        {step === "totp" && (
          <>
            <TabList
              selectedValue={step === "totp" ? "totp" : "recovery"}
              onTabSelect={(_, d) => setStep(d.value as Step)}
            >
              {available2fa.includes("totp") && (
                <Tab value="totp" icon={<ShieldKeyholeRegular />}>
                  Authenticator
                </Tab>
              )}
              {available2fa.includes("recovery") && (
                <Tab value="recovery" icon={<KeyRegular />}>
                  Recovery Code
                </Tab>
              )}
            </TabList>
            <form onSubmit={handleTotpVerify} className={styles.form}>
              <Field
                label="6-digit code"
                hint="Enter the code from your authenticator app"
              >
                <Input
                  value={code}
                  onChange={(_, d) => setCode(d.value.replace(/\s/g, ""))}
                  placeholder="000000"
                  maxLength={6}
                  pattern="\d{6}"
                  inputMode="numeric"
                  autoFocus
                />
              </Field>
              {error && <Text className={styles.errorText}>{error}</Text>}
              <Button
                appearance="primary"
                type="submit"
                disabled={loading || code.length !== 6}
              >
                {loading ? <Spinner size="tiny" /> : "Verify"}
              </Button>
              <Button
                appearance="subtle"
                onClick={() => {
                  setStep("recovery");
                  setCode("");
                }}
              >
                Use recovery code instead
              </Button>
            </form>
          </>
        )}

        {/* Recovery step */}
        {step === "recovery" && (
          <form onSubmit={handleRecoveryVerify} className={styles.form}>
            <Field
              label="Recovery code"
              hint="Enter one of your 8-character recovery codes"
            >
              <Input
                contentBefore={<KeyRegular />}
                value={code}
                onChange={(_, d) => setCode(d.value)}
                placeholder="xxxxx-xxxxx-xxxxx-xxxxx"
                autoFocus
              />
            </Field>
            {error && <Text className={styles.errorText}>{error}</Text>}
            <Button
              appearance="primary"
              type="submit"
              disabled={loading || !code}
            >
              {loading ? <Spinner size="tiny" /> : "Verify"}
            </Button>
            <Button
              appearance="subtle"
              onClick={() => {
                setStep("totp");
                setCode("");
              }}
            >
              Use authenticator app instead
            </Button>
          </form>
        )}

        {step !== "credentials" && (
          <Button
            appearance="subtle"
            onClick={() => {
              setStep("credentials");
              setCode("");
              setError("");
            }}
          >
            Back to login
          </Button>
        )}
      </Card>
    </div>
  );
}
