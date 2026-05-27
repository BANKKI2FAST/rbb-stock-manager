const STORAGE_KEY = "rbb-stock-manager-products-v1";
const STORAGE_VERSION_KEY = "rbb-stock-manager-seed-version";

const state = {
  products: [],
  category: "all",
  query: "",
  stockFilter: "all",
  sortBy: "name"
};

const els = {
  grid: document.querySelector("#productGrid"),
  nav: document.querySelector(".nav"),
  countAll: document.querySelector("#countAll"),
  statProducts: document.querySelector("#statProducts"),
  statQty: document.querySelector("#statQty"),
  statCost: document.querySelector("#statCost"),
  statSales: document.querySelector("#statSales"),
  search: document.querySelector("#searchInput"),
  stockFilter: document.querySelector("#stockFilter"),
  sortBy: document.querySelector("#sortBy"),
  addProductBtn: document.querySelector("#addProductBtn"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  exportCsvBtn: document.querySelector("#exportCsvBtn"),
  importFile: document.querySelector("#importFile"),
  dialog: document.querySelector("#productDialog"),
  form: document.querySelector("#productForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  deleteBtn: document.querySelector("#deleteBtn"),
  categoryList: document.querySelector("#categoryList")
};

const fields = [
  "productId",
  "name",
  "sku",
  "category",
  "brand",
  "costPrice",
  "sellPrice",
  "quantity",
  "lowStockAt",
  "size",
  "imageUrl",
  "notes"
].reduce((acc, id) => {
  acc[id] = document.querySelector(`#${id}`);
  return acc;
}, {});

fields.imageUpload = document.querySelector("#imageUpload");

function loadProducts() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
  const currentVersion = window.SEED_VERSION || "seed-v1";

  if (saved && savedVersion === currentVersion) {
    state.products = JSON.parse(saved);
    return;
  }

  const savedProducts = saved ? JSON.parse(saved) : [];
  const seedProducts = window.SEED_PRODUCTS.map((item) => ({
    ...item,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  const seen = new Set(seedProducts.map((product) => product.id));
  const customProducts = savedProducts.filter((product) => !seen.has(product.id) && !String(product.id || "").startsWith("csv-"));

  state.products = [...seedProducts, ...customProducts];
  saveProducts();
  localStorage.setItem(STORAGE_VERSION_KEY, currentVersion);
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.products));
  localStorage.setItem(STORAGE_VERSION_KEY, window.SEED_VERSION || "seed-v1");
}

function money(value) {
  if (value === "" || value === null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
}

function plainNumber(value) {
  if (value === "" || value === null || Number.isNaN(Number(value))) return "";
  return Number(value);
}

function stockStatus(product) {
  const qty = Number(product.quantity || 0);
  const low = Number(product.lowStockAt || 0);
  if (qty <= 0) return { key: "out", label: "หมด" };
  if (qty <= low) return { key: "low", label: "ใกล้หมด" };
  return { key: "in", label: "มีของ" };
}

function categories() {
  return [...new Set(state.products.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));
}

function renderNav() {
  const current = state.category;
  const items = categories()
    .map((category) => {
      const count = state.products.filter((product) => product.category === category).length;
      return `<button class="nav-item ${current === category ? "active" : ""}" data-category="${category}">${category}<span>${count}</span></button>`;
    })
    .join("");
  els.nav.innerHTML = `<button class="nav-item ${current === "all" ? "active" : ""}" data-category="all">ทั้งหมด <span id="countAll">${state.products.length}</span></button>${items}`;
  els.categoryList.innerHTML = categories().map((category) => `<option value="${category}"></option>`).join("");
}

function filteredProducts() {
  const query = state.query.trim().toLowerCase();
  const list = state.products.filter((product) => {
    const matchesCategory = state.category === "all" || product.category === state.category;
    const searchable = [product.name, product.sku, product.category, product.brand, product.size, product.notes].join(" ").toLowerCase();
    const matchesQuery = !query || searchable.includes(query);
    const status = stockStatus(product).key;
    const matchesStock = state.stockFilter === "all" || status === state.stockFilter;
    return matchesCategory && matchesQuery && matchesStock;
  });

  return list.sort((a, b) => {
    if (state.sortBy === "qty") return Number(a.quantity || 0) - Number(b.quantity || 0);
    if (state.sortBy === "sellPrice") return Number(b.sellPrice || 0) - Number(a.sellPrice || 0);
    if (state.sortBy === "updatedAt") return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    return a.name.localeCompare(b.name, "th");
  });
}

function renderStats() {
  const totalQty = state.products.reduce((sum, product) => sum + Number(product.quantity || 0), 0);
  const totalCost = state.products.reduce((sum, product) => sum + Number(product.costPrice || 0) * Number(product.quantity || 0), 0);
  const totalSales = state.products.reduce((sum, product) => sum + Number(product.sellPrice || 0) * Number(product.quantity || 0), 0);
  els.statProducts.textContent = state.products.length;
  els.statQty.textContent = totalQty;
  els.statCost.textContent = totalCost ? money(totalCost) : "-";
  els.statSales.textContent = totalSales ? money(totalSales) : "-";
}

function renderProducts() {
  const products = filteredProducts();
  if (!products.length) {
    els.grid.innerHTML = `<div class="empty-state">ไม่พบสินค้าตามเงื่อนไขที่เลือก</div>`;
    return;
  }

  els.grid.innerHTML = products
    .map((product) => {
      const status = stockStatus(product);
      const image = product.imageUrl
        ? `<img src="${product.imageUrl}" alt="${product.name}" loading="lazy" onerror="this.remove(); this.parentElement.textContent='ไม่มีรูปภาพ';" />`
        : "ไม่มีรูปภาพ";
      return `
        <article class="product-card" data-id="${product.id}">
          <div class="product-image">${image}</div>
          <div class="product-body">
            <div class="product-title">
              <h3>${escapeHtml(product.name)}</h3>
              <span class="badge ${status.key}">${status.label}</span>
            </div>
            <div class="product-meta">
              <span>SKU: ${escapeHtml(product.sku || "-")}</span>
              <span>หมวดหมู่: ${escapeHtml(product.category || "-")}</span>
              <span>แบรนด์: ${escapeHtml(product.brand || "-")}</span>
              <span>ขนาด: ${escapeHtml(product.size || "-")}</span>
            </div>
            <div class="price-row">
              <div><span>ต้นทุน</span><strong>${money(product.costPrice)}</strong></div>
              <div><span>ขาย</span><strong>${money(product.sellPrice)}</strong></div>
            </div>
            <div class="stock-row">
              <button data-action="decrease" aria-label="ลดจำนวน">−</button>
              <div class="qty-box"><span>คงเหลือ</span><strong>${Number(product.quantity || 0)}</strong></div>
              <button data-action="increase" aria-label="เพิ่มจำนวน">+</button>
              <button class="edit-btn" data-action="edit" aria-label="แก้ไข">แก้</button>
            </div>
            <p class="product-note">${escapeHtml(product.notes || "")}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function render() {
  renderNav();
  renderStats();
  renderProducts();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openForm(product = null) {
  els.form.reset();
  fields.imageUrl.value = "";
  fields.productId.value = product?.id || "";
  fields.name.value = product?.name || "";
  fields.sku.value = product?.sku || "";
  fields.category.value = product?.category || "";
  fields.brand.value = product?.brand || "";
  fields.costPrice.value = product?.costPrice ?? "";
  fields.sellPrice.value = product?.sellPrice ?? "";
  fields.quantity.value = product?.quantity ?? 0;
  fields.lowStockAt.value = product?.lowStockAt ?? 1;
  fields.size.value = product?.size || "";
  fields.imageUrl.value = product?.imageUrl || "";
  fields.notes.value = product?.notes || "";
  els.dialogTitle.textContent = product ? "แก้ไขสินค้า" : "เพิ่มสินค้า";
  els.deleteBtn.style.visibility = product ? "visible" : "hidden";
  els.dialog.showModal();
}

function formValue() {
  const id = fields.productId.value || `product-${Date.now()}`;
  return {
    id,
    name: fields.name.value.trim(),
    sku: fields.sku.value.trim(),
    category: fields.category.value.trim(),
    brand: fields.brand.value.trim(),
    costPrice: plainNumber(fields.costPrice.value),
    sellPrice: plainNumber(fields.sellPrice.value),
    quantity: Number(fields.quantity.value || 0),
    lowStockAt: Number(fields.lowStockAt.value || 0),
    size: fields.size.value.trim(),
    imageUrl: fields.imageUrl.value.trim(),
    notes: fields.notes.value.trim(),
    createdAt: state.products.find((product) => product.id === id)?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function adjustStock(id, delta) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  product.quantity = Math.max(0, Number(product.quantity || 0) + delta);
  product.updatedAt = new Date().toISOString();
  saveProducts();
  render();
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(products) {
  const headers = ["sku", "name", "category", "brand", "costPrice", "sellPrice", "quantity", "size", "notes", "imageUrl"];
  const rows = products.map((product) =>
    headers
      .map((header) => {
        const value = product[header] ?? "";
        return `"${String(value).replaceAll('"', '""')}"`;
      })
      .join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

els.nav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  render();
});

els.grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  const card = event.target.closest("[data-id]");
  if (!button || !card) return;
  const product = state.products.find((item) => item.id === card.dataset.id);
  if (button.dataset.action === "increase") adjustStock(card.dataset.id, 1);
  if (button.dataset.action === "decrease") adjustStock(card.dataset.id, -1);
  if (button.dataset.action === "edit") openForm(product);
});

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderProducts();
});

