const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'media.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

// طابور كتابة بسيط عشان نمنع تضارب الكتابة في نفس الوقت
let writeChain = Promise.resolve();

function readAll() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('تعذرت قراءة ملف البيانات، هيتم اعتباره فاضي:', err.message);
    return [];
  }
}

function writeAll(items) {
  writeChain = writeChain.then(
    () =>
      new Promise((resolve, reject) => {
        const tmpFile = DATA_FILE + '.tmp';
        fs.writeFile(tmpFile, JSON.stringify(items, null, 2), 'utf8', (err) => {
          if (err) return reject(err);
          fs.rename(tmpFile, DATA_FILE, (err2) => {
            if (err2) return reject(err2);
            resolve();
          });
        });
      })
  );
  return writeChain;
}

async function list({ type = 'all', search = '', page = 1, limit = 24 } = {}) {
  let items = readAll();

  if (type && type !== 'all') {
    items = items.filter((m) => m.type === type);
  }
  if (search) {
    const q = search.trim().toLowerCase();
    items = items.filter((m) => (m.title || '').toLowerCase().includes(q));
  }

  items.sort((a, b) => b.createdAt - a.createdAt);

  const total = items.length;
  const start = (page - 1) * limit;
  const pageItems = items.slice(start, start + limit);

  return {
    items: pageItems,
    total,
    page,
    limit,
    hasMore: start + pageItems.length < total,
  };
}

async function add(item) {
  const items = readAll();
  items.push(item);
  await writeAll(items);
  return item;
}

async function remove(id) {
  const items = readAll();
  const idx = items.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  const [removed] = items.splice(idx, 1);
  await writeAll(items);
  return removed;
}

async function get(id) {
  const items = readAll();
  return items.find((m) => m.id === id) || null;
}

module.exports = { list, add, remove, get };
