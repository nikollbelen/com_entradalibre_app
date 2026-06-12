import './styles/main.css';

declare const Cesium: any;

// ── Types ─────────────────────────────────────────────────
type Category = string;
type DayHours = { open: string; close: string } | null;
interface EventHours {
  monday: DayHours; tuesday: DayHours; wednesday: DayHours;
  thursday: DayHours; friday: DayHours; saturday: DayHours; sunday: DayHours;
}
interface MapEvent {
  id: string;
  title: string;
  frequency_type: 'permanent' | 'temporary';
  format: string;
  category: Category;
  start_date: string | null;
  end_date: string | null;
  venue: string;
  latitude: number;
  longitude: number;
  url: string;
  hours: EventHours;
}

// ── Design tokens (populated dynamically from events.json) ────────────────
const COLOR_PALETTE = [
  '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#0d9488',
  '#f97316', '#84cc16', '#ec4899', '#6366f1', '#14b8a6',
  '#a855f7', '#eab308',
];
const ICON_MAP: Record<string, string> = {
  música: 'music_note', musica: 'music_note',
  cine: 'movie',
  teatro: 'theater_comedy',
  arte: 'palette',
  fotografía: 'photo_camera', fotografia: 'photo_camera',
  danza: 'nightlife',
  gastronomía: 'restaurant', gastronomia: 'restaurant',
  historia: 'history_edu',
  ciencia: 'science',
  literatura: 'menu_book',
  moda: 'checkroom', deportes: 'sports_and_outdoors',
  tecnología: 'computer', tecnologia: 'computer',
};
const LABEL_MAP: Record<string, string> = {
  música: 'Música', musica: 'Música',
  cine: 'Cine',
  teatro: 'Teatro',
  arte: 'Arte',
  fotografía: 'Fotografía', fotografia: 'Fotografía',
  danza: 'Danza',
  gastronomía: 'Gastronomía', gastronomia: 'Gastronomía',
  historia: 'Historia',
  ciencia: 'Ciencia',
  literatura: 'Literatura',
  moda: 'Moda', deportes: 'Deportes',
  tecnología: 'Tecnología', tecnologia: 'Tecnología',
};
const CAT_COLOR: Record<string, string> = {};
const CAT_ICON:  Record<string, string> = {};
const CAT_LABEL: Record<string, string> = {};
const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const FORMAT_LABEL: Record<string, string> = {
  museo: 'Museo', galeria_arte: 'Galería de Arte', concierto: 'Concierto',
  proyeccion: 'Proyección', obra_teatro: 'Obra de Teatro',
  exposicion: 'Exposición', festival: 'Festival', taller: 'Taller',
  sala_cine: 'Sala de Cine', centro_cultural: 'Centro Cultural',
  biblioteca: 'Biblioteca', feria_libro: 'Feria del Libro',
  espectaculo: 'Espectáculo', conferencia: 'Conferencia',
};
const FORMAT_ICON: Record<string, string> = {
  museo: 'museum', galeria_arte: 'palette', concierto: 'music_note',
  proyeccion: 'movie', obra_teatro: 'theater_comedy',
  exposicion: 'gallery_thumbnail', festival: 'celebration',
  taller: 'build', sala_cine: 'movie', centro_cultural: 'account_balance',
  biblioteca: 'local_library', feria_libro: 'menu_book',
  espectaculo: 'nightlife', conferencia: 'groups',
};
const WEEK_DISPLAY: { key: keyof EventHours; label: string }[] = [
  { key: 'monday', label: 'Lun' }, { key: 'tuesday',   label: 'Mar' },
  { key: 'wednesday', label: 'Mié' }, { key: 'thursday', label: 'Jue' },
  { key: 'friday', label: 'Vie' }, { key: 'saturday',  label: 'Sáb' },
  { key: 'sunday', label: 'Dom' },
];

const PRIMARY        = '#0066FF';
const SECONDARY      = '#50616b';
const INACTIVE_SIZE  = 52;
const ACTIVE_SIZE    = 60;

// ── Build pin canvas ──────────────────────────────────────
function buildPin(category: Category, active: boolean): HTMLCanvasElement {
  const r    = active ? 22 : 18;
  const pad  = 8;
  const size = (r + pad) * 2;
  const cx   = size / 2;
  const cy   = size / 2;

  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.shadowColor   = 'rgba(15,23,42,0.20)';
  ctx.shadowBlur    = active ? 12 : 7;
  ctx.shadowOffsetY = active ? 4 : 2;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = active ? CAT_COLOR[category] : 'white';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'white';
  ctx.lineWidth   = 2.5;
  ctx.stroke();

  ctx.font         = `${active ? 20 : 18}px "Material Symbols Outlined"`;
  ctx.fillStyle    = active ? 'white' : CAT_COLOR[category];
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(CAT_ICON[category], cx, cy + 1);

  return canvas;
}

// ── Pin size animation ────────────────────────────────────
const animCancels = new Map<string, () => void>();

function animatePin(
  id: string,
  entity: any,
  from: number,
  to: number,
  duration: number,
  onDone?: () => void,
): void {
  animCancels.get(id)?.();
  let cancelled = false;
  const start = performance.now();
  const tick = (now: number): void => {
    if (cancelled) return;
    const t    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const size = from + (to - from) * ease;
    entity.billboard.width  = size;
    entity.billboard.height = size;
    if (t < 1) requestAnimationFrame(tick);
    else onDone?.();
  };
  requestAnimationFrame(tick);
  animCancels.set(id, () => { cancelled = true; });
}

// ── Button active state ───────────────────────────────────
function setButtonActive(btn: HTMLButtonElement | null, active: boolean): void {
  btn?.classList.toggle('btn-nav-active', active);
}

