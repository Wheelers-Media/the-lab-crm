import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  Home,
  KanbanSquare,
  ListTodo,
  Menu,
  Plus,
  Receipt,
  Settings,
  ShoppingCart,
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
      className="fixed bottom-0 left-0 right-0 z-50 bg-secondary h-14"
      style={{
        // iOS bug: even though viewport is set correctly, the bottom safe area inset is not accounted for
        // So we manually add some padding to avoid the navigation being too close to the home bar
        paddingBottom: isPwa && isWebiOS ? 15 : undefined,
        // We use box-sizing: border-box, so the height contains the padding.
        // To actually increase the padding, we need to increase the height as well
        height:
          "calc(var(--spacing)) * 6" + (isPwa && isWebiOS ? " + 15px" : ""),
      }}
    >
      <div className="flex justify-center">
        <>
          <NavigationButton
            href="/"
            Icon={Home}
            label={translate("ra.page.dashboard")}
            isActive={currentPath === "/"}
          />
          <NavigationButton
            href="/deals"
            Icon={KanbanSquare}
            label={translate("resources.deals.name", { smart_count: 2 })}
            isActive={currentPath === "/deals"}
          />
          <CreateButton />
          <NavigationButton
            href="/contacts"
            Icon={Users}
            label={translate("resources.contacts.name", {
              smart_count: 2,
            })}
            isActive={currentPath === "/contacts"}
          />
          <MoreButton
            isActive={
              currentPath === false ||
              currentPath === "/companies" ||
              currentPath === "/tasks"
            }
          />
        </>
      </div>
    </nav>
  );
};

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
  <Button
    asChild
    variant="ghost"
    className={cn(
      "flex-col gap-1 h-auto py-2 px-1 rounded-md w-16",
      isActive ? null : "text-muted-foreground",
    )}
  >
    <Link to={href}>
      <Icon className="size-6" />
      <span className="text-[0.6rem] font-medium">{label}</span>
    </Link>
  </Button>
);

const CreateButton = () => {
  const translate = useTranslate();
  const contact_id = useMatch("/contacts/:id/*")?.params.id;
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="default"
            size="icon"
            className="h-16 w-16 rounded-full -mt-3"
            aria-label={translate("ra.action.create")}
          >
            <Plus className="size-10" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setContactCreateOpen(true);
            }}
          >
            {translate("resources.contacts.forcedCaseName")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => navigate("/deals/create")}
          >
            {translate("resources.deals.forcedCaseName", { _: "Job" })}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setNoteCreateOpen(true);
            }}
          >
            {translate("resources.notes.forcedCaseName")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="h-12 px-4 text-base"
            onSelect={() => {
              setTaskCreateOpen(true);
            }}
          >
            {translate("resources.tasks.forcedCaseName")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
    href: "/tasks",
    label: "Tasks",
    hint: "Calls and follow-ups",
    Icon: ListTodo,
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
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className={cn(
          "flex-col gap-1 h-auto py-2 px-1 rounded-md w-16",
          isActive ? null : "text-muted-foreground",
        )}
      >
        <Menu className="size-6" />
        <span className="text-[0.6rem] font-medium">More</span>
      </Button>
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
