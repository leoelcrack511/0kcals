# 0KCALS — showcase

Versión estática del tema Shopify 100% custom de **0KCALS** (marketplace peruano de productos sin azúcar), publicada en GitHub Pages para portafolio.

El sitio se genera desde el código Liquid real del tema (`../0kcals-theme`, sin modificarlo) con [LiquidJS](https://liquidjs.com). Lo que antes resolvía Shopify se simula en el navegador:

| Shopify | Aquí |
|---|---|
| Catálogo del admin | `src/products.json` + fotos en `src/media/` |
| `/cart/add.js`, `/cart/change.js`, `/cart.js` | `src/0k-shim.js` responde desde `localStorage`; el `cart-drawer.js` del tema funciona sin cambios |
| `/cart` y `/pages/pedido` renderizados en servidor | Se pintan en el cliente con el mismo markup |
| `{% form 'contact' %}` | Muestra la confirmación "GOT IT!" sin enviar nada |
| Pedido / pre-orden por WhatsApp | Modo demo: muestra el mensaje armado en vez de abrir WhatsApp (el número real no se publica). Todo el texto se traduce al inglés en el build con `src/i18n/en.mjs` |

## Comandos

```bash
npm install
npm run build     # → dist/ con base /0kcals (GitHub Pages de proyecto)
npm run preview   # → build en la raíz + servidor en http://localhost:8080
npm run deploy    # build + publica dist/ en la rama gh-pages
```

`THEME_DIR` cambia la ruta del tema y `BASE_PATH` la ruta base (vacía = raíz del dominio).
