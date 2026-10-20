const STORAGE_KEYS = {
  products: "ebano-stylo-products",
  sections: "ebano-stylo-sections",
  settings: "ebano-stylo-settings",
  cart: "ebano-stylo-cart",
};

const initialSections = ["Sillones", "Sillas", "Mesas"];
const initialProducts = [
  { id: "sillon-nube", name: "Sillón Nube", section: "Sillones", description: "Bouclé suave · tono marfil", price: 485000, previousPrice: 560000, showPrice: true, image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=82", tag: "Favorito" },
  { id: "sillon-oliva", name: "Sillón Oliva", section: "Sillones", description: "Lino natural · madera maciza", price: 529000, previousPrice: null, showPrice: true, image: "https://images.unsplash.com/photo-1598300056393-4aac492f4344?auto=format&fit=crop&w=900&q=82", tag: "" },
  { id: "sillon-luna", name: "Sillón Luna", section: "Sillones", description: "Diseño envolvente · verde salvia", price: 398000, previousPrice: null, showPrice: false, image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=82&sat=-25", tag: "Nuevo" },
  { id: "silla-nordica", name: "Silla Nórdica", section: "Sillas", description: "Roble claro · asiento tapizado", price: 128000, previousPrice: null, showPrice: true, image: "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=82", tag: "" },
  { id: "mesa-roble", name: "Mesa Roble", section: "Mesas", description: "Madera maciza · 140 cm", price: 375000, previousPrice: 420000, showPrice: true, image: "https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?auto=format&fit=crop&w=900&q=82", tag: "" },
  { id: "sillon-terracota", name: "Sillón Terracota", section: "Sillones", description: "Tejido artesanal · patas de haya", price: 445000, previousPrice: null, showPrice: true, image: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=82&hue=15", tag: "" },
];

function load(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

let products = load(STORAGE_KEYS.products, initialProducts);
let sections = load(STORAGE_KEYS.sections, initialSections);
let settings = load(STORAGE_KEYS.settings, { whatsapp: "" });
let cart = load(STORAGE_KEYS.cart, []);
let activeSection = "Todos";
let activeAdminTab = "products";
let editingProductId = null;
let draftImages = [];
let detailImages = [];
let detailImageIndex = 0;
let detailProductId = null;
let toastTimeout;

const productGrid = document.querySelector("#product-grid");
const categoryList = document.querySelector("#category-list");
const searchInput = document.querySelector("#search-input");
const overlay = document.querySelector("#overlay");
const cartDrawer = document.querySelector("#cart-drawer");
const detailModal = document.querySelector("#product-detail-modal");
const loginModal = document.querySelector("#login-modal");
const adminModal = document.querySelector("#admin-modal");
const adminContent = document.querySelector("#admin-content");
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";
const ADMIN_SESSION_KEY = "ebano-stylo-admin-session";

function persist() {
  try {
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
    localStorage.setItem(STORAGE_KEYS.sections, JSON.stringify(sections));
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart));
    return true;
  } catch {
    showToast("No se pudo guardar. Probá con menos fotos o imágenes más livianas.");
    return false;
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function money(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function getProductImages(product) {
  const images = Array.isArray(product.images) ? product.images : [];
  return [...new Set([...images, product.image].filter(Boolean))];
}

function renderImagePreviews() {
  const previews = document.querySelector("#image-previews");
  if (!previews) return;
  previews.innerHTML = draftImages.map((image, index) => `<div class="image-preview"><img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.name || `Foto ${index + 1}`)}" /><button type="button" data-remove-image="${index}" aria-label="Quitar foto ${index + 1}">×</button></div>`).join("");
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("El archivo no es una imagen");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No se pudo procesar la foto")), "image/jpeg", 0.78));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ src: reader.result, name: file.name });
    reader.onerror = () => reject(new Error("No se pudo leer la foto"));
    reader.readAsDataURL(blob);
  });
}

async function addImageFiles(fileList) {
  const files = Array.from(fileList);
  const availableSlots = 5 - draftImages.length;
  if (files.length > availableSlots) showToast("Podés agregar hasta 5 fotos por producto");
  for (const file of files.slice(0, availableSlots)) {
    try {
      draftImages.push(await compressImage(file));
    } catch {
      showToast(`No se pudo cargar ${file.name}`);
    }
  }
  renderImagePreviews();
}

function showProductDetail(productId) {
  const product = products.find((entry) => entry.id === productId);
  if (!product) return;
  detailProductId = productId;
  detailImages = getProductImages(product);
  detailImageIndex = 0;
  document.querySelector("#detail-section").textContent = product.section;
  document.querySelector("#detail-title").textContent = product.name;
  document.querySelector("#detail-price").innerHTML = product.showPrice
    ? `${product.previousPrice && product.previousPrice > product.price ? `<del>${money(product.previousPrice)}</del>` : ""}${money(product.price)}`
    : "Precio a consultar";
  document.querySelector("#detail-description").textContent = product.description || "";
  const specifications = document.querySelector("#detail-specifications");
  specifications.hidden = !product.details;
  specifications.innerHTML = product.details ? `<strong>Detalles</strong>${escapeHtml(product.details)}` : "";
  document.querySelector("#detail-add").disabled = false;
  renderDetailGallery();
  openLayer("detail");
}

function renderDetailGallery() {
  const mainImage = document.querySelector("#detail-main-image");
  mainImage.src = detailImages[detailImageIndex] || "";
  mainImage.alt = `${document.querySelector("#detail-title").textContent} · foto ${detailImageIndex + 1}`;
  document.querySelector("#detail-thumbnails").innerHTML = detailImages.map((src, index) => `<button class="detail-thumbnail ${index === detailImageIndex ? "is-active" : ""}" data-gallery-image="${index}" aria-label="Ver foto ${index + 1}"><img src="${escapeHtml(src)}" alt="" /></button>`).join("");
  document.querySelectorAll("[data-gallery-step]").forEach((button) => { button.hidden = detailImages.length < 2; });
}

function changeDetailImage(index) {
  if (!detailImages.length) return;
  detailImageIndex = (index + detailImages.length) % detailImages.length;
  renderDetailGallery();
}

function renderCategories() {
  const categories = ["Todos", ...sections];
  categoryList.innerHTML = categories.map((section) => `<button class="category-button ${activeSection === section ? "is-active" : ""}" data-section="${escapeHtml(section)}">${escapeHtml(section)}</button>`).join("");
}

function renderProducts() {
  const term = searchInput.value.trim().toLocaleLowerCase("es");
  const visibleProducts = products.filter((product) => {
    const matchesSection = activeSection === "Todos" || product.section === activeSection;
    const matchesTerm = `${product.name} ${product.section} ${product.description}`.toLocaleLowerCase("es").includes(term);
    return matchesSection && matchesTerm;
  });

  productGrid.innerHTML = visibleProducts.map((product, index) => {
    const discount = product.previousPrice && product.previousPrice > product.price
      ? Math.round((1 - product.price / product.previousPrice) * 100)
      : 0;
    const image = getProductImages(product)[0] || "";
    const imageLayout = ["landscape", "square", "portrait"].includes(product.imageLayout) ? product.imageLayout : "standard";
    return `<article class="product-card" style="animation-delay:${Math.min(index * 55, 220)}ms">
      <div class="product-image-wrap ${imageLayout === "standard" ? "" : `image-layout-${imageLayout}`}">
        <img class="product-image" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" />
        ${product.tag ? `<span class="product-tag">${escapeHtml(product.tag)}</span>` : ""}
        ${discount ? `<span class="discount-tag">-${discount}%</span>` : ""}
      </div>
      <div class="product-info"><div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.description)}</p></div>
        <div class="price-block">${product.showPrice ? `${product.previousPrice ? `<span class="price-old">${money(product.previousPrice)}</span>` : ""}<span class="price-current">${money(product.price)}</span>` : `<span class="price-hidden">Consultar</span>`}</div>
      </div>
      <div class="product-actions"><button data-product-detail="${escapeHtml(product.id)}">Ver detalle ↗</button><button class="add-button" data-add="${escapeHtml(product.id)}">Agregar +</button></div>
    </article>`;
  }).join("");
  document.querySelector("#empty-state").hidden = visibleProducts.length !== 0;
}

function renderCart() {
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelector("#cart-count").textContent = itemCount;
  const itemsElement = document.querySelector("#cart-items");
  itemsElement.innerHTML = cart.map((item) => {
    const product = products.find((entry) => entry.id === item.id);
    if (!product) return "";
    return `<article class="cart-item"><img src="${escapeHtml(product.image)}" alt="" /><div><h3>${escapeHtml(product.name)}</h3><small>${product.showPrice ? money(product.price) : "Precio a consultar"}</small><div class="quantity-control"><button data-quantity="${escapeHtml(product.id)}" data-change="-1" aria-label="Quitar una unidad">−</button><span>${item.quantity}</span><button data-quantity="${escapeHtml(product.id)}" data-change="1" aria-label="Agregar una unidad">+</button></div></div><button class="remove-item" data-remove="${escapeHtml(product.id)}" aria-label="Quitar ${escapeHtml(product.name)}">×</button></article>`;
  }).join("");
  const empty = cart.length === 0;
  document.querySelector("#cart-empty").hidden = !empty;
  document.querySelector("#cart-footer").hidden = empty;
  const total = cart.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.id);
    return sum + (product?.showPrice ? product.price * item.quantity : 0);
  }, 0);
  document.querySelector("#cart-total").textContent = money(total);
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("is-visible"), 2500);
}

