'use strict';
const FORM_SLUG = 'franquia-regicenter-lp'; // CaptureForm do workspace Regicenter no Atrako.
const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
const FIRST_TOUCH_COOKIE = 'atk_ft'; // Mesmo formato de lib/geo-hub/first-touch.ts.
const CONSENT_KEY = 'atk_consent';
const startedAt = Date.now();
const pageParams = new URLSearchParams(window.location.search);

function readFirstTouch() {
  try { const raw = cookie(FIRST_TOUCH_COOKIE); return raw ? JSON.parse(raw) : null; } catch (error) { return null; }
}
function captureFirstTouch() {
  if (readFirstTouch()) return;
  let ref = document.referrer || '';
  try { if (ref && new URL(ref).host === window.location.host) ref = ''; } catch (error) { ref = ''; }
  const ft = { lp: window.location.pathname.slice(0, 200), at: new Date().toISOString() };
  if (ref) ft.ref = ref.slice(0, 300);
  if (pageParams.get('utm_source')) ft.src = pageParams.get('utm_source').slice(0, 120);
  if (pageParams.get('utm_medium')) ft.med = pageParams.get('utm_medium').slice(0, 120);
  if (pageParams.get('utm_campaign')) ft.cmp = pageParams.get('utm_campaign').slice(0, 120);
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = FIRST_TOUCH_COOKIE + '=' + encodeURIComponent(JSON.stringify(ft)) + '; Max-Age=' + (60 * 60 * 24 * 90) + '; Path=/; SameSite=Lax' + secure;
}
function firstTouchPayload() {
  const ft = readFirstTouch();
  if (!ft) return {};
  const out = {};
  if (ft.ref) out.first_referrer = ft.ref;
  if (ft.src) out.first_utm_source = ft.src;
  if (ft.med) out.first_utm_medium = ft.med;
  if (ft.cmp) out.first_utm_campaign = ft.cmp;
  if (ft.lp) out.first_landing = ft.lp;
  if (ft.at) out.first_seen_at = ft.at;
  return out;
}
function sessionId() {
  try {
    let sid = sessionStorage.getItem('atk_sid');
    if (!sid) { sid = newEventId(); sessionStorage.setItem('atk_sid', sid); }
    return sid;
  } catch (error) { return ''; }
}
// Visita vinda de IA/busca/outro site vira GeoHit no Atrako (o servidor ignora navegação direta).
function sendVisitBeacon() {
  const payload = JSON.stringify({ path: window.location.pathname, referrer: document.referrer || '', utm_source: pageParams.get('utm_source') || '', sid: sessionId() });
  if (navigator.sendBeacon) navigator.sendBeacon('/api/geo/hit', payload);
  else fetch('/api/geo/hit', { method: 'POST', body: payload, keepalive: true }).catch(() => {});
}
captureFirstTouch();
sendVisitBeacon();