els.stockFilter.addEventListener("change", (event) => {
  state.stockFilter = event.target.value;
  renderProducts();
});

els.sortBy.addEventListener("change", (event) => {
  state.sortBy = event.target.value;
  renderProducts();
});

els.addProductBtn.addEventListener("click", () => openForm());

fields.imageUpload.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    fields.imageUrl.value = reader.result;
  };
  reader.readAsDataURL(file);
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const product = formValue();
  const existingIndex = state.products.findIndex((item) => item.id === product.id);
  if (existingIndex >= 0) state.products[existingIndex] = product;
  else state.products.unshift(product);
  saveProducts();
  els.dialog.close();
  render();
});

els.deleteBtn.addEventListener("click", () => {
  const id = fields.productId.value;
  if (!id) return;
  state.products = state.products.filter((product) => product.id !== id);
  saveProducts();
  els.dialog.close();
  render();
});

els.exportJsonBtn.addEventListener("click", () => {
  download("rbb-stock-products.json", JSON.stringify(state.products, null, 2), "application/json");
});

els.exportCsvBtn.addEventListener("click", () => {
  download("rbb-stock-products.csv", toCsv(state.products), "text/csv;charset=utf-8");
});

els.importFile.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = file.name.toLowerCase().endsWith(".csv") ? parseCsvProducts(reader.result) : JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("JSON must be an array");
      state.products = imported.map((product) => ({
        ...product,
        id: product.id || `product-${crypto.randomUUID()}`,
        updatedAt: new Date().toISOString()
      }));
      saveProducts();
      render();
    } catch (error) {
      alert("นำเข้าไม่สำเร็จ: ไฟล์ JSON ไม่ถูกต้อง");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
});

