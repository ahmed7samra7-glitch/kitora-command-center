CREATE TABLE IF NOT EXISTS kcc_commerce_products (
  product_id TEXT PRIMARY KEY,
  cj_product_id TEXT NOT NULL,
  cj_variant_id TEXT NOT NULL,
  price_usd REAL NOT NULL CHECK (price_usd > 0),
  cost_usd REAL NOT NULL CHECK (cost_usd >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kcc_commerce_orders (
  id TEXT PRIMARY KEY,
  paypal_order_id TEXT NOT NULL UNIQUE,
  paypal_capture_id TEXT UNIQUE,
  product_id TEXT NOT NULL,
  cj_product_id TEXT NOT NULL,
  cj_variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount_usd REAL NOT NULL CHECK (amount_usd > 0),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_country TEXT NOT NULL,
  shipping_zip TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  fulfillment_status TEXT NOT NULL,
  notification_status TEXT NOT NULL,
  cj_order_id TEXT,
  cj_provider_request_id TEXT,
  whatsapp_message_id TEXT,
  whatsapp_provider_request_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_kcc_commerce_orders_payment ON kcc_commerce_orders(payment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_kcc_commerce_orders_fulfillment ON kcc_commerce_orders(fulfillment_status, created_at);
