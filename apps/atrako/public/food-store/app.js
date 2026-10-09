const slug = window.FOOD_SLUG || location.pathname.split("/").filter(Boolean).pop();
const money = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let menu = null;
let items = [];
const lines = new Map();
let activeProduct = null;
let detailQuantity = 1;
let checkoutDiscount = null;

try {
  const saved = JSON.parse(localStorage.getItem("lepido-lines-v2") || "[]");
  if (Array.isArray(saved)) saved.forEach((line) => lines.set(line.key, line));
} catch {}

function itemByKey(key) {
  return items.find((item) => item.key === key);
}
function itemById(id) {
  return items.find((item) => item.id === id);
}

function productTemplate(item) {
  const hidden = item.available ? "" : "is-hidden";
  return `<article class="product-card ${hidden}" data-available="${item.available ? "1" : "0"}" data-category="${item.category}" data-product-id="${item.key}" tabindex="0" role="button" aria-label="Ver detalhes de ${item.name}">
    <div class="product-visual">
      ${item.badge ? `<span class="product-badge">${item.badge}</span>` : ""}
      ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" loading="lazy" decoding="async" />` : `<span>${item.emoji || ""}</span>`}
    </div>
    <div class="product-info">
      <h3>${item.name}</h3><p>${item.description || ""}</p>
      <div class="product-price"><strong>${item.available ? money(item.priceCents) : "Indisponível"}</strong>${item.available ? `<button class="add-button" data-id="${item.key}" aria-label="Adicionar ${item.name}">+</button>` : ""}</div>
    </div>
  </article>`;
}

function drinkTemplate(item) {
  return `<article class="drink-card"><span class="drink-card__icon" aria-hidden="true">${item.emoji || ""}</span><div class="drink-card__copy"><h3>${item.name}</h3><p>${item.description || ""}</p></div><strong>${item.available ? money(item.priceCents) : "—"}</strong>${item.available ? `<button class="add-button" data-id="${item.key}" aria-label="Adicionar ${item.name}">+</button>` : ""}</article>`;
}

function feeCents() {
  const pickup = document.querySelector('[name="fulfillment"]:checked')?.value === "pickup";
  if (!menu) return pickup ? 0 : 500;
  return pickup || !menu.deliveryEnabled ? 0 : menu.deliveryFeeCents;
}

function cartSubtotal() {
  let total = 0;
  lines.forEach((line) => {
    const item = itemById(line.itemId);
    if (item) total += item.priceCents * line.quantity;
  });
  return total;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function updateCart() {
  let count = 0;
  lines.forEach((line) => { count += line.quantity; });
  const subtotal = cartSubtotal();
  const fee = feeCents();
  $("#cartCount").textContent = count;
  $("#cartTotal").textContent = money(subtotal);
  $("#subtotal").textContent = money(subtotal);
  $("#grandTotal").textContent = money(subtotal + fee);
  const feeLabel = document.querySelector(".cart-summary div:nth-child(2) strong");
  if (feeLabel) feeLabel.textContent = fee ? money(fee) : "Grátis";
  document.body.classList.toggle("has-cart", count > 0);
  try { localStorage.setItem("lepido-lines-v2", JSON.stringify([...lines.values()])); } catch {}
  $("#cartItems").innerHTML = count ? [...lines.values()].map((line) => {
    const item = itemById(line.itemId);
    if (!item) return "";
    const extra = line.removals?.length ? `<small>Sem ${line.removals.join(", ")}</small>` : "";
    return `<div class="cart-item"><span class="cart-item__emoji">${item.imageUrl ? `<img src="${item.imageUrl}" alt="" />` : item.emoji || ""}</span><div class="cart-item__copy"><strong>${item.name}</strong><span>${money(item.priceCents)}</span>${extra}</div><div class="quantity"><button data-action="minus" data-key="${line.key}" aria-label="Remover uma unidade">−</button><span>${line.quantity}</span><button data-action="plus" data-key="${line.key}" aria-label="Adicionar uma unidade">+</button></div></div>`;
  }).join("") : "<p>Seu carrinho está vazio.</p>";
}

function addLine(item, quantity, removals = [], notes = "") {
  if (!item?.available) {
    showToast("Este item está indisponível.");
    return;
  }
  const key = `${item.id}|${[...removals].sort().join(",")}|${notes}`;
  const current = lines.get(key);
  lines.set(key, {
    key,
    itemId: item.id,
    quantity: (current?.quantity || 0) + quantity,
    removals,
    notes,
  });
  updateCart();
  showToast(`${item.name} foi devorado!`);
}

let isEntering = false;
function enterMenu(skip = false) {
  const intro = $("#intro");
  if (!intro || isEntering) return;
  isEntering = true;
  if (skip || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    $("#introLoopVideo")?.pause();
    $("#introOpenVideo")?.pause();
    intro.classList.add("is-hidden");
    document.body.classList.remove("intro-open");
    $("#menu").focus({ preventScroll: true });
    return;
  }
  const loopVideo = $("#introLoopVideo");
  const openVideo = $("#introOpenVideo");
  const character = $("#introCharacter");
  const syncDelay = 1100;
  loopVideo?.pause();
  if (openVideo) {
    openVideo.currentTime = 0;
    character.classList.add("is-opening");
    openVideo.play().catch(() => {});
  }
  setTimeout(() => intro.classList.add("is-entering"), syncDelay);
  setTimeout(() => $("#mouthTransition").classList.add("is-active"), syncDelay + 520);
  setTimeout(() => {
    openVideo?.pause();
    intro.classList.add("is-hidden");
    document.body.classList.remove("intro-open");
    $("#menu").focus({ preventScroll: true });
  }, syncDelay + 1160);
}

$("#enterMenu")?.addEventListener("click", () => enterMenu(false));
$("#skipIntro")?.addEventListener("click", () => enterMenu(true));

document.addEventListener("click", (event) => {
  const add = event.target.closest("[data-id].add-button, .quick-add[data-id]");
  if (add) {
    const item = itemByKey(add.dataset.id);
    if (item) addLine(item, 1);
  }
  const card = event.target.closest(".product-card[data-product-id]");
  if (card && !add) location.hash = `produto/${card.dataset.productId}`;
  const quantity = event.target.closest(".quantity button");
  if (quantity) {
    const line = lines.get(quantity.dataset.key);
    if (!line) return;
    const next = line.quantity + (quantity.dataset.action === "plus" ? 1 : -1);
    if (next <= 0) lines.delete(line.key);
    else lines.set(line.key, { ...line, quantity: next });
    updateCart();
    if ($("#checkoutPage").classList.contains("is-open")) renderCheckout();
  }
});

$$(".category").forEach((button) => button.addEventListener("click", () => {
  $$(".category").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  const category = button.dataset.category;
  $$(".product-card").forEach((card) => {
    const unavailable = card.dataset.available === "0";
    card.classList.toggle("is-hidden", unavailable || (category !== "todos" && card.dataset.category !== category));
  });
  if (category === "bebidas") $("#drinksTitle")?.scrollIntoView({ behavior: "smooth", block: "center" });
}));

$("#showAll")?.addEventListener("click", () => {
  $$(".product-card").forEach((card) => card.classList.toggle("is-hidden", card.dataset.available === "0"));
  $$(".category").forEach((item) => item.classList.toggle("active", item.dataset.category === "todos"));
});

function toggleHelper(force) {
  const bubble = $("#helperBubble");
  bubble.classList.toggle("is-visible", force ?? !bubble.classList.contains("is-visible"));
}
$("#mascotHelper")?.addEventListener("click", () => toggleHelper());
$("#helperBubble button")?.addEventListener("click", () => toggleHelper(false));

function toggleCart(open) {
  $("#cartSheet").classList.toggle("is-open", open);
  $("#cartOverlay").classList.toggle("is-open", open);
  $("#cartSheet").setAttribute("aria-hidden", String(!open));
  $("#cartBar").setAttribute("aria-expanded", String(open));
}
$("#cartBar")?.addEventListener("click", () => toggleCart(true));
$("#closeCart")?.addEventListener("click", () => toggleCart(false));
$("#cartOverlay")?.addEventListener("click", () => toggleCart(false));
$("#checkout")?.addEventListener("click", () => {
  if (!lines.size) { showToast("Adicione um item antes de continuar."); return; }
  toggleCart(false);
  location.hash = "checkout";
});

function updateDetailTotal() {
  if (!activeProduct) return;
  $("#detailQuantity").textContent = detailQuantity;
  $("#detailTotal").textContent = money(activeProduct.priceCents * detailQuantity);
  $("#detailMinus").disabled = detailQuantity === 1;
}

function openProduct(item) {
  activeProduct = item;
  detailQuantity = 1;
  if (item.imageUrl) {
    $("#detailImage").src = item.imageUrl;
    $("#detailImage").alt = item.name;
  }
  $("#detailName").textContent = item.name;
  $("#detailPrice").textContent = money(item.priceCents);
  $("#detailDescription").textContent = item.description || "";
  $("#detailCalories").textContent = item.calories || "—";
  $("#detailCategory").textContent = item.category === "doces" ? "SOBREMESA" : item.category === "combos" ? "ACOMPANHAMENTO" : item.category === "bebidas" ? "BEBIDA" : "BURGER";
  $("#detailBadge").textContent = item.badge || "FEITO NA HORA";
  const ingredients = item.ingredients || [];
  $("#detailIngredients").innerHTML = ingredients.map((ingredient, index) => `<span><i>${index + 1}</i>${ingredient}</span>`).join("");
  $("#detailRemovals").innerHTML = ingredients.map((ingredient) => `<label><input type="checkbox" value="${ingredient}" /><span><i></i>${ingredient}</span></label>`).join("");
  $("#detailAllergens").innerHTML = item.allergens ? `<span aria-hidden="true">ⓘ</span><p><strong>Alergênicos</strong>${item.allergens}</p>` : "";
  $("#detailNotes").value = "";
  $("#notesCount").textContent = "0";
  $("#detailAdd").disabled = !item.available;
  updateDetailTotal();
  $("#productPage").classList.add("is-open");
  $("#productPage").setAttribute("aria-hidden", "false");
  document.body.classList.add("detail-open");
  $("#closeProduct").focus({ preventScroll: true });
}

function closeProduct() {
  $("#productPage").classList.remove("is-open");
  $("#productPage").setAttribute("aria-hidden", "true");
  document.body.classList.remove("detail-open");
  activeProduct = null;
}

function routeProduct() {
  const match = location.hash.match(/^#produto\/([a-z0-9-]+)$/);
  if (!match) { closeProduct(); return; }
  const item = itemByKey(match[1]);
  if (!item) { closeProduct(); return; }
  if (!$("#intro").classList.contains("is-hidden")) enterMenu(true);
  openProduct(item);
}

function renderCheckout() {
  const subtotal = cartSubtotal();
  const fee = feeCents();
  const discount = checkoutDiscount?.discountCents || 0;
  const total = checkoutDiscount?.totalCents ?? subtotal + fee;
  $("#checkoutItems").innerHTML = [...lines.values()].map((line) => {
    const item = itemById(line.itemId);
    if (!item) return "";
    const note = line.removals?.length ? `sem ${line.removals.join(", ")}` : "";
    return `<div class="checkout-item"><span>${item.imageUrl ? `<img src="${item.imageUrl}" alt="" />` : item.emoji || ""}</span><div><strong>${line.quantity}x ${item.name}</strong><small>${money(item.priceCents)} cada ${note}</small></div><b>${money(item.priceCents * line.quantity)}</b></div>`;
  }).join("");
  $("#checkoutSubtotal").textContent = money(subtotal);
  $("#checkoutDelivery").textContent = fee ? money(fee) : "Grátis";
  $("#checkoutDiscount").textContent = `− ${money(discount)}`;
  $("#discountRow").classList.toggle("is-visible", discount > 0);
  $("#checkoutGrandTotal").textContent = money(total);
  $("#placeOrderTotal").textContent = money(total);
}

function requestId() {
  let id = sessionStorage.getItem("food-request-id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("food-request-id", id);
  }
  return id;
}

function checkoutPayload(preview) {
  const pickup = document.querySelector('[name="fulfillment"]:checked')?.value === "pickup";
  const payment = document.querySelector('[name="payment"]:checked')?.value || "pix";
  return {
    preview,
    clientRequestId: requestId(),
    fulfillment: pickup ? "PICKUP" : "DELIVERY",
    paymentMethod: payment,
    customerName: $("#checkoutName").value,
    phone: $("#checkoutPhone").value,
    couponCode: $("#couponInput").value,
    changeForCents: (() => {
      const raw = ($("#checkoutChange")?.value || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
    })(),
    address: {
      cep: $("#checkoutCep").value,
      street: $("#checkoutStreet").value,
      number: $("#checkoutNumber").value,
      complement: $("#checkoutComplement").value,
      neighborhood: $("#checkoutNeighborhood").value,
    },
    items: [...lines.values()].map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      removals: line.removals,
      notes: line.notes,
    })),
  };
}

async function refreshQuote() {
  if (!lines.size) return;
  const res = await fetch(`/api/atrako/food/public/${slug}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkoutPayload(true)),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    checkoutDiscount = null;
    renderCheckout();
    if ($("#couponInput").value.trim()) showToast(data.error || "Não foi possível calcular o pedido.");
    return;
  }
  checkoutDiscount = data;
  renderCheckout();
}

