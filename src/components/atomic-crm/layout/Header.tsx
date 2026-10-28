import { FileText, Import, Settings, User, Users } from "lucide-react";
import { CanAccess, useTranslate, useUserMenu } from "ra-core";
import { Link } from "react-router";
import { RefreshButton } from "@/components/admin/refresh-button";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { ImportPage } from "../misc/ImportPage";
import { ChangelogPage } from "../misc/ChangelogPage";
import { DesktopNavigation } from "./DesktopNavigation";

const Header = () => {
  const { darkModeLogo, lightModeLogo, title } = useConfigurationContext();

  return (
    <>
      {/* Sticky like the website's header: the page scrolls under it */}
      <nav className="sticky top-0 z-40 grow">
        <header className="border-b border-border bg-background/95 backdrop-blur-xl">
          <div className="px-4">
            <div className="flex justify-between items-center flex-1">
              <Link
                to="/"
                className="flex items-center gap-2 shrink-0 text-secondary-foreground no-underline"
              >
                <img
                  className="[.light_&]:hidden h-9"
                  src={darkModeLogo}
                  alt={title}
                />
                <img
                  className="[.dark_&]:hidden h-9"
                  src={lightModeLogo}
                  alt={title}
                />
                <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  CRM
                </span>
              </Link>
              <div className="min-w-0 flex-1 flex justify-center">
                <DesktopNavigation />
              </div>
              <div className="flex items-center">
                <ThemeModeToggle />
                <RefreshButton />
                <UserMenu>
                  <ProfileMenu />
                  <CanAccess resource="sales" action="list">
                    <UsersMenu />
                  </CanAccess>
                  <CanAccess resource="configuration" action="edit">
                    <SettingsMenu />
                  </CanAccess>
                  <ImportFromJsonMenuItem />
                  <ChangelogMenuItem />
                </UserMenu>
              </div>
            </div>
          </div>
        </header>
      </nav>
    </>
  );
};

const UsersMenu = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<UsersMenu> must be used inside <UserMenu?");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/sales" className="flex items-center gap-2">
        <Users />
        {translate("resources.sales.name", { smart_count: 2 })}
      </Link>
    </DropdownMenuItem>
  );
};

const ProfileMenu = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ProfileMenu> must be used inside <UserMenu?");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/profile" className="flex items-center gap-2">
        <User />
        {translate("crm.profile.title")}
      </Link>
    </DropdownMenuItem>
  );
};

const SettingsMenu = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<SettingsMenu> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to="/settings" className="flex items-center gap-2">
        <Settings />
        {translate("crm.settings.title")}
      </Link>
    </DropdownMenuItem>
  );
};

const ImportFromJsonMenuItem = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ImportFromJsonMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={ImportPage.path} className="flex items-center gap-2">
        <Import />
        {translate("crm.header.import_data")}
      </Link>
    </DropdownMenuItem>
  );
};

const ChangelogMenuItem = () => {
  const translate = useTranslate();
  const userMenuContext = useUserMenu();
  if (!userMenuContext) {
    throw new Error("<ChangelogMenuItem> must be used inside <UserMenu>");
  }
  return (
    <DropdownMenuItem asChild onClick={userMenuContext.onClose}>
      <Link to={ChangelogPage.path} className="flex items-center gap-2">
        <FileText />
        {translate("crm.changelog.title")}
      </Link>
    </DropdownMenuItem>
  );
};
export default Header;