// Pixel e GA4 só depois do consentimento; os IDs vêm de Config → Rastreamento do workspace.
function loadPixel(id) {
  if (window.fbq) return;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', id);
  window.fbq('track', 'PageView');
}
function loadGa4(id) {
  if (window.gtag) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
}
function loadTracking() {
  fetch('/api/geo/public-config').then(response => response.ok ? response.json() : null).then(config => {
    if (!config) return;
    if (config.pixelId) loadPixel(config.pixelId);
    if (config.ga4MeasurementId) loadGa4(config.ga4MeasurementId);
  }).catch(() => {});
}
function consentChoice() {
  try { return localStorage.getItem(CONSENT_KEY); } catch (error) { return null; }
}
function setConsent(value) {
  try { localStorage.setItem(CONSENT_KEY, value); } catch (error) { /* modo privado */ }
  document.querySelector('#consent').hidden = true;
  if (value === 'granted') loadTracking();
}
(function initConsent() {
  const banner = document.querySelector('#consent');
  const choice = consentChoice();
  if (choice === 'granted') loadTracking();
  if (!banner || choice) return;
  banner.hidden = false;
  document.querySelector('#consent-accept').addEventListener('click', () => setConsent('granted'));
  document.querySelector('#consent-decline').addEventListener('click', () => setConsent('denied'));
})();
const form = document.querySelector('#lead-form');
const submitButton = form.querySelector('.form-submit');
let sending = false;
const phone = document.querySelector('#phone');
phone.addEventListener('input', () => {
  let value = phone.value.replace(/\D/g, '').slice(0, 11);
  if (value.length > 2) value = '(' + value.slice(0, 2) + ') ' + value.slice(2);
  if (value.replace(/\D/g, '').length > 6) {
    const digits = value.replace(/\D/g, '');
    const split = digits.length === 11 ? 7 : 6;
    value = '(' + digits.slice(0, 2) + ') ' + digits.slice(2, split) + '-' + digits.slice(split);
  }
  phone.value = value;
  phone.setCustomValidity('');
});
const stateSelect = document.querySelector('#state');
const cityInput = document.querySelector('#city');
const cityOptions = document.querySelector('#city-options');
let cityList = [];
const fold = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
stateSelect.addEventListener('change', async () => {
  const uf = stateSelect.value;
  cityList = [];
  cityOptions.replaceChildren();
  cityInput.value = '';
  cityInput.setCustomValidity('');
  if (!uf) {
    cityInput.disabled = true;
    cityInput.placeholder = 'Escolha o estado primeiro';
    return;
  }
  cityInput.disabled = true;
  cityInput.placeholder = 'Carregando cidades...';
  try {
    const response = await fetch('/api/atrako/geo/cidades?uf=' + encodeURIComponent(uf));
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const payload = await response.json();
    if (stateSelect.value !== uf) return;
    cityList = payload.cidades || [];
    cityOptions.replaceChildren(...cityList.map(name => { const option = document.createElement('option'); option.value = name; return option; }));
    cityInput.placeholder = 'Digite ou escolha sua cidade';
  } catch (error) {
    cityInput.placeholder = 'Digite sua cidade';
  }
  cityInput.disabled = false;
  cityInput.focus();
});
cityInput.addEventListener('input', () => cityInput.setCustomValidity(''));
function matchCity(value) {
  if (!cityList.length) return value.trim();
  const key = fold(value);
  return cityList.find(name => fold(name) === key) || '';
}
function showStatus(text) {
  const status = document.querySelector('#form-status');
  status.hidden = false;
  status.textContent = text;
}
function cookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : '';
}
function attribution() {
  const out = { formSlug: FORM_SLUG, pageUrl: window.location.href };
  const params = new URLSearchParams(window.location.search);
  ATTRIBUTION_KEYS.forEach(key => {
    const value = (params.get(key) || '').trim();
    if (value) out[key] = value.slice(0, 200);
  });
  if (document.referrer) out.referrer = document.referrer.slice(0, 500);
  const fbp = cookie('_fbp');
  const fbc = cookie('_fbc') || (out.fbclid ? 'fb.1.' + Date.now() + '.' + out.fbclid : '');
  if (fbp) out.fbp = fbp;
  if (fbc) out.fbc = fbc;
  const ft = firstTouchPayload();
  // Detect AI source from first-touch referrer or UTM
  const aiHosts = ['chatgpt.com', 'chat.openai.com', 'perplexity.ai', 'claude.ai', 'anthropic.com', 'gemini.google.com', 'bard.google.com', 'copilot.microsoft.com'];
  const ref = (ft.first_referrer || document.referrer || '').toLowerCase();
  const utm = (ft.first_utm_source || params.get('utm_source') || '').toLowerCase();
  for (const h of aiHosts) {
    if (ref.includes(h) || utm.includes(h)) {
      out.aiSource = h.includes('chatgpt') || h.includes('openai') ? 'chatgpt'
        : h.includes('perplexity') ? 'perplexity'
        : h.includes('claude') || h.includes('anthropic') ? 'claude'
        : h.includes('gemini') || h.includes('bard') ? 'gemini'
        : h.includes('copilot') ? 'copilot' : 'other';
      break;
    }
  }
  return Object.assign(out, ft);
}
function newEventId() {
  return window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'lead-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending) return;
  const digits = phone.value.replace(/\D/g, '');
  if (!/^[1-9]{2}\d{8,9}$/.test(digits)) {
    phone.setCustomValidity('Informe um WhatsApp válido com DDD (10 ou 11 dígitos).');
    phone.reportValidity();
    return;
  }
  const city = matchCity(cityInput.value);
  if (!cityInput.disabled && cityInput.value.trim() && !city) {
    cityInput.setCustomValidity('Escolha uma cidade da lista.');
    cityInput.reportValidity();
    return;
  }
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const name = String(data.get('name')).trim();
  const email = String(data.get('email')).trim().toLowerCase();
  if (name.length < 3 || city.length < 2) {
    showStatus('Confira seu nome completo e sua cidade antes de continuar.');
    return;
  }
  cityInput.value = city;
  const answers = [
    { fieldId: 'name', value: name },
    { fieldId: 'phone', value: digits },
    { fieldId: 'email', value: email },
    { fieldId: 'city', value: city },
    { fieldId: 'state', value: String(data.get('state')) },
    { fieldId: 'investment_status', value: String(data.get('capital')) }
  ];
  const howFound = String(data.get('how_found') || '');
  if (howFound) answers.push({ fieldId: 'how_found', value: howFound });
  sending = true;
  submitButton.disabled = true;
  const metaEventId = newEventId();
  try {
    const response = await fetch('/api/atrako/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', slug: FORM_SLUG, answers, metaEventId, website: String(data.get('website') || ''), startedAt, ...attribution() })
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'Lead', { content_name: 'Franquia Regicenter', content_category: String(data.get('capital')) }, { eventID: metaEventId });
    }
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'generate_lead', { form_slug: FORM_SLUG, lead_source: howFound || 'nao_informado' });
    }
    form.querySelectorAll('.field, .field-row, .form-submit, .form-note').forEach(el => { el.style.display = 'none'; });
    const first = name.split(/\s+/)[0];
    showStatus('Pronto, ' + first + '! Recebemos seus dados. A equipe de expansão da Regicenter vai te chamar no WhatsApp ' + phone.value + ' em breve.');
  } catch (error) {
    showStatus('Não foi possível enviar agora. Confira sua conexão e tente novamente em instantes.');
    submitButton.disabled = false;
  } finally {
    sending = false;
  }
});
document.querySelector('#play-video').addEventListener('click', () => {
  const iframe = document.createElement('iframe');
  iframe.src = 'https://www.youtube-nocookie.com/embed/mMRtrGFhIWg?autoplay=1&rel=0';
  iframe.title = 'Conheça a Regicenter';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  document.querySelector('#video-shell').replaceChildren(iframe);
});
const dialog = document.querySelector('#privacy-dialog');
document.querySelectorAll('.privacy-trigger').forEach(button => button.addEventListener('click', () => dialog.showModal()));
document.querySelector('#close-privacy').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
document.querySelector('#year').textContent = new Date().getFullYear();
const mobileCta = document.querySelector('.mobile-cta');
if ('IntersectionObserver' in window) {
  const observed = new Map();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => observed.set(entry.target, entry.isIntersecting));
    mobileCta.classList.toggle('is-hidden', [...observed.values()].some(Boolean));
  }, {threshold: 0.1});
  observer.observe(document.querySelector('.hero'));
  observer.observe(document.querySelector('#cadastro'));
}