function openLayer(layer) {
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("is-visible"));
  if (layer === "cart") {
    cartDrawer.classList.add("is-open");
    cartDrawer.setAttribute("aria-hidden", "false");
  } else if (layer === "detail") {
    detailModal.hidden = false;
  } else if (layer === "login") {
    adminModal.hidden = true;
    loginModal.hidden = false;
  } else {
    loginModal.hidden = true;
    adminModal.hidden = false;
  }
  document.body.style.overflow = "hidden";
}

function closeLayers() {
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
  detailModal.hidden = true;
  loginModal.hidden = true;
  adminModal.hidden = true;
  overlay.classList.remove("is-visible");
  overlay.hidden = true;
  document.body.style.overflow = "";
}

function renderAdmin() {
  document.querySelectorAll(".admin-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === activeAdminTab));
  if (activeAdminTab === "products") renderAdminProducts();
  if (activeAdminTab === "sections") renderAdminSections();
  if (activeAdminTab === "settings") renderAdminSettings();
}

function renderAdminProducts() {
  const productRows = products.map((product) => `<div class="admin-row"><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.section)} · ${product.showPrice ? money(product.price) : "Precio oculto"}</small></div><div class="admin-row-actions"><button class="small-button" data-edit="${escapeHtml(product.id)}">Editar</button><button class="small-button danger" data-delete="${escapeHtml(product.id)}">Eliminar</button></div></div>`).join("");
  const current = products.find((product) => product.id === editingProductId);
  draftImages = current ? getProductImages(current).map((src) => ({ src, name: "Foto existente" })) : [];
  adminContent.innerHTML = `<div>${productRows || `<p class="empty-state">Todavía no hay productos.</p>`}</div>
    <form class="admin-form" id="product-form">
      <h3>${current ? "Editar producto" : "Agregar producto"}</h3>
      <label class="form-field">Nombre<input name="name" required value="${escapeHtml(current?.name || "")}" placeholder="Ej. Sillón Nube" /></label>
      <label class="form-field">Sección<select name="section" required>${sections.map((section) => `<option ${current?.section === section ? "selected" : ""}>${escapeHtml(section)}</option>`).join("")}</select></label>
      <label class="form-field">Precio actual (ARS)<input name="price" type="number" min="0" step="1000" value="${current?.price ?? ""}" placeholder="485000" /></label>
      <label class="form-field">Precio anterior (opcional)<input name="previousPrice" type="number" min="0" step="1000" value="${current?.previousPrice ?? ""}" placeholder="560000" /></label>
      <label class="form-field">Formato de imagen<select name="imageLayout"><option value="standard" ${!current?.imageLayout || current.imageLayout === "standard" ? "selected" : ""}>Estándar</option><option value="landscape" ${current?.imageLayout === "landscape" ? "selected" : ""}>Horizontal</option><option value="square" ${current?.imageLayout === "square" ? "selected" : ""}>Cuadrada</option><option value="portrait" ${current?.imageLayout === "portrait" ? "selected" : ""}>Vertical</option></select></label>
      <label class="form-field form-wide">Descripción breve<input name="description" value="${escapeHtml(current?.description || "")}" placeholder="Materiales, color o medidas" /></label>
      <label class="form-field form-wide">Detalles del producto<textarea name="details" placeholder="Medidas, materiales, colores disponibles y cuidados">${escapeHtml(current?.details || "")}</textarea></label>
      <div class="form-field form-wide"><span>Fotos del producto (hasta 5)</span><div class="image-dropzone" id="image-dropzone"><span class="upload-icon" aria-hidden="true">↑</span><strong>Arrastrá las fotos acá</strong><small>o elegilas desde tu dispositivo · JPG, PNG o WEBP</small><button class="small-button" id="choose-images" type="button">Elegir fotos</button><input id="product-images" type="file" accept="image/*" multiple hidden /></div><div class="image-previews" id="image-previews"></div></div>
      <label class="form-field">Etiqueta (opcional)<input name="tag" value="${escapeHtml(current?.tag || "")}" placeholder="Nuevo / Favorito" /></label>
      <label class="check-field"><input name="showPrice" type="checkbox" ${current?.showPrice !== false ? "checked" : ""} /> Mostrar precio</label>
      <button class="button button-dark" type="submit">${current ? "Guardar cambios" : "Agregar al catálogo"}</button>
      ${current ? `<button class="small-button" type="button" data-cancel-edit>Cancelar edición</button>` : ""}
    </form>`;
  renderImagePreviews();
}

function renderAdminSections() {
  adminContent.innerHTML = `<form class="section-create" id="section-form"><input name="section" required placeholder="Nombre de la nueva sección" aria-label="Nombre de la nueva sección" /><button class="button button-dark" type="submit">Crear sección +</button></form>
    ${sections.map((section) => `<div class="admin-row"><div><strong>${escapeHtml(section)}</strong><small>${products.filter((product) => product.section === section).length} productos</small></div><div class="admin-row-actions"><button class="small-button danger" data-delete-section="${escapeHtml(section)}">Eliminar</button></div></div>`).join("")}`;
}

function renderAdminSettings() {
  adminContent.innerHTML = `<form class="admin-form" id="settings-form"><h3>Canal de consultas</h3><label class="form-field form-wide">WhatsApp con código de país<input name="whatsapp" inputmode="numeric" value="${escapeHtml(settings.whatsapp)}" placeholder="5491123456789" /></label><p class="form-wide" style="margin:0;color:#7b8580;font-size:10px;line-height:1.6">Ingresalo solo con números, incluyendo el código de país y área. Ejemplo de formato: 54911…</p><button class="button button-dark" type="submit">Guardar contacto</button></form>`;
}

function addToCart(productId) {
  const item = cart.find((entry) => entry.id === productId);
  if (item) item.quantity += 1;
  else cart.push({ id: productId, quantity: 1 });
  persist();
  renderCart();
  showToast("Agregado a tu selección");
}

function checkout() {
  const phone = String(settings.whatsapp || "").replace(/\D/g, "");
  if (!phone) {
    showToast("Configurá el WhatsApp desde Administrar → Contacto");
    return;
  }
  const lines = cart.map((item) => {
    const product = products.find((entry) => entry.id === item.id);
    return product ? `• ${product.name} x${item.quantity}${product.showPrice ? ` — ${money(product.price * item.quantity)}` : " — consultar precio"}` : "";
  }).filter(Boolean);
  const total = cart.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.id);
    return sum + (product?.showPrice ? product.price * item.quantity : 0);
  }, 0);
  const message = `Hola, Ébano Stylo. Quisiera consultar por:\n${lines.join("\n")}\n\nTotal estimado: ${money(total)}. ¿Me cuentan disponibilidad y opciones?`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

