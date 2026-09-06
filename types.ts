import type { Generated, Insertable, Selectable, Updateable } from "kysely";

export type Unit = "KG" | "PIECE" | "BOX" | "BOUQUET";
export type PriceType = "FIXED" | "RANGE" | "FROM" | "ASK";
export type OrderStatus =
  | "NEW" | "CLARIFYING" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "REJECTED" | "CANCELLED";

export interface AdminUserTable {
  id: string;
  email: string;
  password_hash: string;
  reset_token_hash: string | null;
  reset_token_expiry: string | null;
  created_at: Generated<string>;
}
export interface CategoryTable {
  id: string;
  slug: string;
  name: string;
  description: Generated<string>;
  unit: Unit;
  image_path: string | null;
  sort_order: Generated<number>;
  is_visible: Generated<number>;
  is_archived: Generated<number>;
}
export interface ProductTable {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  description: Generated<string>;
  image_path: string | null;
  unit: Unit;
  price_type: PriceType;
  price_min: number | null; // копійки за одиницю
  price_max: number | null;
  min_qty: number | null; // грами для KG, інакше штуки
  fillings: Generated<string>; // JSON string[]
  options: Generated<string>; // JSON OptionGroup[] — групи варіантів складу
  size_label: string | null;
  sort_order: Generated<number>;
  is_visible: Generated<number>;
  is_archived: Generated<number>;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}
export interface SettingTable { key: string; value: string; }
export interface CalendarDayTable {
  date: string;
  is_closed: Generated<number>;
  note: Generated<string>;
  day_limit: number | null;
}
export interface OrderTable {
  id: string;
  created_at: Generated<string>;
  updated_at: Generated<string>;
  status: Generated<OrderStatus>;
  customer_name: string;
  phone: string;
  desired_date: string;
  delivery_type: "TAXI" | "AGREE";
  wishes: Generated<string>;
  reference_path: string | null;
  snapshot: string; // JSON
  price_type: PriceType;
  estimated_min: number | null;
  estimated_max: number | null;
  final_price: number | null;
  admin_notes: Generated<string>;
  idempotency_key: string;
}
export interface OrderEventTable {
  id: string;
  order_id: string;
  created_at: Generated<string>;
  type: string;
  payload: Generated<string>;
}
export interface PhotoTable {
  id: string;
  path: string;
  alt: Generated<string>;
  in_gallery: Generated<number>; // показувати в блоці «Мої роботи»
  sort_order: Generated<number>;
  width: number | null;
  height: number | null;
  created_at: Generated<string>;
}
export interface ReviewTable {
  id: string;
  private_path: string;      // файл у storage/private/reviews (оригінал)
  public_path: string | null; // /uploads/reviews/… — лише анонімізована копія
  alt: Generated<string>;
  sort_order: Generated<number>;
  is_published: Generated<number>;
  consent_checked: Generated<number>; // дозвіл/анонімізацію перевірено
  width: number;
  height: number;
  created_at: Generated<string>;
}
export interface RateLimitTable { key: string; count: number; window_end: string; }

export interface Database {
  admin_users: AdminUserTable;
  categories: CategoryTable;
  products: ProductTable;
  settings: SettingTable;
  calendar_days: CalendarDayTable;
  orders: OrderTable;
  order_events: OrderEventTable;
  photos: PhotoTable;
  reviews: ReviewTable;
  rate_limits: RateLimitTable;
}
export type Product = Selectable<ProductTable>;
export type Category = Selectable<CategoryTable>;
export type Order = Selectable<OrderTable>;
export type OrderEvent = Selectable<OrderEventTable>;
export type CalendarDay = Selectable<CalendarDayTable>;
export type Review = Selectable<ReviewTable>;
export type NewOrder = Insertable<OrderTable>;
export type ProductUpdate = Updateable<ProductTable>;