// ── App ───────────────────────────────────────────────────
async function main(): Promise<void> {

  // Preloader
  const preloaderEl = document.getElementById('preloader');
  if (preloaderEl) {
    setTimeout(() => {
      preloaderEl.classList.add('done');
      preloaderEl.addEventListener('transitionend', () => preloaderEl.remove(), { once: true });
    }, 2000);
  }

  // Cesium viewer
  const token = import.meta.env.VITE_CESIUM_TOKEN as string;
  Cesium.Ion.defaultAccessToken = token;

  const viewer = new Cesium.Viewer('cesium-container', {
    baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: false, navigationHelpButton: false,
    animation: false, timeline: false, fullscreenButton: false,
    infoBox: false, selectionIndicator: false, scene3DOnly: true,
  });

  viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      credit: '© OpenStreetMap contributors',
      maximumLevel: 19,
    })
  );
  viewer.scene.globe.enableLighting = false;
  viewer.scene.skyBox.show          = false;
  viewer.scene.skyAtmosphere.show   = false;
  viewer.scene.sun.show             = false;
  viewer.scene.moon.show            = false;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(-77.0428, -12.0464, 25000),
    duration: 0,
  });

  // Load events
  const events: MapEvent[] = await fetch('/events.json').then(r => r.json());

  // Populate design tokens from loaded events (no repeating colors)
  [...new Set(events.map(e => e.category))].forEach((cat, i) => {
    CAT_COLOR[cat] = COLOR_PALETTE[i % COLOR_PALETTE.length];
    CAT_ICON[cat]  = ICON_MAP[cat.toLowerCase()] ?? 'event';
    CAT_LABEL[cat] = LABEL_MAP[cat.toLowerCase()] ?? cat;
  });

  // Wait for icon font before drawing canvas pins
  await document.fonts.load('20px "Material Symbols Outlined"', 'palette');

  // Render pins
  const entityMap = new Map<string, any>();
  for (const ev of events) {
    const entity = viewer.entities.add({
      id: `pin-${ev.id}`,
      position: Cesium.Cartesian3.fromDegrees(ev.longitude, ev.latitude),
      billboard: {
        image:                    buildPin(ev.category, false),
        width:                    INACTIVE_SIZE,
        height:                   INACTIVE_SIZE,
        verticalOrigin:           Cesium.VerticalOrigin.CENTER,
        heightReference:          Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    entityMap.set(ev.id, entity);
  }

  // ── DOM: pulse ring ───────────────────────────────────
  const pulseEl = document.createElement('div');
  pulseEl.id = 'pin-pulse';
  document.body.appendChild(pulseEl);

  // ── DOM: pin card ─────────────────────────────────────
  const cardEl = document.createElement('div');
  cardEl.id = 'pin-card';
  document.body.appendChild(cardEl);

  // ── State ─────────────────────────────────────────────
  let hoveredId:  string | null = null;
  let selectedId: string | null = null;
  const activePins = new Set<string>(); // pins currently painted active

  // ── Helpers ───────────────────────────────────────────
  function getScreenPos(entity: any, fallback: { x: number; y: number }) {
    try {
      const cart = entity.position.getValue(viewer.clock.currentTime);
      if (!cart) return fallback;
      const sc = viewer.scene.cartesianToCanvasCoordinates(cart);
      return sc ? { x: Math.round(sc.x), y: Math.round(sc.y) } : fallback;
    } catch { return fallback; }
  }

  function getEventId(picked: any): string | null {
    const rawId: string = picked?.id?.id ?? '';
    return rawId.startsWith('pin-') ? rawId.slice(4) : null;
  }

  /** Paint a single pin as active — does NOT touch any other pin */
  function activatePinVisual(id: string): void {
    if (activePins.has(id)) return;
    activePins.add(id);
    const ev  = events.find(e => e.id === id)!;
    const ent = entityMap.get(id)!;
    ent.billboard.image  = buildPin(ev.category, true);
    ent.billboard.width  = INACTIVE_SIZE;
    ent.billboard.height = INACTIVE_SIZE;
    animatePin(id, ent, INACTIVE_SIZE, ACTIVE_SIZE, 200);
  }

  /** Return a single pin to inactive — does NOT touch any other pin */
  function deactivatePinVisual(id: string): void {
    if (!activePins.has(id)) return;
    activePins.delete(id);
    const ev  = events.find(e => e.id === id)!;
    const ent = entityMap.get(id)!;
    animatePin(id, ent, ACTIVE_SIZE, INACTIVE_SIZE, 180, () => {
      ent.billboard.image  = buildPin(ev.category, false);
      ent.billboard.width  = INACTIVE_SIZE;
      ent.billboard.height = INACTIVE_SIZE;
    });
  }

  function showPulse(x: number, y: number, category?: Category): void {
    pulseEl.style.left       = `${x}px`;
    pulseEl.style.top        = `${y}px`;
    pulseEl.style.background = category ? CAT_COLOR[category] : '#0ea5e9';
    pulseEl.classList.add('visible');
  }

  function hidePulse(): void {
    pulseEl.classList.remove('visible');
  }

  const DAY_KEYS: (keyof EventHours)[] = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

  function isOpenNow(slot: { open: string; close: string }): boolean {
    const now = new Date();
    const [oh, om] = slot.open.split(':').map(Number);
    const [ch, cm] = slot.close.split(':').map(Number);
    const nowMins  = now.getHours() * 60 + now.getMinutes();
    return nowMins >= oh * 60 + om && nowMins < ch * 60 + cm;
  }

  function showCard(ev: MapEvent, x: number, y: number): void {
    const color    = CAT_COLOR[ev.category];
    const label    = CAT_LABEL[ev.category];
    const todayKey = DAY_KEYS[new Date().getDay()];

    let metaIcon: string;
    let metaText: string;
    if (ev.frequency_type === 'temporary' && ev.start_date) {
      const [yStr, mStr, dStr] = ev.start_date.split('-');
      const startD = new Date(parseInt(yStr), parseInt(mStr) - 1, parseInt(dStr));
      const evDayKey = DAY_KEYS[startD.getDay()];
      const slot = ev.hours[evDayKey];
      metaIcon = 'calendar_month';
      metaText = `${parseInt(dStr)} ${MONTHS[parseInt(mStr) - 1]}${slot ? ` · ${slot.open}` : ''}`;
    } else {
      const slot = ev.hours[todayKey];
      metaIcon = 'schedule';
      if (slot && isOpenNow(slot)) {
        metaText = `Abierto · cierra ${slot.close}`;
      } else if (slot) {
        metaText = `Cerrado · abre ${slot.open}`;
      } else {
        metaText = 'Cerrado hoy';
      }
    }

    const scheduleHtml = ev.frequency_type === 'permanent' ? `
      <div style="position:relative;margin:0 0 10px;">
        <button id="schedule-toggle"
          style="display:flex;align-items:center;gap:4px;background:none;border:none;
            cursor:pointer;padding:0;margin:0;color:#0066FF;
            font-family:inherit;font-size:12px;font-weight:600;">
          <span class="material-symbols-outlined"
            style="font-size:14px;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20;">schedule</span>
          Ver horarios
          <span id="schedule-chevron" class="material-symbols-outlined"
            style="font-size:14px;margin-left:2px;transition:transform 200ms;
              font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20;">expand_more</span>
        </button>
        <div id="schedule-body" style="display:none;position:absolute;left:-20px;right:-20px;
          top:calc(100% + 6px);z-index:20;border-radius:10px;overflow:hidden;
          background:white;border:1px solid rgba(190,200,210,0.25);
          box-shadow:0 8px 24px rgba(15,23,42,0.12);">
          ${WEEK_DISPLAY.map(({ key, label: dayLabel }) => {
            const slot    = ev.hours[key];
            const isToday = key === todayKey;
            return `<div style="display:flex;justify-content:space-between;align-items:center;
                padding:5px 10px;background:${isToday ? color + '18' : 'transparent'};">
                <span style="font-size:11px;font-weight:${isToday ? 700 : 500};
                  color:${isToday ? color : '#3e4850'};min-width:30px;">${dayLabel}</span>
                <span style="font-size:11px;font-weight:${isToday ? 600 : 400};
                  color:${isToday ? color : (slot ? '#191c1e' : '#94a3b8')};">
                  ${slot ? `${slot.open} – ${slot.close}` : 'Cerrado'}
                </span>
              </div>`;
          }).join('')}
        </div>
      </div>` : '';

    cardEl.innerHTML = `
      <div style="width:288px;background:#fff;border-radius:16px;
                  box-shadow:0 12px 32px rgba(15,23,42,0.13);
                  border:1px solid rgba(190,200,210,0.25);position:relative;">
        <div style="height:96px;position:relative;overflow:hidden;border-radius:16px 16px 0 0;">
          <img src="/images/fondoevento.png" alt=""
            style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />
          <div style="position:absolute;inset:0;
            background:linear-gradient(135deg,${color}99,${color}33);"></div>
          <div style="position:absolute;inset:0;
            background:linear-gradient(to top,rgba(0,0,0,0.28),transparent);"></div>
          <button id="card-close-btn"
            style="position:absolute;top:8px;right:8px;width:28px;height:28px;
              background:rgba(255,255,255,0.92);border:none;border-radius:9999px;
              cursor:pointer;display:flex;align-items:center;justify-content:center;
              backdrop-filter:blur(6px);">
            <span class="material-symbols-outlined"
              style="font-size:16px;color:#191c1e;line-height:1;
                font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20;">close</span>
          </button>
        </div>
        <div style="padding:16px 20px 20px;position:relative;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
            <span style="background:${color}22;color:${color};padding:2px 9px;
              border-radius:9999px;font-size:10px;font-weight:700;
              text-transform:uppercase;letter-spacing:.05em;">${label}</span>
            <span style="background:#0066FF18;color:#0066FF;padding:2px 9px;
              border-radius:9999px;font-size:10px;font-weight:700;
              text-transform:uppercase;letter-spacing:.05em;
              display:inline-flex;align-items:center;gap:3px;">
              <span class="material-symbols-outlined"
                style="font-size:11px;font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20;">${FORMAT_ICON[ev.format] ?? 'event'}</span>
              ${FORMAT_LABEL[ev.format] ?? ev.format}
            </span>
            <span style="color:#3e4850;font-size:12px;font-weight:500;
              display:flex;align-items:center;gap:3px;">
              <span class="material-symbols-outlined"
                style="font-size:13px;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20;">${metaIcon}</span>
              ${metaText}
            </span>
          </div>
          <h3 style="font-size:15px;font-weight:600;color:#191c1e;
            line-height:1.3;margin:0 0 4px;">${ev.title}</h3>
          <p style="font-size:12px;color:#3e4850;display:flex;align-items:center;
            gap:3px;margin:0 0 8px;">
            <span class="material-symbols-outlined"
              style="font-size:14px;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20;">location_on</span>
            ${ev.venue}
          </p>
          ${scheduleHtml}
          <a href="https://entradalibre.me" target="_blank" rel="noopener noreferrer"
            style="display:flex;align-items:center;justify-content:center;gap:6px;
              background:#d3e5f1;color:#0066FF;border-radius:12px;padding:9px 16px;
              font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;">
            Ver página del evento
            <span class="material-symbols-outlined"
              style="font-size:15px;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20;">arrow_forward</span>
          </a>
        </div>
        <div style="position:absolute;bottom:-7px;left:50%;
          transform:translateX(-50%) rotate(45deg);width:14px;height:14px;
          background:#fff;border-right:1px solid rgba(190,200,210,0.25);
          border-bottom:1px solid rgba(190,200,210,0.25);z-index:-1;"></div>
      </div>
    `;

    document.getElementById('card-close-btn')!.addEventListener('click', e => {
      e.stopPropagation();
      closeCard();
    });

    if (ev.frequency_type === 'permanent') {
      const toggleBtn    = document.getElementById('schedule-toggle')!;
      const scheduleBody = document.getElementById('schedule-body')!;
      const chevron      = document.getElementById('schedule-chevron')!;
      toggleBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = scheduleBody.style.display !== 'none';
        scheduleBody.style.display = isOpen ? 'none' : 'block';
        chevron.style.transform    = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    }

    cardEl.style.left = `${x}px`;
    cardEl.style.top  = `${y - 24}px`;
    cardEl.classList.add('visible');
  }

  function hideCard(): void {
    cardEl.classList.remove('visible');
  }

  function closeCard(): void {
    const prev = selectedId;
    selectedId = null;
    hideCard();
    hidePulse();
    if (prev && prev !== hoveredId) deactivatePinVisual(prev);
  }

  // ── Hover handler ─────────────────────────────────────
  const moveHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  moveHandler.setInputAction((e: any) => {
    const id = getEventId(viewer.scene.pick(e.endPosition));

    if (id) {
      if (id !== hoveredId) {
        // Deactivate previous hovered pin ONLY if it is not the selected one
        if (hoveredId && hoveredId !== selectedId) {
          deactivatePinVisual(hoveredId);
        }
        hoveredId = id;
        activatePinVisual(id);
        // Move pulse only when there is no selection (pulse follows selected pin)
        if (!selectedId) {
          const ent = entityMap.get(id)!;
          const pos = getScreenPos(ent, { x: e.endPosition.x, y: e.endPosition.y });
          showPulse(pos.x, pos.y, events.find(e => e.id === id)?.category);
        }
      }
      viewer.scene.canvas.style.cursor = 'pointer';
      return;
    }

    // Mouse left all pins
    if (hoveredId !== null) {
      if (hoveredId !== selectedId) deactivatePinVisual(hoveredId);
      hoveredId = null;
      if (!selectedId) hidePulse();
    }
    viewer.scene.canvas.style.cursor = 'default';
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // ── Click handler ─────────────────────────────────────
  const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  clickHandler.setInputAction((e: any) => {
    const id = getEventId(viewer.scene.pick(e.position));

    if (id) {
      // Click on the already-selected pin → close
      if (id === selectedId) {
        selectedId = null;
        hideCard();
        hidePulse();
        // Keep it active visually only if still hovering it
        if (id !== hoveredId) deactivatePinVisual(id);
        return;
      }

      // Click on a new pin
      const prevSelected = selectedId;
      selectedId = id;

      // Deactivate the old selected pin (only if not currently hovered)
      if (prevSelected && prevSelected !== hoveredId) {
        deactivatePinVisual(prevSelected);
      }

      const ev  = events.find(ev => ev.id === id)!;
      const ent = entityMap.get(id)!;
      const pos = getScreenPos(ent, { x: e.position.x, y: e.position.y });

      activatePinVisual(id);
      showPulse(pos.x, pos.y, ev.category);
      showCard(ev, pos.x, pos.y);
      return;
    }

    // Click on empty map → close selection
    if (selectedId) {
      const prev = selectedId;
      selectedId = null;
      hideCard();
      hidePulse();
      if (prev !== hoveredId) deactivatePinVisual(prev);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // ── Search with debounce ──────────────────────────────
  const searchInput    = document.getElementById('search-input')    as HTMLInputElement;
  const searchDropdown = document.getElementById('search-dropdown') as HTMLDivElement;

  function positionDropdown(): void {
    const wrapper = document.getElementById('search-wrapper')!;
    const rect    = wrapper.getBoundingClientRect();
    searchDropdown.style.top  = `${rect.bottom + 18}px`;
    searchDropdown.style.left = `${rect.left}px`;
    searchDropdown.style.width = `${Math.max(320, rect.width)}px`;
  }

  function openDropdown(results: MapEvent[]): void {
    positionDropdown();
    if (results.length === 0) {
      searchDropdown.innerHTML = `<div class="sd-empty">Sin resultados</div>`;
    } else {
      searchDropdown.innerHTML = results.map(ev => {
        const color = CAT_COLOR[ev.category];
        const icon  = CAT_ICON[ev.category];
        const label = CAT_LABEL[ev.category];
        return `
          <div class="sd-item" data-id="${ev.id}">
            <div class="sd-icon" style="background:${color}22;">
              <span class="material-symbols-outlined"
                style="font-size:18px;color:${color};
                  font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20;">${icon}</span>
            </div>
            <div>
              <div class="sd-title">${ev.title}</div>
              <div class="sd-sub">${label} · ${ev.venue}</div>
            </div>
          </div>
        `;
      }).join('');

      searchDropdown.querySelectorAll<HTMLDivElement>('.sd-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id!;
          const ev = events.find(e => e.id === id)!;
          closeDropdown();
          searchInput.value = '';

          // Fly to event and open its card
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(ev.longitude, ev.latitude, 1500),
            duration: 1,
            easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
            complete: () => {
              const ent = entityMap.get(id)!;
              const pos = getScreenPos(ent, { x: 0, y: 0 });
              selectedId = id;
              activatePinVisual(id);
              showPulse(pos.x, pos.y, ev.category);
              showCard(ev, pos.x, pos.y);
            },
          });
        });
      });
    }
    searchDropdown.classList.add('open');
  }

  function closeDropdown(): void {
    searchDropdown.classList.remove('open');
    searchDropdown.innerHTML = '';
  }

  let debounceTimer: ReturnType<typeof setTimeout>;

  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();

    if (query.length < 1) { closeDropdown(); return; }

    debounceTimer = setTimeout(() => {
      const q       = query.toLowerCase();
      const results = events.filter(ev =>
        ev.title.toLowerCase().includes(q) ||
        ev.venue.toLowerCase().includes(q) ||
        CAT_LABEL[ev.category].toLowerCase().includes(q)
      );
      openDropdown(results);
    }, 300);
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!document.getElementById('search-wrapper')?.contains(e.target as Node)) {
      closeDropdown();
    }
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDropdown(); searchInput.blur(); }
  });

  // ── Categories dropdown ───────────────────────────────
  const btnCategories  = document.getElementById('btn-categories')    as HTMLButtonElement;
  const catDropdownEl  = document.getElementById('categories-dropdown') as HTMLDivElement;

  // Derive unique categories and formats from loaded events
  const allCategories  = [...new Set(events.map(e => e.category))];
  const activeCategories = new Set<string>(allCategories);
  const activeFormats    = new Set<string>(events.map(e => e.format));

  function positionCatDropdown(): void {
    const rect = btnCategories.getBoundingClientRect();
    catDropdownEl.style.top  = `${rect.bottom + 16}px`;
    catDropdownEl.style.left = `${rect.left}px`;
  }

  function buildCatDropdown(targetEl?: HTMLDivElement): void {
    const el = targetEl ?? catDropdownEl;
    const FILL = `font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20;`;
    el.innerHTML = `
      <div class="cat-header">Categorías</div>
      ${allCategories.map(cat => {
        const color   = CAT_COLOR[cat];
        const icon    = CAT_ICON[cat];
        const label   = CAT_LABEL[cat];
        const checked = activeCategories.has(cat);
        const checkBg = checked ? `background:${color};border-color:${color};` : '';
        const checkmark = checked
          ? `<span class="material-symbols-outlined" style="font-size:13px;color:white;${FILL}">check</span>`
          : '';
        return `
          <div class="cat-item" data-cat="${cat}">
            <div class="cat-item-left">
              <div class="cat-icon" style="background:${color}22;">
                <span class="material-symbols-outlined" style="font-size:18px;color:${color};${FILL}">${icon}</span>
              </div>
              <span class="cat-label">${label}</span>
            </div>
            <div class="cat-check" data-cat="${cat}" style="${checkBg}">${checkmark}</div>
          </div>`;
      }).join('')}
    `;

    el.querySelectorAll<HTMLDivElement>('.cat-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const cat     = item.dataset.cat!;
        const check   = item.querySelector<HTMLDivElement>('.cat-check')!;
        const color   = CAT_COLOR[cat];
        const FILL_S  = `font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 18;`;

        if (activeCategories.has(cat)) {
          activeCategories.delete(cat);
          check.style.background   = '';
          check.style.borderColor  = '';
          check.innerHTML          = '';
        } else {
          activeCategories.add(cat);
          check.style.background   = color;
          check.style.borderColor  = color;
          check.innerHTML = `<span class="material-symbols-outlined" style="font-size:13px;color:white;${FILL_S}">check</span>`;
        }
        applyFilters();
      });
    });
  }

  // ── Calendar state ────────────────────────────────────
  type DatePreset = 'any' | 'weekend' | 'week' | 'month' | 'custom';
  let calPreset:    DatePreset = 'any';
  let calRangeStart: Date | null = null;
  let calRangeEnd:   Date | null = null;
  let calViewYear  = new Date().getFullYear();
  let calViewMonth = new Date().getMonth();
  let calClickStep: 0 | 1 = 0;

  function getCalRange(): { start: Date | null; end: Date | null } {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    if (calPreset === 'any') return { start: null, end: null };
    if (calPreset === 'weekend') {
      const dow = t.getDay();
      const toSat = dow === 6 ? 0 : (6 - dow + 7) % 7;
      const sat = new Date(t); sat.setDate(t.getDate() + toSat);
      const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
      return { start: sat, end: sun };
    }
    if (calPreset === 'week') {
      const dow = t.getDay();
      const mon = new Date(t); mon.setDate(t.getDate() + (dow === 0 ? -6 : 1 - dow));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: mon, end: sun };
    }
    if (calPreset === 'month') {
      return {
        start: new Date(t.getFullYear(), t.getMonth(), 1),
        end:   new Date(t.getFullYear(), t.getMonth() + 1, 0),
      };
    }
    return { start: calRangeStart, end: calRangeEnd };
  }

  function applyFilters(): void {
    const { start: rangeS, end: rangeE } = getCalRange();
    for (const ev of events) {
      const ent = entityMap.get(ev.id);
      if (!ent) continue;
      let visible = activeCategories.has(ev.category) && activeFormats.has(ev.format);
      if (visible && rangeS && rangeE && ev.frequency_type === 'temporary' && ev.start_date) {
        const evS = new Date(ev.start_date); evS.setHours(0, 0, 0, 0);
        const evE = ev.end_date ? new Date(ev.end_date) : new Date(evS); evE.setHours(0, 0, 0, 0);
        visible = evS <= rangeE && evE >= rangeS;
      }
      ent.show = visible;
      if (!visible) {
        if (selectedId === ev.id) closeCard();
        if (hoveredId  === ev.id) { deactivatePinVisual(ev.id); hoveredId = null; hidePulse(); }
        activePins.delete(ev.id);
      }
    }
  }

  let catOpen = false;

  btnCategories?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (catOpen) {
      catDropdownEl.classList.remove('open');
      catOpen = false; setButtonActive(btnCategories, false);
      overlayEl.classList.remove('active');
    } else {
      closeAllDropdowns();
      positionCatDropdown();
      buildCatDropdown();
      catDropdownEl.classList.add('open');
      catOpen = true; setButtonActive(btnCategories, true);
      overlayEl.classList.add('active');
    }
  });

  document.addEventListener('click', (e) => {
    if (catOpen && !catDropdownEl.contains(e.target as Node) && e.target !== btnCategories) {
      catDropdownEl.classList.remove('open');
      catOpen = false; setButtonActive(btnCategories, false);
      overlayEl.classList.remove('active');
    }
  });

  // ── Eventos / Recurrentes dropdowns ──────────────────
  const btnEventos     = document.getElementById('btn-eventos')      as HTMLButtonElement;
  const btnRecurrentes = document.getElementById('btn-recurrentes')  as HTMLButtonElement;
  const evDropdownEl   = document.getElementById('eventos-dropdown')     as HTMLDivElement;
  const recDropdownEl  = document.getElementById('recurrentes-dropdown') as HTMLDivElement;

  function positionFmtDropdown(btn: HTMLButtonElement, el: HTMLDivElement): void {
    const rect = btn.getBoundingClientRect();
    el.style.top  = `${rect.bottom + 16}px`;
    el.style.left = `${rect.left}px`;
  }

  function buildFmtDropdown(freqType: 'temporary' | 'permanent', el: HTMLDivElement): void {
    const FILL  = `font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20;`;
    const fmts  = [...new Set(events.filter(e => e.frequency_type === freqType).map(e => e.format))];
    const title = freqType === 'temporary' ? 'Eventos' : 'Recurrentes';

    el.innerHTML = `
      <div class="cat-header">${title}</div>
      ${fmts.map(fmt => {
        const icon    = FORMAT_ICON[fmt]  ?? 'event';
        const label   = FORMAT_LABEL[fmt] ?? fmt;
        const checked = activeFormats.has(fmt);
        const checkBg = checked ? 'background:#0066FF;border-color:#0066FF;' : '';
        const checkmark = checked
          ? `<span class="material-symbols-outlined" style="font-size:13px;color:white;${FILL}">check</span>`
          : '';
        return `
          <div class="cat-item" data-fmt="${fmt}">
            <div class="cat-item-left">
              <div class="cat-icon" style="background:#0066FF18;">
                <span class="material-symbols-outlined" style="font-size:18px;color:#0066FF;${FILL}">${icon}</span>
              </div>
              <span class="cat-label">${label}</span>
            </div>
            <div class="cat-check" data-fmt="${fmt}" style="${checkBg}">${checkmark}</div>
          </div>`;
      }).join('')}
    `;

    el.querySelectorAll<HTMLDivElement>('.cat-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const fmt    = item.dataset.fmt!;
        const check  = item.querySelector<HTMLDivElement>('.cat-check')!;
        const FILL_S = `font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 18;`;
        if (activeFormats.has(fmt)) {
          activeFormats.delete(fmt);
          check.style.background  = '';
          check.style.borderColor = '';
          check.innerHTML         = '';
        } else {
          activeFormats.add(fmt);
          check.style.background  = '#0066FF';
          check.style.borderColor = '#0066FF';
          check.innerHTML = `<span class="material-symbols-outlined" style="font-size:13px;color:white;${FILL_S}">check</span>`;
        }
        applyFilters();
      });
    });
  }

  let evOpen  = false;
  let recOpen = false;

  const overlayEl = document.getElementById('mobile-overlay') as HTMLDivElement;

  function closeAllDropdowns(): void {
    closeDropdown();
    catDropdownEl.classList.remove('open');  catOpen = false; setButtonActive(btnCategories, false);
    evDropdownEl.classList.remove('open');   evOpen  = false; setButtonActive(btnEventos, false);
    recDropdownEl.classList.remove('open');  recOpen = false; setButtonActive(btnRecurrentes, false);
    calDropdownEl.classList.remove('open');  calOpen = false; setButtonActive(btnCalendar, calPreset !== 'any');
    overlayEl.classList.remove('active');
  }

  overlayEl.addEventListener('click', () => closeAllDropdowns());

  btnEventos?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (evOpen) { closeAllDropdowns(); overlayEl.classList.remove('active'); return; }
    closeAllDropdowns();
    positionFmtDropdown(btnEventos, evDropdownEl);
    buildFmtDropdown('temporary', evDropdownEl);
    evDropdownEl.classList.add('open'); evOpen = true; setButtonActive(btnEventos, true);
    overlayEl.classList.add('active');
  });

  btnRecurrentes?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (recOpen) { closeAllDropdowns(); overlayEl.classList.remove('active'); return; }
    closeAllDropdowns();
    positionFmtDropdown(btnRecurrentes, recDropdownEl);
    buildFmtDropdown('permanent', recDropdownEl);
    recDropdownEl.classList.add('open'); recOpen = true; setButtonActive(btnRecurrentes, true);
    overlayEl.classList.add('active');
  });

  document.addEventListener('click', (e) => {
    if (evOpen  && !evDropdownEl.contains(e.target as Node)  && e.target !== btnEventos)
      { evDropdownEl.classList.remove('open');  evOpen  = false; setButtonActive(btnEventos, false);     overlayEl.classList.remove('active'); }
    if (recOpen && !recDropdownEl.contains(e.target as Node) && e.target !== btnRecurrentes)
      { recDropdownEl.classList.remove('open'); recOpen = false; setButtonActive(btnRecurrentes, false);  overlayEl.classList.remove('active'); }
  });

  // ── Calendar dropdown ─────────────────────────────────
  const btnCalendar  = document.getElementById('btn-calendar')     as HTMLButtonElement;
  const calDropdownEl = document.getElementById('calendar-dropdown') as HTMLDivElement;
  let calOpen = false;

  const MONTH_NAMES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                          'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  function updateCalendarButtonLabel(): void {
    const span = btnCalendar?.lastElementChild as HTMLElement | null;
    if (!span) return;
    const { start: s, end: e } = getCalRange();
    if (calPreset === 'any')     { span.textContent = 'Calendario'; }
    else if (calPreset === 'weekend') { span.textContent = 'Fin de semana'; }
    else if (calPreset === 'week')    { span.textContent = 'Esta semana'; }
    else if (calPreset === 'month')   { span.textContent = 'Este mes'; }
    else if (s && e) {
      const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
      span.textContent = s.getTime() === e.getTime() ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
    }
    setButtonActive(btnCalendar, calOpen || calPreset !== 'any');
  }

  function buildCalendarDropdown(targetEl?: HTMLDivElement): void {
    const el = targetEl ?? calDropdownEl;
    const { start: rangeS, end: rangeE } = getCalRange();
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const firstDow = (() => { const d = new Date(calViewYear, calViewMonth, 1).getDay(); return d === 0 ? 6 : d - 1; })();
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();

    let cellsHtml = '';
    for (let i = 0; i < firstDow; i++) cellsHtml += `<div class="cal-day-cell"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(calViewYear, calViewMonth, d); date.setHours(0, 0, 0, 0);
      const ds   = `${calViewYear}-${String(calViewMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday  = date.getTime() === today.getTime();
      const isStart  = rangeS ? date.getTime() === rangeS.getTime() : false;
      const isEnd    = rangeE ? date.getTime() === rangeE.getTime() : false;
      const inBand   = rangeS && rangeE ? date > rangeS && date < rangeE : false;
      const isSingle = isStart && isEnd;

      const cellCls = ['cal-day-cell',
        inBand                         ? 'cal-in-range'    : '',
        isStart && rangeE && !isSingle ? 'cal-range-start' : '',
        isEnd   && rangeS && !isSingle ? 'cal-range-end'   : '',
      ].filter(Boolean).join(' ');

      const dayCls = ['cal-day',
        isToday            ? 'cal-today'    : '',
        (isStart || isEnd) ? 'cal-selected' : '',
      ].filter(Boolean).join(' ');

      cellsHtml += `<div class="${cellCls}"><div class="${dayCls}" data-date="${ds}">${d}</div></div>`;
    }

    const presets: { key: DatePreset; label: string }[] = [
      { key: 'any',     label: 'Cualquier fecha' },
      { key: 'weekend', label: 'Este fin de semana' },
      { key: 'week',    label: 'Esta semana' },
      { key: 'month',   label: 'Este mes' },
    ];

    el.innerHTML = `
      <div style="padding:14px 14px 16px;">
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
          ${presets.map(p => `
            <button data-preset="${p.key}"
              style="padding:4px 12px;border-radius:9999px;cursor:pointer;font-family:inherit;
                font-size:12px;font-weight:${calPreset === p.key ? 600 : 500};transition:all 120ms;
                border:1.5px solid ${calPreset === p.key ? '#0066FF' : '#bec8d2'};
                background:${calPreset === p.key ? '#0066FF' : 'white'};
                color:${calPreset === p.key ? 'white' : '#3e4850'};">
              ${p.label}
            </button>`).join('')}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <button data-cal-prev style="width:28px;height:28px;border:none;background:transparent;
            cursor:pointer;border-radius:9999px;display:flex;align-items:center;justify-content:center;
            color:#3e4850;">
            <span class="material-symbols-outlined" style="font-size:18px;">chevron_left</span>
          </button>
          <span style="font-size:14px;font-weight:600;color:#191c1e;">
            ${MONTH_NAMES_ES[calViewMonth]} ${calViewYear}
          </span>
          <button data-cal-next style="width:28px;height:28px;border:none;background:transparent;
            cursor:pointer;border-radius:9999px;display:flex;align-items:center;justify-content:center;
            color:#3e4850;">
            <span class="material-symbols-outlined" style="font-size:18px;">chevron_right</span>
          </button>
        </div>
        <div class="cal-grid" style="margin-bottom:4px;">
          ${['L','M','X','J','V','S','D'].map(l =>
            `<div style="text-align:center;font-size:11px;font-weight:600;color:#3e4850;padding:4px 0;">${l}</div>`
          ).join('')}
        </div>
        <div class="cal-grid">${cellsHtml}</div>
      </div>
    `;

    el.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        calPreset = btn.dataset.preset as DatePreset;
        calRangeStart = null; calRangeEnd = null; calClickStep = 0;
        applyFilters(); updateCalendarButtonLabel(); buildCalendarDropdown(targetEl);
      });
    });

    el.querySelectorAll<HTMLDivElement>('.cal-day').forEach(cell => {
      cell.addEventListener('click', e => {
        e.stopPropagation();
        const [y, m, d] = cell.dataset.date!.split('-').map(Number);
        const clicked = new Date(y, m - 1, d); clicked.setHours(0, 0, 0, 0);
        if (calClickStep === 0 || (calRangeStart && calRangeEnd)) {
          calPreset = 'custom'; calRangeStart = clicked; calRangeEnd = null; calClickStep = 1;
        } else {
          if (clicked < calRangeStart!) { calRangeEnd = calRangeStart; calRangeStart = clicked; }
          else { calRangeEnd = clicked; }
          calClickStep = 0;
          applyFilters(); updateCalendarButtonLabel();
        }
        buildCalendarDropdown(targetEl);
      });
    });

    el.querySelector<HTMLButtonElement>('[data-cal-prev]')?.addEventListener('click', e => {
      e.stopPropagation();
      calViewMonth--; if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
      buildCalendarDropdown(targetEl);
    });
    el.querySelector<HTMLButtonElement>('[data-cal-next]')?.addEventListener('click', e => {
      e.stopPropagation();
      calViewMonth++; if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
      buildCalendarDropdown(targetEl);
    });
  }

  btnCalendar?.addEventListener('click', e => {
    e.stopPropagation();
    if (calOpen) {
      calDropdownEl.classList.remove('open'); calOpen = false;
      setButtonActive(btnCalendar, calPreset !== 'any');
      overlayEl.classList.remove('active');
      return;
    }
    closeAllDropdowns();
    const rect = btnCalendar.getBoundingClientRect();
    calDropdownEl.style.top  = `${rect.bottom + 16}px`;
    calDropdownEl.style.left = `${rect.left}px`;
    buildCalendarDropdown();
    calDropdownEl.classList.add('open'); calOpen = true; setButtonActive(btnCalendar, true);
    overlayEl.classList.add('active');
  });

  document.addEventListener('click', e => {
    if (calOpen && !calDropdownEl.contains(e.target as Node) && e.target !== btnCalendar) {
      calDropdownEl.classList.remove('open'); calOpen = false;
      setButtonActive(btnCalendar, calPreset !== 'any');
      overlayEl.classList.remove('active');
    }
  });

  // ── Sync DOM elements with map on every frame ─────────
  viewer.scene.postRender.addEventListener(() => {
    const pulseId = selectedId ?? hoveredId;

    if (pulseId && pulseEl.classList.contains('visible')) {
      const ent = entityMap.get(pulseId);
      if (ent) {
        try {
          const cart = ent.position.getValue(viewer.clock.currentTime);
          const sc   = cart && viewer.scene.cartesianToCanvasCoordinates(cart);
          if (sc) {
            pulseEl.style.left = `${Math.round(sc.x)}px`;
            pulseEl.style.top  = `${Math.round(sc.y)}px`;
          }
        } catch { /* pin off-screen */ }
      }
    }

    if (selectedId && cardEl.classList.contains('visible')) {
      const ent = entityMap.get(selectedId);
      if (ent) {
        try {
          const cart = ent.position.getValue(viewer.clock.currentTime);
          const sc   = cart && viewer.scene.cartesianToCanvasCoordinates(cart);
          if (sc) {
            cardEl.style.left = `${Math.round(sc.x)}px`;
            cardEl.style.top  = `${Math.round(sc.y) - 24}px`;
          }
        } catch { /* pin off-screen */ }
      }
    }
  });

  // ── Zoom buttons ──────────────────────────────────────
  function smoothZoom(factor: number): void {
    const carto = viewer.camera.positionCartographic;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromRadians(
        carto.longitude,
        carto.latitude,
        carto.height * factor,
      ),
      duration: 0.7,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
    });
  }

  document.querySelector<HTMLButtonElement>('[data-zoom="in"]')
    ?.addEventListener('click', () => smoothZoom(0.45));
  document.querySelector<HTMLButtonElement>('[data-zoom="out"]')
    ?.addEventListener('click', () => smoothZoom(2.2));
  document.querySelector<HTMLButtonElement>('[data-location]')
    ?.addEventListener('click', () => {
      navigator.geolocation?.getCurrentPosition(p => {
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(p.coords.longitude, p.coords.latitude, 1500),
          duration: 1.5,
        });
      });
    });

  // ── Mobile UI (≤640px) ────────────────────────────────────

  const mobileSearchBtn     = document.getElementById('mobile-search-btn')     as HTMLButtonElement | null;
  const mobileSearchOverlay = document.getElementById('mobile-search-overlay') as HTMLDivElement | null;
  const mobileSearchInput   = document.getElementById('mobile-search-input')   as HTMLInputElement | null;
  const mobileSearchResults = document.getElementById('mobile-search-results') as HTMLDivElement | null;
  const mobileSearchClose   = document.getElementById('mobile-search-close')   as HTMLButtonElement | null;

  mobileSearchBtn?.addEventListener('click', () => {
    mobileSearchOverlay?.classList.add('open');
    setTimeout(() => mobileSearchInput?.focus(), 60);
  });

  mobileSearchClose?.addEventListener('click', () => {
    mobileSearchOverlay?.classList.remove('open');
    if (mobileSearchInput)   mobileSearchInput.value = '';
    if (mobileSearchResults) mobileSearchResults.innerHTML = '';
  });

  let mobileSearchDebounce: ReturnType<typeof setTimeout>;
  mobileSearchInput?.addEventListener('input', () => {
    clearTimeout(mobileSearchDebounce);
    const query = mobileSearchInput!.value.trim();
    if (!mobileSearchResults) return;
    if (query.length < 1) { mobileSearchResults.innerHTML = ''; return; }
    mobileSearchDebounce = setTimeout(() => {
      const q = query.toLowerCase();
      const results = events.filter(ev =>
        ev.title.toLowerCase().includes(q) ||
        ev.venue.toLowerCase().includes(q) ||
        CAT_LABEL[ev.category].toLowerCase().includes(q)
      );
      if (results.length === 0) {
        mobileSearchResults.innerHTML = `<div class="sd-empty">Sin resultados</div>`;
      } else {
        mobileSearchResults.innerHTML = results.map(ev => {
          const color = CAT_COLOR[ev.category];
          const icon  = CAT_ICON[ev.category];
          const label = CAT_LABEL[ev.category];
          return `<div class="sd-item" data-id="${ev.id}">
            <div class="sd-icon" style="background:${color}22;">
              <span class="material-symbols-outlined"
                style="font-size:18px;color:${color};font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20;">${icon}</span>
            </div>
            <div>
              <div class="sd-title">${ev.title}</div>
              <div class="sd-sub">${label} · ${ev.venue}</div>
            </div>
          </div>`;
        }).join('');
        mobileSearchResults.querySelectorAll<HTMLDivElement>('.sd-item').forEach(item => {
          item.addEventListener('click', () => {
            const id = item.dataset.id!;
            const ev = events.find(e => e.id === id)!;
            mobileSearchOverlay?.classList.remove('open');
            if (mobileSearchInput)   mobileSearchInput.value = '';
            if (mobileSearchResults) mobileSearchResults.innerHTML = '';
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(ev.longitude, ev.latitude, 1500),
              duration: 1,
              easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
              complete: () => {
                const ent = entityMap.get(id)!;
                const pos = getScreenPos(ent, { x: 0, y: 0 });
                selectedId = id;
                activatePinVisual(id);
                showPulse(pos.x, pos.y, ev.category);
                showCard(ev, pos.x, pos.y);
              },
            });
          });
        });
      }
    }, 300);
  });

  // Mobile filter modal
  const mobileFilterModal      = document.getElementById('mobile-filter-modal')       as HTMLDivElement | null;
  const mobileFilterModalBody  = document.getElementById('mobile-filter-modal-body')  as HTMLDivElement | null;
  const mobileFilterModalClose = document.getElementById('mobile-filter-modal-close') as HTMLButtonElement | null;

  function openMobileModal(): void {
    mobileFilterModal?.classList.add('open');
  }

  function closeMobileModal(): void {
    mobileFilterModal?.classList.remove('open');
    updateMobileButtonStates();
  }

  function updateMobileButtonStates(): void {
    const mbCal  = document.getElementById('mb-btn-calendar');
    const mbCats = document.getElementById('mb-btn-categories');
    const mbEv   = document.getElementById('mb-btn-eventos');
    const mbRec  = document.getElementById('mb-btn-recurrentes');
    mbCal?.classList.toggle('mb-btn-active', calPreset !== 'any');
    mbCats?.classList.toggle('mb-btn-active', activeCategories.size < allCategories.length);
    const evFmts  = [...new Set(events.filter(e => e.frequency_type === 'temporary').map(e => e.format))];
    const recFmts = [...new Set(events.filter(e => e.frequency_type === 'permanent').map(e => e.format))];
    mbEv?.classList.toggle('mb-btn-active',  evFmts.some(f  => !activeFormats.has(f)));
    mbRec?.classList.toggle('mb-btn-active', recFmts.some(f => !activeFormats.has(f)));
  }

  mobileFilterModalClose?.addEventListener('click', closeMobileModal);
  mobileFilterModal?.addEventListener('click', (e) => {
    if (e.target === mobileFilterModal) closeMobileModal();
  });

  // Mobile bottom bar buttons
  document.getElementById('mb-btn-calendar')?.addEventListener('click', () => {
    if (!mobileFilterModalBody) return;
    buildCalendarDropdown(mobileFilterModalBody);
    openMobileModal();
  });

  document.getElementById('mb-btn-categories')?.addEventListener('click', () => {
    if (!mobileFilterModalBody) return;
    buildCatDropdown(mobileFilterModalBody);
    openMobileModal();
  });

  document.getElementById('mb-btn-eventos')?.addEventListener('click', () => {
    if (!mobileFilterModalBody) return;
    buildFmtDropdown('temporary', mobileFilterModalBody);
    openMobileModal();
  });

  document.getElementById('mb-btn-recurrentes')?.addEventListener('click', () => {
    if (!mobileFilterModalBody) return;
    buildFmtDropdown('permanent', mobileFilterModalBody);
    openMobileModal();
  });
}

main();