document.addEventListener("click", (event) => {
  const sectionButton = event.target.closest("[data-section]");
  if (sectionButton) {
    activeSection = sectionButton.dataset.section;
    renderCategories();
    renderProducts();
  }
  const addButton = event.target.closest("[data-add]");
  if (addButton) addToCart(addButton.dataset.add);
  const detailButton = event.target.closest("[data-product-detail]");
  if (detailButton) showProductDetail(detailButton.dataset.productDetail);
  const galleryButton = event.target.closest("[data-gallery-image]");
  if (galleryButton) changeDetailImage(Number(galleryButton.dataset.galleryImage));
  const galleryArrow = event.target.closest("[data-gallery-step]");
  if (galleryArrow) changeDetailImage(detailImageIndex + Number(galleryArrow.dataset.galleryStep));
  if (event.target.closest("[data-close-modal]")) closeLayers();
  if (event.target.closest("#detail-add") && detailProductId) {
    addToCart(detailProductId);
    closeLayers();
    openLayer("cart");
  }
  if (event.target.closest("#choose-images")) document.querySelector("#product-images").click();
  const removeImageButton = event.target.closest("[data-remove-image]");
  if (removeImageButton) {
    draftImages.splice(Number(removeImageButton.dataset.removeImage), 1);
    renderImagePreviews();
  }
  const quantityButton = event.target.closest("[data-quantity]");
  if (quantityButton) {
    const item = cart.find((entry) => entry.id === quantityButton.dataset.quantity);
    if (item) item.quantity += Number(quantityButton.dataset.change);
    cart = cart.filter((entry) => entry.quantity > 0);
    persist();
    renderCart();
  }
  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    cart = cart.filter((entry) => entry.id !== removeButton.dataset.remove);
    persist();
    renderCart();
  }
  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    editingProductId = editButton.dataset.edit;
    renderAdminProducts();
    adminContent.querySelector("#product-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    products = products.filter((product) => product.id !== deleteButton.dataset.delete);
    cart = cart.filter((item) => item.id !== deleteButton.dataset.delete);
    persist();
    renderAdminProducts();
    renderProducts();
    renderCart();
  }
  const deleteSectionButton = event.target.closest("[data-delete-section]");
  if (deleteSectionButton) {
    const section = deleteSectionButton.dataset.deleteSection;
    if (products.some((product) => product.section === section)) {
      showToast("Mové o eliminá primero los productos de esta sección");
    } else {
      sections = sections.filter((entry) => entry !== section);
      if (activeSection === section) activeSection = "Todos";
      persist();
      renderAdminSections();
      renderCategories();
    }
  }
  const cancelEdit = event.target.closest("[data-cancel-edit]");
  if (cancelEdit) {
    editingProductId = null;
    renderAdminProducts();
  }
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    activeAdminTab = tab.dataset.tab;
    editingProductId = null;
    renderAdmin();
  }
  if (event.target.closest("[data-close-drawer]")) closeLayers();
});

