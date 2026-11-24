const SUPABASE_URL = 'https://PEGA_AQUI_TU_URL.supabase.co';
const SUPABASE_KEY = 'PEGA_AQUI_TU_ANON_PUBLIC_KEY';

const headersDB = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

let carrito = [];
let deferredPrompt;

// Inicialización
window.addEventListener('load', async () => {
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 400);
    }
  }, 700);

  actualizarEstadoRed();
  await cargarClimaAPI();
  await cargarMenu();
  await cargarHistorial();
});

// Eventos de conexión / desconexión (Sincronización automática)
window.addEventListener('online', async () => {
  actualizarEstadoRed();
  await sincronizarColaOffline();
  await cargarMenu();
  await cargarHistorial();
});

window.addEventListener('offline', actualizarEstadoRed);

function actualizarEstadoRed() {
  const banner = document.getElementById('network-banner');
  if (navigator.onLine) {
    banner.className = 'alert alert-success text-center mb-0 py-1 rounded-0 fw-semibold small';
    banner.textContent = '🟢 Conectado en línea — Base de datos sincronizada';
  } else {
    banner.className = 'alert alert-warning text-center mb-0 py-1 rounded-0 fw-semibold small';
    banner.textContent = '🟠 Sin conexión a internet — Trabajando con IndexedDB local (los pedidos se enviarán al volver la red)';
  }
}

// API Externa: Open-Meteo (Clima en Rincón de Romos / Aguascalientes)
async function cargarClimaAPI() {
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=22.23&longitude=-102.32&current_weather=true');
    const data = await res.json();
    const temp = data.current_weather.temperature;
    document.getElementById('weather-temp').textContent = `${temp}°C • Aguascalientes`;
    
    const rec = document.getElementById('weather-rec');
    if (temp >= 22) {
      rec.textContent = '☀️ Recomendación: Frappé de Moka o Agua Fresca';
      rec.className = 'badge bg-info text-dark fs-6';
    } else {
      rec.textContent = '❄️ Recomendación: Café Americano Caliente';
      rec.className = 'badge bg-warning text-dark fs-6';
    }
  } catch (e) {
    document.getElementById('weather-temp').textContent = 'Modo Offline Activo';
    document.getElementById('weather-rec').textContent = '📦 Datos en caché';
  }
}

