import type { ConfigurationContextValue } from "./ConfigurationContext";
// Import the logos as module assets so Vite resolves their URL relative to the
// JS chunk (import.meta.url), not the current route. A plain "./logos/..." path
// breaks on nested routes like /oauth/consent and under a deployment sub-path.
import darkModeLogo from "./logos/the_lab_logo_white.png";
import lightModeLogo from "./logos/the_lab_logo_black.png";

export const defaultDarkModeLogo = darkModeLogo;
export const defaultLightModeLogo = lightModeLogo;

export const defaultCurrency = "CAD";

export const defaultTitle = "THE LAB CRM";

// Customer types. Most customers are individuals; use a company record for
// fleets, contractors and partners.
export const defaultCompanySectors = [
  { value: "individual", label: "Individual / household" },
  { value: "fleet", label: "Fleet / commercial" },
  { value: "oilfield", label: "Oilfield / energy" },
  { value: "farm-ranch", label: "Farm / ranch" },
  { value: "dealership", label: "Dealership" },
  { value: "partner", label: "Partner / supplier" },
  { value: "other", label: "Other" },
];

// Mirrors the Facebook Leads board stages. The "won" and "lost" values are
// kept because the dashboard charts key on them; only the labels change.
export const defaultDealStages = [
  { value: "intake", label: "Intake" },
  { value: "qualified", label: "Qualified" },
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
  { value: "won", label: "Converted" },
  { value: "lost", label: "Not now" },
];

export const defaultDealPipelineStatuses = ["won"];

// Services from THE LAB fact sheet. Coatings and PPF are "coming soon" and
// deliberately not listed until they can be booked.
export const defaultDealCategories = [
  { value: "window-tint", label: "Window tint" },
  { value: "sxs-tint", label: "SxS tint" },
  { value: "detailing", label: "Detailing" },
  { value: "membership", label: "Detailing membership" },
  { value: "lighting", label: "Custom lighting" },
  { value: "install", label: "Custom install" },
  { value: "gridiron", label: "Gridiron bumper" },
  { value: "tuning", label: "Tuning" },
  { value: "diesel-parts", label: "Diesel parts order" },
  { value: "gift-certificate", label: "Gift certificate" },
  { value: "other", label: "Other" },
];

export const defaultNoteStatuses = [
  { value: "cold", label: "Cold", color: "#7d8a99" },
  { value: "warm", label: "Warm", color: "#FF8A1F" },
  { value: "hot", label: "Hot", color: "#e5484d" },
  { value: "waiting", label: "Waiting on customer", color: "#CFE3FF" },
  { value: "done", label: "Done", color: "#3fb27f" },
];

export const defaultTaskTypes = [
  { value: "none", label: "None" },
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "follow-up", label: "Follow-up" },
  { value: "send-quote", label: "Send quote" },
  { value: "deposit", label: "Deposit reminder" },
  { value: "order-parts", label: "Order parts" },
  { value: "drop-off", label: "Vehicle drop-off" },
  { value: "pickup", label: "Vehicle pickup" },
];

export const defaultConfiguration: ConfigurationContextValue = {
  companySectors: defaultCompanySectors,
  currency: defaultCurrency,
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
};
