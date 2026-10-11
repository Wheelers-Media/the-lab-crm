import { cn } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Home,
  KanbanSquare,
  ListTodo,
  Menu,
  Package,
  Plus,
  Receipt,
  Settings,
  ShoppingCart,
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

export const MobileNavigation = () => {
  const location = useLocation();
  const translate = useTranslate();

  let currentPath: string | boolean = "/";
  if (matchPath("/", location.pathname)) {
    currentPath = "/";
  } else if (matchPath("/contacts/*", location.pathname)) {
    currentPath = "/contacts";
  } else if (matchPath("/companies/*", location.pathname)) {
    currentPath = "/companies";
  } else if (matchPath("/tasks/*", location.pathname)) {
    currentPath = "/tasks";
  } else if (matchPath("/deals/*", location.pathname)) {
    currentPath = "/deals";
  } else {
    currentPath = false;
  }

  // Check if the app is running as a PWA (standalone mode)
  const isPwa = window.matchMedia("(display-mode: standalone)").matches;
  // Check if it's iOS on the web
  const isWebiOS = /iPad|iPod|iPhone/.test(window.navigator.userAgent);

  return (
    <nav
      aria-label={translate("crm.navigation.label")}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-secondary/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]"
      style={{
        // iOS bug: even though viewport is set correctly, the bottom safe area inset is not accounted for
        // So we manually add some padding to avoid the navigation being too close to the home bar
        paddingBottom: isPwa && isWebiOS ? 15 : undefined,
      }}
    >
      {/* Tabs navigate; creating lives in the top bar's + button */}
      <div className="mx-auto flex max-w-lg">
        <NavigationButton
          href="/"
          Icon={Home}
          label="Home"
          isActive={currentPath === "/"}
        />
        <NavigationButton
          href="/deals"
          Icon={KanbanSquare}
          label={translate("resources.deals.name", { smart_count: 2 })}
          isActive={currentPath === "/deals"}
        />
        <NavigationButton
          href="/contacts"
          Icon={Users}
          label={translate("resources.contacts.name", {
            smart_count: 2,
          })}
          isActive={currentPath === "/contacts"}
        />
        <NavigationButton
          href="/tasks"
          Icon={ListTodo}
          label="Tasks"
          isActive={currentPath === "/tasks"}
        />
        <MoreButton
          isActive={currentPath === false || currentPath === "/companies"}
        />
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
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  isActive: boolean;
}) => (
  <Link
    to={href}
    aria-current={isActive ? "page" : undefined}
    className={cn(
      "flex min-h-[49px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5",
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

const MORE_LINKS = [
  {
    href: "/calendar",
    label: "Calendar",
    hint: "Drop-offs and Eric's bookings",
    Icon: CalendarDays,
  },
  {
    href: "/packages",
    label: "Packages and products",
    hint: "The Shopify catalog, prices and stock",
    Icon: Package,
  },
  {
    href: "/orders",
    label: "Orders",
    hint: "Shopify orders and deposits",
    Icon: Receipt,
  },
  {
    href: "/shopify_checkouts",
    label: "Abandoned carts",
    hint: "Call or text to recover",
    Icon: ShoppingCart,
  },
  {
    href: "/companies",
    label: "Businesses",
    hint: "Fleets and commercial accounts",
    Icon: Building2,
  },
  {
    href: "/settings",
    label: "Settings",
    hint: "Profile, team and app",
    Icon: Settings,
  },
];

const MoreButton = ({ isActive }: { isActive: boolean }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-h-[49px] flex-1 flex-col items-center justify-center gap-0.5 pt-1.5",
          isActive ? "text-[var(--lab-blue-text)]" : "text-muted-foreground",
        )}
      >
        <Menu className="size-6" strokeWidth={isActive ? 2.25 : 1.75} />
        <span className="text-[11px] font-medium leading-tight">More</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="pb-8 rounded-t-lg">
          <SheetHeader>
            <SheetTitle className="font-display uppercase tracking-wide">
              All pages
            </SheetTitle>
            <SheetDescription className="sr-only">
              Every part of the CRM
            </SheetDescription>
          </SheetHeader>
          <nav className="flex flex-col px-2">
            {MORE_LINKS.map(({ href, label, hint, Icon }) => (
              <button
                key={href}
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(href);
                }}
                className="flex items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-accent min-h-14"
              >
                <Icon className="size-5 text-muted-foreground" />
                <span className="flex-1">
                  <span className="block font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {hint}
                  </span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
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
