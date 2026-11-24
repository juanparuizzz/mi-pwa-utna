const DB_NAME = 'CafeteriaUTNA_OfflineDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('menu_cache')) {
        db.createObjectStore('menu_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cola_pedidos')) {
        db.createObjectStore('cola_pedidos', { keyPath: 'localId', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function guardarMenuLocal(productos) {
  const db = await openDB();
  const tx = db.transaction('menu_cache', 'readwrite');
  const store = tx.objectStore('menu_cache');
  store.clear();
  productos.forEach(p => store.put(p));
}

async function obtenerMenuLocal() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('menu_cache', 'readonly');
    const req = tx.objectStore('menu_cache').getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function guardarPedidoOffline(pedido) {
  const db = await openDB();
  const tx = db.transaction('cola_pedidos', 'readwrite');
  tx.objectStore('cola_pedidos').add(pedido);
}

async function obtenerPedidosOffline() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction('cola_pedidos', 'readonly');
    const req = tx.objectStore('cola_pedidos').getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function eliminarPedidoOffline(localId) {
  const db = await openDB();
  const tx = db.transaction('cola_pedidos', 'readwrite');
  tx.objectStore('cola_pedidos').delete(localId);
}