// Cargar Menú (Supabase -> fallback IndexedDB)
async function cargarMenu() {
  let productos = [];
  const sourceBadge = document.getElementById('data-source-badge');

  try {
    if (!navigator.onLine) throw new Error('Sin red');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/productos?select=*&order=id.asc`, { headers: headersDB });
    if (!res.ok) throw new Error('Error Supabase');
    productos = await res.json();
    await guardarMenuLocal(productos);
    sourceBadge.textContent = 'Fuente: Supabase Cloud';
    sourceBadge.className = 'badge bg-success';
  } catch (err) {
    productos = await obtenerMenuLocal();
    sourceBadge.textContent = 'Fuente: IndexedDB Offline';
    sourceBadge.className = 'badge bg-warning text-dark';
  }

  const container = document.getElementById('menu-container');
  container.innerHTML = productos.map(p => `
    <div class="col-md-6">
      <div class="card h-100 product-card shadow-sm">
        <div class="card-body d-flex flex-column justify-content-between">
          <div>
            <span class="badge bg-secondary mb-2">${p.categoria}</span>
            <h5 class="card-title fw-bold text-white">${p.nombre}</h5>
          </div>
          <div class="d-flex justify-content-between align-items-center mt-3">
            <span class="fs-5 fw-bold text-warning">$${Number(p.precio).toFixed(2)}</span>
            <button class="btn btn-success btn-sm fw-bold" onclick='agregarCarrito(${JSON.stringify(p)})'>+ Agregar</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function agregarCarrito(producto) {
  carrito.push(producto);
  renderCarrito();
}

function renderCarrito() {
  const list = document.getElementById('cart-list');
  const totalEl = document.getElementById('cart-total');
  if (carrito.length === 0) {
    list.innerHTML = '<li class="list-group-item text-muted text-center">Selecciona productos del menú</li>';
    totalEl.textContent = '$0.00';
    return;
  }
  let total = 0;
  list.innerHTML = carrito.map((item, idx) => {
    total += Number(item.precio);
    return `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span>${item.nombre}</span>
        <div>
          <span class="fw-bold text-warning me-2">$${Number(item.precio).toFixed(2)}</span>
          <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="eliminarCarrito(${idx})">x</button>
        </div>
      </li>
    `;
  }).join('');
  totalEl.textContent = `$${total.toFixed(2)}`;
}

function eliminarCarrito(idx) {
  carrito.splice(idx, 1);
  renderCarrito();
}

// Registrar Pedido (Online -> Supabase | Offline -> IndexedDB)
document.getElementById('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (carrito.length === 0) return alert('Agrega al menos un producto.');

  const total = carrito.reduce((acc, el) => acc + Number(el.precio), 0);
  const pedido = {
    cliente: document.getElementById('cliente-nombre').value.trim(),
    matricula: document.getElementById('cliente-matricula').value.trim(),
    items: carrito,
    total: total,
    estado: 'En preparación'
  };

  if (navigator.onLine) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pedidos`, {
        method: 'POST',
        headers: headersDB,
        body: JSON.stringify(pedido)
      });
      if (!res.ok) throw new Error('Fallo POST');
      alert('✅ ¡Pedido registrado en la base de datos!');
    } catch (err) {
      await guardarPedidoOffline(pedido);
      alert('⚠️ Error de red: Guardado localmente en IndexedDB para sincronizar.');
    }
  } else {
    await guardarPedidoOffline(pedido);
    alert('🟠 Sin conexión: Pedido guardado en IndexedDB. Se enviará solo cuando regrese el internet.');
  }

  carrito = [];
  renderCarrito();
  e.target.reset();
  await cargarHistorial();
});

// Sincronización automática al recuperar conexión
async function sincronizarColaOffline() {
  const pendientes = await obtenerPedidosOffline();
  if (pendientes.length === 0) return;

  for (const item of pendientes) {
    const { localId, ...datosLimpios } = item;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pedidos`, {
        method: 'POST',
        headers: headersDB,
        body: JSON.stringify(datosLimpios)
      });
      if (res.ok) await eliminarPedidoOffline(localId);
    } catch (e) {
      console.error('Error sincronizando item', e);
    }
  }
  alert(`🔄 ¡Conexión recuperada! Se sincronizaron ${pendientes.length} pedido(s) hacia Supabase.`);
}

async function cargarHistorial() {
  const list = document.getElementById('orders-history');
  const badge = document.getElementById('pending-badge');
  const pendientes = await obtenerPedidosOffline();

  if (pendientes.length > 0) {
    badge.classList.remove('d-none');
    badge.textContent = `${pendientes.length} en cola offline`;
  } else {
    badge.classList.add('d-none');
  }

  let html = pendientes.map(p => `
    <li class="list-group-item list-group-item-warning text-dark">
      <strong>⏳ [Local IndexedDB]</strong> ${p.cliente} (${p.matricula}) — <strong>$${Number(p.total).toFixed(2)}</strong>
    </li>
  `).join('');

  if (navigator.onLine) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/pedidos?select=*&order=id.desc&limit=5`, { headers: headersDB });
      const remotos = await res.json();
      html += remotos.map(p => `
        <li class="list-group-item">
          <strong>✅ #${p.id}</strong> ${p.cliente} (${p.matricula}) — <strong class="text-warning">$${Number(p.total).toFixed(2)}</strong>
          <span class="badge bg-success float-end">${p.estado}</span>
        </li>
      `).join('');
    } catch (e) {}
  }

  list.innerHTML = html || '<li class="list-group-item text-muted text-center">Aún no hay pedidos</li>';
}

// Service Worker: Registro y ciclo de actualización
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          const btnUpdate = document.getElementById('btn-update');
          btnUpdate.classList.remove('d-none');
          btnUpdate.onclick = () => {
            newWorker.postMessage({ action: 'skipWaiting' });
            window.location.reload();
          };
        }
      });
    });
  });
}

// Instalación PWA
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btnInstall = document.getElementById('btn-install');
  btnInstall.classList.remove('d-none');
  btnInstall.onclick = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') btnInstall.classList.add('d-none');
    deferredPrompt = null;
  };
});