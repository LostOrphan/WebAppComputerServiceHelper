export interface PartCategory {
  id: number;
  name: string;
}

export interface Part {
  id: number;
  name: string;
  brand?: string;
  sku: string;
  ean?: string;
  category: number;
  category_name?: string;
  default_buy_price_net: string;
  sell_price_gross: string;
  unit: 'PCS' | 'G' | 'ML';
  specifications?: Record<string, any>;
}

export interface Stock {
  id: number;
  part: Part;
  location: any;
  quantity: number;
  min_quantity: number;
  is_low_stock: boolean;
}
export interface CreatePartPayload {
  name: string;
  brand?: string;
  sku?: string;
  ean?: string;
  category: number;
  default_buy_price_net: string;
  sell_price_gross: string;
  unit: 'PCS' | 'G' | 'ML';
  specifications?: Record<string, any>;
}