// Инструмент поиска товаров с учетом региона
export interface Product {
  id: string;
  name: string;
  price: number;
  deliveryRegions: string[]; // e.g., ['Курск', 'all_russia']
}

// Mock-база товаров для демонстрации логики (в Phase 2 заменим на реальный запрос к БД)
const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'Дверь межкомнатная (Курск)', price: 5000, deliveryRegions: ['Курск'] },
  { id: '2', name: 'Смартфон (СДЭК)', price: 30000, deliveryRegions: ['all_russia'] },
  { id: '3', name: 'Диван угловой (Курск, Воронеж)', price: 45000, deliveryRegions: ['Курск', 'Воронеж'] },
  { id: '4', name: 'Дверь входная (Москва)', price: 15000, deliveryRegions: ['Москва'] },
];

export function searchProducts(query: string, userRegion: string): Product[] {
  return MOCK_PRODUCTS.filter(p => {
    const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
    // Товар доступен, если его регион доставки совпадает с регионом пользователя или это 'all_russia'
    const matchesRegion = p.deliveryRegions.includes(userRegion) || p.deliveryRegions.includes('all_russia');
    return matchesQuery && matchesRegion;
  });
}