function parseCsvProducts(text) {
  const rows = parseCsv(text);
  const [headers, ...body] = rows.filter((row) => row.some((cell) => cell.trim()));
  if (!headers) return [];
  const index = Object.fromEntries(headers.map((header, i) => [header.trim(), i]));

  const get = (row, names) => {
    for (const name of names) {
      if (index[name] !== undefined) return (row[index[name]] || "").trim();
    }
    return "";
  };

  return body
    .map((row, rowIndex) => {
      const originalNo = get(row, ["เลขอ้างอิงเดิม", "ลำดับใหม่", "sku", "SKU"]);
      const name = get(row, ["ชื่อสินค้า", "name", "Name"]);
      const category = get(row, ["หมวดวัสดุ", "หมวดหมู่", "category", "Category"]);
      const price = parseThaiPrice(get(row, ["ราคา", "ราคาขาย", "sellPrice"]));
      const imageUrl = normalizeDriveImage(get(row, ["ลิงก์รูปอ้างอิง", "imageUrl", "รูปภาพ"]));
      const keywords = get(row, ["คำค้นจากภาพ"]);
      const imageDetail = get(row, ["รายละเอียดภาพ"]);
      const confidence = get(row, ["ความมั่นใจรูป"]);
      const notes = [keywords && `คำค้น: ${keywords}`, imageDetail, confidence].filter(Boolean).join(" / ");

      return {
        id: `csv-${slugify(originalNo || name || rowIndex + 1)}`,
        sku: originalNo ? `CSV-${originalNo}` : "",
        name,
        category,
        brand: "",
        costPrice: "",
        sellPrice: price,
        quantity: 0,
        lowStockAt: 1,
        size: get(row, ["ขนาด", "size", "Size"]),
        imageUrl,
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    })
    .filter((product) => product.name);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function parseThaiPrice(value) {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  return cleaned ? Number(cleaned) : "";
}

function normalizeDriveImage(value) {
  const url = String(value || "").trim();
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) return `https://drive.google.com/thumbnail?id=${fileMatch[1]}&sz=w900`;
  return url;
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/gi, "-")
    .replace(/^-+|-+$/g, "") || Date.now();
}

loadProducts();
render();
