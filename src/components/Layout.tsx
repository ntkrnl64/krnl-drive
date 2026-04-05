import { useState, useEffect } from "react";
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
    width: "250px",
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
      boxShadow: "0 0 10px rgba(0,0,0,0.2)",
    },
  },
  logoContainer: {
    padding: "16px 20px",
    ...shorthands.borderBottom("1px", "solid", "var(--colorNeutralStroke2)"),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  logoText: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  closeSidebarBtn: {
    display: "none",
    "@media (max-width: 768px)": {
      display: "block",
    },
  },
  navContainer: {
    flexGrow: 1,
    padding: "16px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    overflowY: "auto",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    border: "none",
    backgroundColor: "transparent",
    color: "var(--colorNeutralForeground1)",
    cursor: "pointer",
    fontSize: "14px",
    ...shorthands.borderRadius("6px"),
    width: "100%",
    textAlign: "left",
    transitionProperty: "background-color, color",
    transitionDuration: "0.2s",
    "&:hover": {
      backgroundColor: "var(--colorNeutralBackground1Hover)",
    },
  },
  navItemSelected: {
    backgroundColor: "var(--colorBrandBackground2)",
    color: "var(--colorBrandForeground2)",
    fontWeight: 600,
    "&:hover": {
      backgroundColor: "var(--colorBrandBackground2Hover)",
    },
  },
  userSection: {
    ...shorthands.borderTop("1px", "solid", "var(--colorNeutralStroke2)"),
    padding: "12px 16px",
  },
  userButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    ...shorthands.borderRadius("6px"),
    "&:hover": {
      backgroundColor: "var(--colorNeutralBackground1Hover)",
    },
  },
  userInfo: {
    flexGrow: 1,
    textAlign: "left",
    overflow: "hidden",
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

  // Close sidebar on route change for mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

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
                style={{ width: 24, height: 24, objectFit: "contain" }}
              />
            ) : (
              <FolderRegular
                style={{ fontSize: 24, color: "var(--colorBrandForeground1)" }}
              />
            )}
            <Text weight="semibold" size={400}>
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
                    color={
                      user?.role === "admin"
                        ? "danger"
                        : user?.role === "guest"
                          ? "subtle"
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
