import { cn } from "@/lib/utils";
import {
  ChevronRight,
  KanbanSquare,
  ListTodo,
  Menu,
  Plus,
  Settings,
  StickyNote,
  Users,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTranslate } from "ra-core";
import {
  Link,
  matchPath,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router";
import { ContactCreateSheet } from "../contacts/ContactCreateSheet";
import { useState } from "react";
import { NoteCreateSheet } from "../notes/NoteCreateSheet";
import { TaskCreateSheet } from "../tasks/TaskCreateSheet";
import { ActionSheet } from "../misc/ActionSheet";
import {
  isInGroup,
  isOnPage,
  type NavIcon,
  PHONE_MORE,
  PHONE_TABS,
} from "./navigation";

export const MobileNavigation = () => {
  const { pathname } = useLocation();
  const translate = useTranslate();
  const onMorePage = PHONE_MORE.some((group) => isInGroup(group, pathname));

  // Check if the app is running as a PWA (standalone mode)
  const isPwa = window.matchMedia("(display-mode: standalone)").matches;
  // Check if it's iOS on the web
  const isWebiOS = /iPad|iPod|iPhone/.test(window.navigator.userAgent);

  return (
    <nav
      aria-label={translate("crm.navigation.label")}
      className="lab-glass fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 pb-[env(safe-area-inset-bottom,0px)]"
      style={{
        // iOS bug: even though viewport is set correctly, the bottom safe area inset is not accounted for
        // So we manually add some padding to avoid the navigation being too close to the home bar
        paddingBottom: isPwa && isWebiOS ? 15 : undefined,
      }}
    >
      {/* Tabs navigate; creating lives in the top bar's + button */}
      <div className="mx-auto flex max-w-lg">
        {PHONE_TABS.map((page) => (
          <NavigationButton
            key={page.to}
            href={page.to}
            Icon={page.Icon}
            label={page.label}
            isActive={isOnPage(page, pathname)}
          />
        ))}
        <MoreButton isActive={onMorePage} />
      </div>
    </nav>
  );
};

/** One tab: icon over an 11pt label, brand blue when selected. */
const NavigationButton = ({
  href,
  Icon,
  label,
  isActive,
}: {
  href: string;
  Icon: NavIcon;
  label: string;
  isActive: boolean;
}) => (
  <Link
    to={href}
    aria-current={isActive ? "page" : undefined}
    className={cn(
      "lab-tab flex min-h-[49px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5",
      isActive ? "text-[var(--lab-blue-text)]" : "text-muted-foreground",
    )}
  >
    <Icon className="size-6" strokeWidth={isActive ? 2.25 : 1.75} />
    <span className="text-[11px] font-medium leading-tight">{label}</span>
  </Link>
);

/**
 * The top bar's + button: new customer, job, note or task. An action lives
 * in the toolbar, not in the tab bar.
 */
export const CreateMenu = () => {
  const translate = useTranslate();
  const contact_id = useMatch("/contacts/:id/*")?.params.id;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [contactCreateOpen, setContactCreateOpen] = useState(false);
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <ContactCreateSheet
        open={contactCreateOpen}
        onOpenChange={setContactCreateOpen}
      />
      <NoteCreateSheet
        open={noteCreateOpen}
        onOpenChange={setNoteCreateOpen}
        contact_id={contact_id}
      />
      <TaskCreateSheet
        open={taskCreateOpen}
        onOpenChange={setTaskCreateOpen}
        contact_id={contact_id}
      />
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label={translate("ra.action.create")}
        className="grid size-11 place-items-center rounded-full text-[var(--lab-blue-text)]"
      >
        <Plus className="size-7" strokeWidth={2.25} />
      </button>
      <ActionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="New"
        actions={[
          {
            label: translate("resources.contacts.forcedCaseName"),
            icon: Users,
            onSelect: () => setContactCreateOpen(true),
          },
          {
            label: translate("resources.deals.forcedCaseName", { _: "Job" }),
            icon: KanbanSquare,
            onSelect: () => navigate("/deals/create"),
          },
          {
            label: translate("resources.tasks.forcedCaseName"),
            icon: ListTodo,
            onSelect: () => setTaskCreateOpen(true),
          },
          {
            label: translate("resources.notes.forcedCaseName"),
            icon: StickyNote,
            onSelect: () => setNoteCreateOpen(true),
          },
        ]}
      />
    </>
  );
};

/**
 * Every other page, grouped the way the work is: the shop, the numbers, the
 * store, then accounts. Shown as a sheet so a page is two taps from anywhere.
 */
const MoreButton = ({ isActive }: { isActive: boolean }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "lab-tab flex min-h-[49px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5",
          isActive ? "text-[var(--lab-blue-text)]" : "text-muted-foreground",
        )}
      >
        <Menu className="size-6" strokeWidth={isActive ? 2.25 : 1.75} />
        <span className="text-[11px] font-medium leading-tight">More</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
        >
          <SheetHeader className="pb-1">
            <SheetTitle className="font-display uppercase tracking-wide">
              More
            </SheetTitle>
            <SheetDescription className="sr-only">
              Every other part of the CRM
            </SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col gap-5 px-4">
            {PHONE_MORE.map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h3 className="lab-eyebrow mb-1.5">{group.label}</h3>
                <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card">
                  {group.pages.map((page) => {
                    const { to, label, hint, Icon } = page;
                    const current = isOnPage(page, pathname);
                    return (
                      <li key={to}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            navigate(to);
                          }}
                          aria-current={current ? "page" : undefined}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left min-h-14 active:bg-accent"
                        >
                          <span
                            className={cn(
                              "grid size-9 shrink-0 place-items-center rounded-lg",
                              current
                                ? "bg-[var(--lab-blue)] text-white"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icon className="size-5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{label}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {hint}
                            </span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
};

export const SettingsButton = () => {
  const translate = useTranslate();
  const location = useLocation();
  const isActive = !!matchPath("/settings", location.pathname);

  return (
    <NavigationButton
      href="/settings"
      Icon={Settings}
      label={translate("crm.settings.title")}
      isActive={isActive}
    />
  );
};
