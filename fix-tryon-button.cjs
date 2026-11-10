const fs = require('fs');
let src = fs.readFileSync('src/pages/catalog.tsx', 'utf8');

// 1. Основной блок "В корзину"
const target1 = `            <Btn size="lg" className="flex-1 min-w-[200px]" onClick={() => addToCart(p.id, qty)}>
              <ShoppingBag size={18} /> В корзину
            </Btn>`;

const replacement1 = `            <Btn size="lg" className="flex-1 min-w-[200px]" onClick={() => addToCart(p.id, qty)}>
              <ShoppingBag size={18} /> В корзину
            </Btn>
            <Link to={\`/try-on?productId=\${p.id}\`} className="h-[52px] flex-1 min-w-[200px] px-4 rounded-[10px] border border-line bg-surface text-[14px] font-semibold hover:bg-cream transition-colors flex items-center justify-center gap-2 text-ink cursor-pointer">
              <Sparkles size={18} className="text-accent-deep" /> Примерить
            </Link>`;

if (src.includes(target1)) {
  src = src.replace(target1, replacement1);
  console.log("✅ Кнопка 'Примерить' добавлена в основной блок товара");
}

// 2. Компактный блок "В корзину" (для мобильных или списка)
const target2 = `              <Btn size="lg" className="flex-1 min-w-0" onClick={() => addToCart(p.id, qty)}>
                <ShoppingBag size={18} /> В корзину · {fmt(p.price * qty)}
              </Btn>`;

const replacement2 = `              <Btn size="lg" className="flex-1 min-w-0" onClick={() => addToCart(p.id, qty)}>
                <ShoppingBag size={18} /> В корзину · {fmt(p.price * qty)}
              </Btn>
              <Link to={\`/try-on?productId=\${p.id}\`} className="h-[44px] flex-1 min-w-0 px-3 rounded-[10px] border border-line bg-surface text-[13px] font-semibold hover:bg-cream transition-colors flex items-center justify-center gap-2 text-ink cursor-pointer">
                <Sparkles size={16} className="text-accent-deep" /> Примерить
              </Link>`;

if (src.includes(target2)) {
  src = src.replace(target2, replacement2);
  console.log("✅ Кнопка 'Примерить' добавлена в компактный блок товара");
}

fs.writeFileSync('src/pages/catalog.tsx', src);
console.log("🎉 Готово! Кнопки успешно внедрены.");
