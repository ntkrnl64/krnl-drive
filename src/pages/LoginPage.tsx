import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Button,
  Input,
  Field,
  Title1,
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
} from "@fluentui/react-components";
import {
  KeyRegular,
  PersonRegular,
  LockClosedRegular,
  FingerprintRegular,
  ShieldKeyholeRegular,
} from "@fluentui/react-icons";
import { useAuth } from "../contexts/AuthContext.tsx";
import { authApi } from "../api.ts";
import { startAuthentication } from "@simplewebauthn/browser";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";

const useStyles = makeStyles({
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "var(--colorNeutralBackground2)",
  },
  card: {
    width: "400px",
    paddingTop: "32px",
    paddingBottom: "32px",
    paddingLeft: "32px",
    paddingRight: "32px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  header: {
    textAlign: "center",
  },
  icon: {
    fontSize: "40px",
    marginBottom: "8px",
  },
  subText: {
    color: "var(--colorNeutralForeground3)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  errorText: {
    color: "var(--colorPaletteRedForeground1)",
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
          <Title1>{config.siteName}</Title1>
        </div>

        <Divider />

        {/* Row 2: Step label + form */}
        <Text className={styles.subText}>
          {step === "credentials"
            ? "Sign in to your account"
            : step === "totp"
              ? "Two-factor authentication"
              : "Enter recovery code"}
        </Text>

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
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <Divider>or</Divider>
            <Button
              appearance="secondary"
              icon={<FingerprintRegular />}
              onClick={handlePasskeyLogin}
              disabled={loading}
            >
              Sign in with Passkey
            </Button>
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
