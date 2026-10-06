# Entrada Libre — Mapa Interactivo de Eventos

Visor interactivo de eventos culturales gratuitos sobre mapa 3D vectorial, construido con **CesiumJS + Vite + TypeScript + Tailwind CSS v4**. Centrado en Lima, Perú.

---

## Características

- Mapa 3D interactivo con pines por categoría (color-coded)
- Pines personalizados dibujados en canvas con iconos de Material Symbols
- Animación de pin activo y pulso visual al pasar el cursor o seleccionar
- Filtros por categoría, formato, fecha y tipo (eventos / recurrentes)
- Calendario con presets: cualquier fecha, este fin de semana, esta semana y este mes
- Selección de rango de fechas personalizado
- Búsqueda con debounce en tiempo real
- Búsqueda por título, venue o categoría
- Tarjeta de detalle al hacer clic en un pin (horarios, venue, formato, categoría y enlace)
- Estado abierto/cerrado para eventos permanentes según el horario del día
- Desplegable semanal de horarios para espacios permanentes
- Modal de conflicto cuando un resultado está oculto por filtros, con opción para limpiar filtros
- Layout responsivo: barra superior en escritorio, barra inferior en móvil
- Búsqueda fullscreen en móvil
- Modal de filtros adaptado a móvil
- Botones de zoom con animación suave
- Botón de ubicación GPS con animación `flyTo`
- Preloader con logo al iniciar
- Datos editables desde `public/events.json`

---

## Requisitos

- Node.js 18+
- npm 9+
- Token de Cesium Ion
- Navegador moderno con soporte WebGL

---

## Instalación después de clonar

```bash
git clone <URL_DEL_REPOSITORIO>
cd com_entradalibre_app
```

```bash
npm install
```

---

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con tu token de Cesium Ion:

```env
VITE_CESIUM_TOKEN="tu_token_aqui"
```

Genera un token gratuito en [ion.cesium.com](https://ion.cesium.com).

---

## Desarrollo

```bash
npm run dev
```

Abre la URL que muestra la terminal (por defecto `http://localhost:5173`).

---

## Build para producción

```bash
npm run build      # compila TypeScript y genera /dist
npm run preview    # previsualiza el build localmente
```

---

## Agregar o editar eventos

Edita [`public/events.json`](public/events.json). Esquema de cada evento:

```json
{
  "id": "1",
  "title": "Nombre del lugar o evento",
  "frequency_type": "permanent",
  "format": "museo",
  "category": "Arte",
  "start_date": null,
  "end_date": null,
  "venue": "Dirección, Distrito",
  "latitude": -12.1412,
  "longitude": -77.0223,
  "url": "https://entradalibre.me",
  "hours": {
    "monday": null,
    "tuesday": { "open": "10:00", "close": "18:00" },
    "wednesday": { "open": "10:00", "close": "18:00" },
    "thursday": { "open": "10:00", "close": "18:00" },
    "friday": { "open": "10:00", "close": "22:00" },
    "saturday": { "open": "11:00", "close": "19:00" },
    "sunday": null
  }
}
```

Para eventos temporales usar `"frequency_type": "temporary"` con `start_date` y `end_date` en formato `YYYY-MM-DD`. El campo `hours` puede ser `null` o tener solo los días que apliquen.

### Valores posibles

| Campo | Valores |
|---|---|
| `frequency_type` | `permanent` · `temporary` |
| `category` | `Arte` · `Cine` · `Música` · `Teatro` · `Fotografía` · `Danza` · `Gastronomía` · `Historia` · `Ciencia` · `Literatura` · `Moda` · `Deportes` · `Tecnología` |
| `format` | `museo` · `galeria_arte` · `concierto` · `proyeccion` · `obra_teatro` · `exposicion` · `festival` · `taller` · `sala_cine` · `centro_cultural` · `biblioteca` · `feria_libro` · `espectaculo` · `conferencia` |

---

## Estructura del proyecto

```
com_entradalibre_app/
├── public/
│   ├── events.json          # Datos de eventos
│   └── images/              # Logo, favicon, fondo de tarjeta
├── src/
│   ├── main.ts              # Toda la lógica de la aplicación
│   ├── vite-env.d.ts        # Declaraciones de entorno TypeScript
│   └── styles/
│       └── main.css         # Tailwind v4 + tokens de diseño (Material 3)
├── index.html               # HTML principal (carga CesiumJS vía CDN)
├── vite.config.ts           # Configuración de Vite
├── tsconfig.json            # Configuración de TypeScript
└── package.json
```

> CesiumJS se carga desde CDN en `index.html` (no es una dependencia npm).

---

## Stack tecnológico

| Tecnología | Versión | Rol |
|---|---|---|
| [Vite](https://vitejs.dev) | 7.x | Bundler y servidor de desarrollo |
| [TypeScript](https://www.typescriptlang.org) | 5.8 | Lenguaje principal |
| [Tailwind CSS](https://tailwindcss.com) | 4.x | Estilos utilitarios |
| [CesiumJS](https://cesium.com/platform/cesiumjs/) | 1.134 | Motor de mapa 3D (CDN) |
| OpenStreetMap | — | Capa base del mapa (tiles vectoriales) |
| Material Symbols | — | Iconografía (Google Fonts CDN) |
| Inter | — | Tipografía (Google Fonts CDN) |

## Notas de datos

- Los eventos permanentes usan `frequency_type: "permanent"` y pueden mostrar horarios semanales.
- Los eventos temporales usan `frequency_type: "temporary"` y se filtran con `start_date` / `end_date`.
- Las categorías y formatos se detectan dinámicamente desde `events.json`; si agregas una nueva categoría sin icono definido, se mostrará con icono genérico.
- Las coordenadas deben estar en latitud/longitud decimal para que Cesium ubique correctamente cada pin.