function openCheckout() {
  if (!lines.size) { location.hash = ""; return; }
  if (!$("#intro").classList.contains("is-hidden")) enterMenu(true);
  const delivery = document.querySelector('[name="fulfillment"]:checked')?.value !== "pickup";
  $("#addressFields").classList.toggle("is-hidden", !delivery);
  $("#pickupInfo").classList.toggle("is-visible", !delivery);
  $("#changeField").classList.toggle("is-visible", document.querySelector('[name="payment"]:checked')?.value === "cash");
  renderCheckout();
  refreshQuote().catch(() => {});
  $("#checkoutPage").classList.add("is-open");
  $("#checkoutPage").setAttribute("aria-hidden", "false");
  document.body.classList.add("checkout-open");
  $("#checkoutPage").scrollTop = 0;
  $("#closeCheckout").focus({ preventScroll: true });
}

function closeCheckout() {
  $("#checkoutPage").classList.remove("is-open");
  $("#checkoutPage").setAttribute("aria-hidden", "true");
  document.body.classList.remove("checkout-open");
}

let pollTimer = null;
function showOrder(order) {
  $("#orderNumber").textContent = `#${order.number}`;
  const pickup = order.fulfillment === "PICKUP";
  $("#orderEstimate").textContent = pickup ? "20–30 minutos" : "35–45 minutos";
  const note = $("#orderPaymentNote");
  const qr = $("#pixQr");
  const copy = $("#pixCopy");
  if (order.pixPending) {
    $(".success-kicker").textContent = "AGUARDANDO PIX";
    $("#orderSuccess h1").textContent = "Falta o pagamento";
    $("#orderSuccess .success-content p").innerHTML = `Seu pedido <strong>#${order.number}</strong> foi registrado. Pague o Pix para entrar na fila.`;
    note.textContent = order.totalLabel || "";
    if (order.pixQrCodeBase64) {
      qr.hidden = false;
      qr.src = order.pixQrCodeBase64.startsWith("data:") ? order.pixQrCodeBase64 : `data:image/png;base64,${order.pixQrCodeBase64}`;
    }
    copy.hidden = !order.pixCopyPaste;
    copy.textContent = order.pixCopyPaste || "";
  } else if (order.paymentStatus === "REJECTED") {
    $(".success-kicker").textContent = "PAGAMENTO NÃO CONCLUÍDO";
    $("#orderSuccess h1").textContent = "Pix não confirmado";
    note.textContent = "O pagamento não foi aprovado. Fale com a loja se o valor foi debitado.";
    qr.hidden = true;
  } else {
    $(".success-kicker").textContent = order.paymentStatus === "PAY_ON_DELIVERY" ? "PEDIDO RECEBIDO" : "PEDIDO CONFIRMADO";
    $("#orderSuccess h1").textContent = "Boa escolha!";
    $("#orderSuccess .success-content p").innerHTML = `Seu pedido <strong>#${order.number}</strong> foi recebido e já entrou na fila.`;
    note.textContent = "";
    qr.hidden = true;
    copy.hidden = true;
  }
  const steps = $$(".order-progress span");
  const index = { NEW: 0, CONFIRMED: 0, PREPARING: 1, READY: 1, OUT_FOR_DELIVERY: 2, COMPLETED: 2 }[order.fulfillmentStatus] ?? 0;
  steps.forEach((step, i) => step.classList.toggle("active", i <= index));
}