searchInput.addEventListener("input", renderProducts);
adminContent.addEventListener("change", (event) => {
  if (event.target.id === "product-images") {
    addImageFiles(event.target.files);
    event.target.value = "";
  }
});
adminContent.addEventListener("dragover", (event) => {
  const dropzone = event.target.closest("#image-dropzone");
  if (!dropzone) return;
  event.preventDefault();
  dropzone.classList.add("is-dragging");
});
adminContent.addEventListener("dragleave", (event) => {
  const dropzone = event.target.closest("#image-dropzone");
  if (dropzone && !dropzone.contains(event.relatedTarget)) dropzone.classList.remove("is-dragging");
});
adminContent.addEventListener("drop", (event) => {
  const dropzone = event.target.closest("#image-dropzone");
  if (!dropzone) return;
  event.preventDefault();
  dropzone.classList.remove("is-dragging");
  addImageFiles(event.dataTransfer.files);
});
document.querySelector("#cart-open").addEventListener("click", () => {
  renderCart();
  openLayer("cart");
});
document.querySelector("#admin-open").addEventListener("click", () => {
  activeAdminTab = "products";
  editingProductId = null;
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "active") {
    renderAdmin();
    openLayer("admin");
  } else {
    document.querySelector("#login-form").reset();
    document.querySelector("#login-error").hidden = true;
    openLayer("login");
  }
});
document.querySelector("#login-close").addEventListener("click", closeLayers);
document.querySelector("#admin-close").addEventListener("click", closeLayers);
document.querySelector("#admin-logout").addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  document.querySelector("#login-form").reset();
  document.querySelector("#login-error").hidden = true;
  openLayer("login");
});
document.querySelector("#login-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  if (formData.get("username") === ADMIN_USERNAME && formData.get("password") === ADMIN_PASSWORD) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "active");
    renderAdmin();
    openLayer("admin");
  } else {
    document.querySelector("#login-error").hidden = false;
  }
});
document.querySelector("#whatsapp-button").addEventListener("click", checkout);
overlay.addEventListener("click", closeLayers);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeLayers();
});

