import type {
  Appointment,
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Order,
  Sale,
  ShopifyCheckout,
  Tag,
  Task,
} from "../../../types";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Company[];
  contacts: Contact[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_notes: DealNote[];
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  orders: Order[];
  appointments: Appointment[];
  shopify_checkouts: ShopifyCheckout[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