async function pollOrder(token) {
  clearInterval(pollTimer);
  const load = async () => {
    const res = await fetch(`/api/atrako/food/public/orders/${token}`);
    if (!res.ok) return;
    const data = await res.json();
    showOrder(data.order);
    if (data.order.paymentStatus !== "PENDING") clearInterval(pollTimer);
  };
  await load();
  pollTimer = setInterval(load, 4000);
}

function routeCheckout() {
  if (location.hash === "#checkout") openCheckout(); else closeCheckout();
  const successMatch = location.hash.match(/^#pedido\/([a-z0-9]+)$/i);
  const deliveryVideos = document.querySelectorAll(".success-animation video");
  $("#orderSuccess").classList.toggle("is-open", Boolean(successMatch));
  $("#orderSuccess").setAttribute("aria-hidden", String(!successMatch));
  document.body.classList.toggle("success-open", Boolean(successMatch));
  if (successMatch) {
    if (!$("#intro").classList.contains("is-hidden")) enterMenu(true);
    pollOrder(successMatch[1]);
    deliveryVideos.forEach((video) => video.play().catch(() => {}));
  } else {
    clearInterval(pollTimer);
    deliveryVideos.forEach((video) => {
      video.pause();
      video.currentTime = 0;
    });
  }
}

$("#closeProduct")?.addEventListener("click", () => {
  if (location.hash.startsWith("#produto/")) history.back(); else closeProduct();
});
$("#detailMinus")?.addEventListener("click", () => { detailQuantity = Math.max(1, detailQuantity - 1); updateDetailTotal(); });
$("#detailPlus")?.addEventListener("click", () => { detailQuantity += 1; updateDetailTotal(); });
$("#detailNotes")?.addEventListener("input", (event) => { $("#notesCount").textContent = event.target.value.length; });
$("#detailAdd")?.addEventListener("click", () => {
  if (!activeProduct) return;
  const removals = [...$("#detailRemovals").querySelectorAll("input:checked")].map((input) => input.value);
  const notes = $("#detailNotes").value.trim();
  const name = activeProduct.name;
  const qty = detailQuantity;
  addLine(activeProduct, qty, removals, notes);
  history.back();
  showToast(`${qty}x ${name} adicionado ao pedido!`);
});
window.addEventListener("hashchange", () => { routeProduct(); routeCheckout(); });

$("#closeCheckout")?.addEventListener("click", () => history.back());
$$('[name="fulfillment"]').forEach((input) => input.addEventListener("change", (event) => {
  const delivery = event.target.value === "delivery";
  $("#addressFields").classList.toggle("is-hidden", !delivery);
  $("#pickupInfo").classList.toggle("is-visible", !delivery);
  $$("#addressFields [required]").forEach((field) => { field.required = delivery; });
  checkoutDiscount = null;
  renderCheckout();
  refreshQuote().catch(() => {});
}));
$$('[name="payment"]').forEach((input) => input.addEventListener("change", (event) => {
  $("#changeField").classList.toggle("is-visible", event.target.value === "cash");
}));
$("#checkoutCep")?.addEventListener("input", (event) => {
  const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
  event.target.value = digits.replace(/(\d{5})(\d)/, "$1-$2");
});
$("#checkoutPhone")?.addEventListener("input", (event) => {
  const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
  event.target.value = digits.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
});
$("#applyCoupon")?.addEventListener("click", () => { refreshQuote().catch(() => showToast("Não foi possível validar o cupom.")); });
$("#checkoutForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  if (menu && !menu.acceptingOrders) { showToast("A loja não está recebendo pedidos."); return; }
  const button = $("#placeOrder");
  button.disabled = true;
  try {
    const res = await fetch(`/api/atrako/food/public/${slug}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(checkoutPayload(false)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || "Não foi possível registrar o pedido.");
      return;
    }
    if (data.pixError) {
      showToast(data.pixError);
      return;
    }
    lines.clear();
    updateCart();
    event.currentTarget.reset();
    checkoutDiscount = null;
    sessionStorage.removeItem("food-request-id");
    history.replaceState(null, "", `#pedido/${data.order.publicToken}`);
    routeCheckout();
    showOrder(data.order);
  } finally {
    button.disabled = false;
  }
});
$("#finishOrder")?.addEventListener("click", () => {
  history.replaceState(null, "", location.pathname);
  routeCheckout();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

async function boot() {
  const res = await fetch(`/api/atrako/food/public/${slug}`);
  if (!res.ok) {
    showToast("Cardápio indisponível.");
    return;
  }
  menu = await res.json();
  items = menu.items || [];
  const plates = items.filter((item) => item.category !== "bebidas");
  const drinks = items.filter((item) => item.category === "bebidas");
  $("#products").innerHTML = plates.map(productTemplate).join("");
  $("#drinks").innerHTML = drinks.map(drinkTemplate).join("");
  const status = $(".open-status");
  if (status) status.innerHTML = menu.acceptingOrders ? "<i></i> Aberto agora" : "<i></i> Fechado agora";
  if (menu.pickupName) $("#pickupInfo strong").textContent = `Retire no ${menu.pickupName}`;
  if (menu.pickupAddress) $("#pickupInfo span").textContent = menu.pickupAddress;
  if (menu.pickupInstructions) $("#pickupInfo small").textContent = menu.pickupInstructions;
  [...lines.keys()].forEach((key) => {
    const line = lines.get(key);
    if (!itemById(line.itemId)) lines.delete(key);
  });
  updateCart();
  routeProduct();
  routeCheckout();
}

boot();
