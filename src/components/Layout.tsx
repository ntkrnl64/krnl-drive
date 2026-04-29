import { useState } from "react";
import {
  Avatar,
  Button,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
  Text,
  Badge,
  Toaster,
  makeStyles,
  shorthands,
  mergeClasses,
} from "@fluentui/react-components";
import {
  FolderRegular,
  SettingsRegular,
  PersonRegular,
  SignOutRegular,
  ShieldPersonRegular,
  NavigationRegular,
  DismissRegular,
  LinkRegular,
} from "@fluentui/react-icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.tsx";
import type { ReactNode } from "react";

const useStyles = makeStyles({
  root: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    backgroundColor: "var(--colorNeutralBackground1)",
    position: "relative",
  },
  sidebar: {
    width: "260px",
    ...shorthands.borderRight("1px", "solid", "var(--colorNeutralStroke2)"),
    display: "flex",
    flexDirection: "column",
    backgroundColor: "var(--colorNeutralBackground2)",
    flexShrink: 0,
    transitionDuration: "0.3s",
    transitionProperty: "transform",
    zIndex: 1000,
    "@media (max-width: 768px)": {
      position: "absolute",
      height: "100%",
      transform: "translateX(-100%)",
    },
  },
  sidebarOpen: {
    "@media (max-width: 768px)": {
      transform: "translateX(0)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.24)",
    },
  },
  logoContainer: {
    padding: "20px 20px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  logoText: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
  },
  logoIcon: {
    width: "32px",
    height: "32px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.borderRadius("8px"),
    background:
      "linear-gradient(135deg, var(--colorBrandBackground) 0%, var(--colorBrandBackgroundHover) 100%)",
    color: "var(--colorNeutralForegroundOnBrand)",
    flexShrink: 0,
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
  },
  logoIconImg: {
    width: "32px",
    height: "32px",
    objectFit: "cover",
    ...shorthands.borderRadius("8px"),
    flexShrink: 0,
  },
  closeSidebarBtn: {
    display: "none",
    "@media (max-width: 768px)": {
      display: "block",
    },
  },
  navContainer: {
    flexGrow: 1,
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    overflowY: "auto",
  },
  navSectionLabel: {
    padding: "8px 12px 4px",
    color: "var(--colorNeutralForeground4)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontSize: "11px",
    fontWeight: 600,
  },
  navItem: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "9px 12px 9px 14px",
    border: "none",
    backgroundColor: "transparent",
    color: "var(--colorNeutralForeground2)",
    cursor: "pointer",
    fontSize: "14px",
    ...shorthands.borderRadius("8px"),
    width: "100%",
    textAlign: "left",
    transitionProperty: "background-color, color",
    transitionDuration: "0.15s",
    "&:hover": {
      backgroundColor: "var(--colorNeutralBackground1Hover)",
      color: "var(--colorNeutralForeground1)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--colorStrokeFocus2)",
      outlineOffset: "1px",
    },
  },
  navItemSelected: {
    backgroundColor: "var(--colorBrandBackground2)",
    color: "var(--colorBrandForeground1)",
    fontWeight: 600,
    "&:hover": {
      backgroundColor: "var(--colorBrandBackground2Hover)",
      color: "var(--colorBrandForeground1)",
    },
    "&::before": {
      content: '""',
      position: "absolute",
      left: "-10px",
      top: "8px",
      bottom: "8px",
      width: "3px",
      ...shorthands.borderRadius("0", "2px", "2px", "0"),
      backgroundColor: "var(--colorBrandForeground1)",
    },
  },
  userSection: {
    ...shorthands.borderTop("1px", "solid", "var(--colorNeutralStroke2)"),
    padding: "10px",
  },
  userButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "8px 10px",
    ...shorthands.borderRadius("8px"),
    transitionProperty: "background-color",
    transitionDuration: "0.15s",
    "&:hover": {
      backgroundColor: "var(--colorNeutralBackground1Hover)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--colorStrokeFocus2)",
      outlineOffset: "1px",
    },
  },
  userInfo: {
    flexGrow: 1,
    textAlign: "left",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  mainContent: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  },
  mobileHeader: {
    display: "none",
    alignItems: "center",
    padding: "12px 16px",
    ...shorthands.borderBottom("1px", "solid", "var(--colorNeutralStroke2)"),
    backgroundColor: "var(--colorNeutralBackground2)",
    gap: "12px",
    "@media (max-width: 768px)": {
      display: "flex",
    },
  },
  pageContent: {
    flexGrow: 1,
    overflowY: "auto",
    overflowX: "hidden",
  },
  overlay: {
    display: "none",
    "@media (max-width: 768px)": {
      display: "block",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.4)",
      zIndex: 999,
      backdropFilter: "blur(2px)",
    },
  },
});

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const styles = useStyles();
  const { user, logout, config } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(location.pathname);

  // Close sidebar on route change for mobile
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setSidebarOpen(false);
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const navItems = [
    { path: "/", label: "Files", icon: <FolderRegular fontSize={20} /> },
    ...(user?.role !== "guest"
      ? [
          {
            path: "/shares",
            label: "Shares",
            icon: <LinkRegular fontSize={20} />,
          },
        ]
      : []),
    ...(user?.role === "admin"
      ? [
          {
            path: "/admin",
            label: "Admin",
            icon: <ShieldPersonRegular fontSize={20} />,
          },
        ]
      : []),
    ...(user?.role !== "guest"
      ? [
          {
            path: "/settings",
            label: "Settings",
            icon: <SettingsRegular fontSize={20} />,
          },
        ]
      : []),
  ];

  return (
    <div className={styles.root}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <nav
        className={mergeClasses(
          styles.sidebar,
          sidebarOpen && styles.sidebarOpen,
        )}
      >
        {/* Logo */}
        <div className={styles.logoContainer}>
          <div className={styles.logoText}>
            {config.siteIconUrl ? (
              <img
                src={config.siteIconUrl}
                alt=""
                className={styles.logoIconImg}
              />
            ) : (
              <span className={styles.logoIcon}>
                <FolderRegular fontSize={18} />
              </span>
            )}
            <Text weight="semibold" size={400} truncate block>
              {config.siteName}
            </Text>
          </div>
          <Button
            appearance="subtle"
            icon={<DismissRegular />}
            onClick={() => setSidebarOpen(false)}
            className={styles.closeSidebarBtn}
          />
        </div>

        {/* Nav links */}
        <div className={styles.navContainer}>
          <div className={styles.navSectionLabel}>Workspace</div>
          {navItems.map((item) => {
            const isSelected =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={mergeClasses(
                  styles.navItem,
                  isSelected && styles.navItemSelected,
                )}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>

        {/* User section */}
        <div className={styles.userSection}>
          <Menu>
            <MenuTrigger>
              <button className={styles.userButton}>
                <Avatar
                  name={user?.username}
                  image={
                    user?.avatar_url ? { src: user.avatar_url } : undefined
                  }
                  size={32}
                />
                <div className={styles.userInfo}>
                  <Text
                    size={300}
                    weight="semibold"
                    truncate
                    block
                    style={{ color: "var(--colorNeutralForeground1)" }}
                  >
                    {user?.username}
                  </Text>
                  <Badge
                    size="small"
                    appearance={user?.role === "guest" ? "outline" : "tint"}
                    color={
                      user?.role === "admin"
                        ? "danger"
                        : user?.role === "guest"
                          ? "informative"
                          : "brand"
                    }
                  >
                    {user?.role}
                  </Badge>
                </div>
              </button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {user?.role !== "guest" && (
                  <MenuItem
                    icon={<PersonRegular />}
                    onClick={() => navigate("/settings")}
                  >
                    Account Settings
                  </MenuItem>
                )}
                {user?.role === "admin" && (
                  <MenuItem
                    icon={<ShieldPersonRegular />}
                    onClick={() => navigate("/admin")}
                  >
                    Admin Panel
                  </MenuItem>
                )}
                <MenuDivider />
                <MenuItem icon={<SignOutRegular />} onClick={handleLogout}>
                  Sign out
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      </nav>

      {/* Main content */}
      <div className={styles.mainContent}>
        {/* Mobile Header */}
        <div className={styles.mobileHeader}>
          <Button
            appearance="transparent"
            icon={<NavigationRegular fontSize={24} />}
            onClick={() => setSidebarOpen(true)}
          />
          <Text weight="semibold" size={400} truncate>
            {config.siteName}
          </Text>
        </div>

        {/* Page content */}
        <main className={styles.pageContent}>{children}</main>
        <Toaster position="top-end" />
      </div>
    </div>
  );
}