adminContent.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  if (event.target.id === "product-form") {
    if (!draftImages.length) {
      showToast("Agregá al menos una foto del producto");
      return;
    }
    const price = Number(formData.get("price")) || 0;
    const previousPrice = Number(formData.get("previousPrice")) || null;
    const values = {
      name: String(formData.get("name")).trim(),
      section: String(formData.get("section")),
      imageLayout: String(formData.get("imageLayout")),
      description: String(formData.get("description")).trim(),
      details: String(formData.get("details")).trim(),
      price,
      previousPrice,
      showPrice: formData.has("showPrice"),
      images: draftImages.map((image) => image.src),
      image: draftImages[0].src,
      tag: String(formData.get("tag")).trim(),
    };
    if (editingProductId) {
      products = products.map((product) => product.id === editingProductId ? { ...product, ...values } : product);
      editingProductId = null;
    } else {
      products.unshift({ id: `product-${Date.now()}`, ...values });
    }
    persist();
    renderAdminProducts();
    renderProducts();
    showToast("Catálogo actualizado");
  }
  if (event.target.id === "section-form") {
    const section = String(formData.get("section")).trim();
    if (section && !sections.some((entry) => entry.toLocaleLowerCase("es") === section.toLocaleLowerCase("es"))) {
      sections.push(section);
      persist();
      renderAdminSections();
      renderCategories();
      showToast("Sección creada");
    }
  }
  if (event.target.id === "settings-form") {
    settings = { ...settings, whatsapp: String(formData.get("whatsapp")).replace(/\D/g, "") };
    persist();
    showToast("Contacto guardado");
  }
});

renderCategories();
renderProducts();
renderCart();