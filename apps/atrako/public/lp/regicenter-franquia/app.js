'use strict';
const FORM_SLUG = 'franquia-regicenter-lp'; // CaptureForm do workspace Regicenter no Atrako.
const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
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
function showStatus(text) {
  const status = document.querySelector('#form-status');
  status.hidden = false;
  status.textContent = text;
}
function attribution() {
  const out = { formSlug: FORM_SLUG, pageUrl: window.location.href };
  const params = new URLSearchParams(window.location.search);
  ATTRIBUTION_KEYS.forEach(key => {
    const value = (params.get(key) || '').trim();
    if (value) out[key] = value.slice(0, 200);
  });
  if (document.referrer) out.referrer = document.referrer.slice(0, 500);
  return out;
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
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const name = String(data.get('name')).trim();
  const city = String(data.get('city')).trim();
  if (name.length < 3 || city.length < 2) {
    showStatus('Confira seu nome completo e sua cidade antes de continuar.');
    return;
  }
  const answers = [
    { fieldId: 'name', value: name },
    { fieldId: 'phone', value: digits },
    { fieldId: 'city', value: city },
    { fieldId: 'state', value: String(data.get('state')) },
    { fieldId: 'investment_status', value: String(data.get('capital')) }
  ];
  sending = true;
  submitButton.disabled = true;
  try {
    const response = await fetch('/api/atrako/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', slug: FORM_SLUG, answers, ...attribution() })
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    form.querySelectorAll('.field, .field-row, .consent, .form-submit, .form-note').forEach(el => { el.style.display = 'none'; });
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
