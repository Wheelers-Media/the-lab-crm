import type { Identifier, RaRecord } from "ra-core";
import type { ComponentType } from "react";

import type {
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
} from "./consts";

export type SignUpData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type SalesFormData = {
  avatar?: string;
  email: string;
  secondary_emails?: string[];
  password?: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  disabled: boolean;
};

export type Sale = {
  first_name: string;
  last_name: string;
  administrator: boolean;
  avatar?: RAFile;
  disabled?: boolean;
  user_id: string;

  /**
   * This is a copy of the user's email, to make it easier to handle by react admin
   * DO NOT UPDATE this field directly, it should be updated by the backend
   */
  email: string;

  secondary_emails?: string[];

  /**
   * This is used by the fake rest provider to store the password
   * DO NOT USE this field in your code besides the fake rest provider
   * @deprecated
   */
  password?: string;
} & Pick<RaRecord, "id">;

export type Company = {
  name: string;
  logo: RAFile;
  sector: string;
  size: 1 | 10 | 50 | 250 | 500;
  linkedin_url: string;
  website: string;
  phone_number: string;
  address: string;
  zipcode: string;
  city: string;
  state_abbr: string;
  sales_id?: Identifier;
  created_at: string;
  description: string;
  revenue: string;
  tax_identifier: string;
  country: string;
  context_links?: string[];
  nb_contacts?: number;
  nb_deals?: number;
} & Pick<RaRecord, "id">;

export type EmailAndType = {
  email: string;
  type: "Work" | "Home" | "Other";
};

export type PhoneNumberAndType = {
  number: string;
  type: "Work" | "Home" | "Other";
};

export type Contact = {
  first_name: string;
  last_name: string;
  title: string;
  company_id?: Identifier | null;
  email_jsonb: EmailAndType[];
  avatar?: Partial<RAFile>;
  linkedin_url?: string | null;
  first_seen: string;
  last_seen: string;
  has_newsletter: boolean;
  tags: number[];
  gender: string;
  sales_id?: Identifier;
  status: string;
  background: string;
  phone_jsonb: PhoneNumberAndType[];
  nb_tasks?: number;
  company_name?: string;
  preferred_contact?: PreferredContact | null;
  sms_consent?: boolean;
  sms_consent_at?: string | null;
  lead_source?: string | null;
  membership?: Membership | null;
  membership_since?: string | null;
  city?: string | null;
  province?: string | null;
  vehicles_fts?: string | null;
  /** Main vehicle, "2021 Ram 3500", from contacts_summary. */
  vehicle_label?: string | null;
} & Pick<RaRecord, "id">;

export type PreferredContact = "text" | "call" | "email";
export type Membership = "monthly-signature" | "lab-syndicate";

export type VehiclePlatform =
  | "cummins"
  | "duramax"
  | "powerstroke"
  | "half-ton"
  | "kenworth"
  | "gas"
  | "sxs"
  | "other";

export type VehicleSizeClass =
  | "car"
  | "suv-5-6"
  | "suv-7-8"
  | "truck"
  | "sxs"
  | "commercial";

export type Vehicle = {
  contact_id?: Identifier | null;
  company_id?: Identifier | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  trim?: string | null;
  platform?: VehiclePlatform | null;
  engine?: string | null;
  transmission?: string | null;
  size_class?: VehicleSizeClass | null;
  vin?: string | null;
  plate?: string | null;
  colour?: string | null;
  mods?: string | null;
  notes?: string | null;
  is_primary: boolean;
  created_at?: string;
  updated_at?: string;
  sales_id?: Identifier | null;
} & Pick<RaRecord, "id">;

export type ContactNote = {
  contact_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  status: string;
  attachments?: AttachmentNote[];
} & Pick<RaRecord, "id">;

export type Deal = {
  name: string;
  company_id: Identifier;
  contact_ids: Identifier[];
  category: string;
  stage: string;
  description: string;
  amount: number;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  expected_closing_date: string;
  sales_id: Identifier;
  index: number;
  lead_source?: string | null;
  stage_changed_at?: string;
  vehicle_id?: Identifier | null;
  packages?: DealPackageLine[];
  quote?: WebsiteQuote | null;
  checkout?: DealCheckout | null;
} & Pick<RaRecord, "id">;

/** The latest Shopify checkout link made for the job's quote. */
export type DealCheckout = {
  url: string;
  draft_order_name: string;
  mode: "parts" | "all";
  due_now: number;
  due_at_pickup: number;
  emailed: boolean;
  created_at: string;
};

/** A package on a job; price is what this customer was quoted. */
export type DealPackageLine = {
  package_id: Identifier | null;
  title: string;
  price: number;
  quantity: number;
  /** The Shopify variant a checkout link sells; none for labour and custom lines. */
  variant_id?: string | null;
  /** Parts are paid up front; labour can wait until pickup. */
  kind?: "part" | "labour";
};

