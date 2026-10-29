import type {
  Appointment,
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Order,
  Package,
  Sale,
  ShopifyCheckout,
  Tag,
  Task,
  Vehicle,
} from "../../../types";
import type { StageChange } from "../../../numbers/funnelModel";
import type {
  SearchDayRow,
  SearchPageRow,
  SearchQueryRow,
} from "../../../numbers/searchModel";
import type { TrafficRow } from "../../../numbers/trafficModel";
import type { ConfigurationContextValue } from "../../../root/ConfigurationContext";

export interface Db {
  companies: Company[];
  contacts: Contact[];
  contact_notes: ContactNote[];
  deals: Deal[];
  deal_notes: DealNote[];
  deal_stage_history: Array<StageChange & { id: number }>;
  sales: Sale[];
  tags: Tag[];
  tasks: Task[];
  orders: Order[];
  shopify_checkouts: ShopifyCheckout[];
  shop_traffic_daily: TrafficRow[];
  search_console_daily: SearchDayRow[];
  search_console_queries: SearchQueryRow[];
  search_console_pages: SearchPageRow[];
  appointments: Appointment[];
  vehicles: Vehicle[];
  packages: Package[];
  configuration: Array<{ id: number; config: ConfigurationContextValue }>;
}
