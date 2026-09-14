export interface PartCategory {
  id: number;
  name: string;
}

export interface Part {
  id: number;
  name: string;
  brand?: string;           // Dodano
  sku: string;
  ean?: string;             // Dodano
  category: number;         // Backend domyślnie zwraca ID kategorii
  category_name?: string;   // Dodano (z PartSerializer)
  default_buy_price_net: string; // ZMIENIONA NAZWA
  sell_price_gross: string;
  unit: 'PCS' | 'G' | 'ML';
  specifications?: Record<string, any>; // Dodano
}

export interface Stock {
  id: number;
  part: Part;
  location: any; // W przyszłości możesz to zamienić na Location, jeśli masz taki typ
  quantity: number;
  min_quantity: number;
  is_low_stock: boolean;
}
export interface CreatePartPayload {
  name: string;
  brand?: string; // Nowe pole
  sku?: string;   // Opcjonalne (backend wygeneruje automatycznie)
  ean?: string;   // Nowe pole dla skanera
  category: number;
  default_buy_price_net: string; // Zmieniona nazwa
  sell_price_gross: string;
  unit: 'PCS' | 'G' | 'ML';
  specifications?: Record<string, any>;
}