/** What the customer saw and chose on thelabfsj.ca (lead_intake). */
export type WebsiteQuote = {
  total: string;
  lines: Array<{ label: string; price: number; priceText: string }>;
  choices: Array<{ label: string; value: string }>;
  summary: string;
  source: "quote" | "walkthrough" | "form";
  page: string;
};

/** The Shopify catalog in the CRM (shopify_webhook keeps it in sync). */
export type Package = {
  shopify_product_id: string;
  title: string;
  shopify_title: string;
  vendor: string | null;
  category: string | null;
  bay: "boutique" | "parts" | null;
  price: number | null;
  price_max: number | null;
  variants: Array<{
    id: string;
    title: string;
    price: number;
    sku?: string;
    inventory?: number | null;
  }>;
  status: "active" | "unlisted" | "draft" | "archived" | "deleted";
  shopify_updated_at: string | null;
  synced_at: string;
  /** "package": a shop service (goes on jobs); "product": parts and the rest */
  kind: "package" | "product";
  product_type: string | null;
  handle: string | null;
  image_url: string | null;
  /** Units in stock; null when Shopify does not track stock */
  inventory: number | null;
} & Pick<RaRecord, "id">;

export type DealNote = {
  deal_id: Identifier;
  text: string;
  date: string;
  sales_id: Identifier;
  attachments?: AttachmentNote[];

  // This is defined for compatibility with `ContactNote`
  status?: undefined;
} & Pick<RaRecord, "id">;

export type Tag = {
  id: number;
  name: string;
  color: string;
};

export type Task = {
  contact_id: Identifier;
  type: string;
  text: string;
  due_date: string;
  done_date?: string | null;
  sales_id?: Identifier;
} & Pick<RaRecord, "id">;

export type ActivityCompanyCreated = {
  type: typeof COMPANY_CREATED;
  company_id: Identifier;
  company: Company;
  sales_id: Identifier;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactCreated = {
  type: typeof CONTACT_CREATED;
  company_id: Identifier;
  sales_id?: Identifier;
  contact: Contact;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactNoteCreated = {
  type: typeof CONTACT_NOTE_CREATED;
  sales_id?: Identifier;
  contactNote: ContactNote;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityDealCreated = {
  type: typeof DEAL_CREATED;
  company_id: Identifier;
  sales_id?: Identifier;
  deal: Deal;
  date: string;
};

export type ActivityDealNoteCreated = {
  type: typeof DEAL_NOTE_CREATED;
  sales_id?: Identifier;
  dealNote: DealNote;
  date: string;
};

export type Activity = RaRecord &
  (
    | ActivityCompanyCreated
    | ActivityContactCreated
    | ActivityContactNoteCreated
    | ActivityDealCreated
    | ActivityDealNoteCreated
  );

export interface RAFile {
  src: string;
  title: string;
  path?: string;
  rawFile: File;
  type?: string;
}

export type AttachmentNote = RAFile;

export interface LabeledValue {
  value: string;
  label: string;
}

export type DealStage = LabeledValue;

export interface NoteStatus extends LabeledValue {
  color: string;
}

export interface ContactGender {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

// THE LAB operations (Shopify orders and checkouts, appointments).
// Rows are written by the shopify_webhook / calcom_webhook edge functions.

export type OrderLineItem = {
  name: string;
  quantity: number;
  price: number;
  sku?: string;
};

export type Order = {
  shopify_order_id: string | null;
  order_number: string;
  contact_id: Identifier | null;
  deal_id: Identifier | null;
  source: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  currency: string;
  subtotal: number | null;
  total: number;
  refunded_amount: number;
  line_items: OrderLineItem[];
  categories: string[];
  is_deposit: boolean;
  ordered_at: string;
  cancelled_at: string | null;
  created_at: string;
  sales_id?: Identifier;
} & Pick<RaRecord, "id">;

export type ShopifyCheckout = {
  checkout_token: string;
  contact_id: Identifier | null;
  email: string | null;
  phone: string | null;
  customer_name: string | null;
  total: number;
  line_items: OrderLineItem[];
  recovery_url: string | null;
  completed_at: string | null;
  task_id: Identifier | null;
  checkout_updated_at: string;
  created_at: string;
} & Pick<RaRecord, "id">;

export type AppointmentStatus =
  | "booked"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "no_show";

export type AppointmentResource = "detailing-bay" | "eric";

export type Appointment = {
  external_id: string | null;
  source: string;
  contact_id: Identifier | null;
  deal_id: Identifier | null;
  task_id: Identifier | null;
  title: string;
  resource: AppointmentResource;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  deposit_paid: boolean;
  vehicle: string | null;
  vehicle_id?: Identifier | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sales_id?: Identifier;
} & Pick<RaRecord, "id">;
