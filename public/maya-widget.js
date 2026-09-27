/**
 * Maya WhatsApp embed widget (sellable drop-in)
 *
 * Default mode: floating bottom-right launcher → opens WhatsApp (wa.me)
 * to the Meta Cloud API test/business number (or a configured E.164).
 *
 * Optional mode="panel": opens an in-page panel. Live chat to the Maya
 * FastAPI backend is stubbed until a public /chat endpoint exists; the
 * panel CTA still deep-links to WhatsApp.
 *
 * Usage (HTML / any CMS):
 *   <script
 *     src="https://YOUR_CDN_OR_HOST/maya-widget.js"
 *     data-phone="15551609401"
 *     data-message="Hi Maya — I found you on the website."
 *     data-label="Chat with Maya"
 *     data-brand="Manyavar"
 *     data-mode="fab"
 *     async></script>
 *
 * Or programmatic:
 *   MayaWidget.init({ phone: '15551609401', message: 'Hi Maya' });
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    phone: '15551609401', // Meta Cloud API Test Number (+1 555-160-9401)
    message: 'Hi Maya — I need help with Manyavar.',
    label: 'Chat with Maya',
    brand: 'Maya',
    position: 'right', // right | left
    mode: 'fab', // fab | panel
    zIndex: 2147483000,
    accent: '#0b5fff',
    // Future: backendBaseUrl for embedded chat (not wired yet)
    backendBaseUrl: '',
  };

  function digitsOnly(phone) {
    return String(phone || '').replace(/\D+/g, '');
  }

  function waUrl(phone, message) {
    var p = digitsOnly(phone);
    var text = encodeURIComponent(message || '');
    return 'https://wa.me/' + p + (text ? '?text=' + text : '');
  }

  function readScriptConfig() {
    var scripts = document.getElementsByTagName('script');
    var cfg = {};
    for (var i = scripts.length - 1; i >= 0; i--) {
      var s = scripts[i];
      var src = s.getAttribute('src') || '';
      if (src.indexOf('maya-widget') === -1 && !s.hasAttribute('data-maya-widget')) {
        continue;
      }
      ['phone', 'message', 'label', 'brand', 'position', 'mode', 'accent', 'backendBaseUrl'].forEach(
        function (key) {
          var attr = 'data-' + key.replace(/[A-Z]/g, function (m) {
            return '-' + m.toLowerCase();
          });
          // also accept data-backend-base-url
          if (key === 'backendBaseUrl') attr = 'data-backend-base-url';
          var v = s.getAttribute(attr) || s.getAttribute('data-' + key);
          if (v != null && v !== '') cfg[key] = v;
        }
      );
      break;
    }
    return cfg;
  }

  function injectStyles(accent, position, zIndex) {
    if (document.getElementById('maya-widget-styles')) return;
    var css =
      '#maya-widget-root{all:initial;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
      '#maya-widget-root *{box-sizing:border-box}' +
      '#maya-fab{position:fixed;bottom:20px;' +
      (position === 'left' ? 'left:20px;' : 'right:20px;') +
      'z-index:' +
      zIndex +
      ';display:flex;align-items:center;gap:10px;padding:12px 16px;border:0;border-radius:999px;' +
      'background:' +
      accent +
      ';color:#fff;font-size:14px;font-weight:600;cursor:pointer;' +
      'box-shadow:0 8px 24px rgba(0,0,0,.22);transition:transform .15s ease,box-shadow .15s ease}' +
      '#maya-fab:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(0,0,0,.28)}' +
      '#maya-fab:focus-visible{outline:2px solid #fff;outline-offset:3px}' +
      '#maya-fab svg{width:22px;height:22px;flex:0 0 auto}' +
      '#maya-panel{position:fixed;bottom:84px;' +
      (position === 'left' ? 'left:20px;' : 'right:20px;') +
      'z-index:' +
      (zIndex - 1) +
      ';width:min(340px,calc(100vw - 32px));background:#fff;color:#111;' +
      'border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.28);overflow:hidden;' +
      'display:none;flex-direction:column}' +
      '#maya-panel.open{display:flex}' +
      '#maya-panel header{background:' +
      accent +
      ';color:#fff;padding:14px 16px;font-weight:700}' +
      '#maya-panel .body{padding:14px 16px;font-size:14px;line-height:1.45;color:#333}' +
      '#maya-panel .actions{padding:0 16px 16px;display:flex;flex-direction:column;gap:8px}' +
      '#maya-panel a.btn,#maya-panel button.btn{display:block;text-align:center;text-decoration:none;' +
      'padding:11px 14px;border-radius:10px;border:0;font-weight:600;font-size:14px;cursor:pointer}' +
      '#maya-panel a.btn-primary{background:' +
      accent +
      ';color:#fff}' +
      '#maya-panel button.btn-ghost{background:#f2f4f8;color:#222}' +
      '#maya-panel .hint{font-size:12px;color:#666;margin-top:8px}';
    var style = document.createElement('style');
    style.id = 'maya-widget-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function waIcon() {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' +
      '<path d="M20.5 3.5A11 11 0 0 0 2.1 17.3L1 23l5.9-1.1A11 11 0 0 0 20.5 3.5zm-8.6 17a9.1 9.1 0 0 1-4.6-1.3l-.3-.2-3.4.6.7-3.3-.2-.3a9.1 9.1 0 1 1 7.8 4.5zm5-6.8c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5c.1-.2.1-.3 0-.5l-.9-2.1c-.2-.5-.5-.4-.6-.4h-.5c-.2 0-.5.1-.7.4s-1 1-1 2.4 1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.2-1.3s-.2-.2-.5-.3z"/>' +
      '</svg>'
    );
  }

  function openWhatsApp(cfg) {
    var url = waUrl(cfg.phone, cfg.message);
    global.open(url, '_blank', 'noopener,noreferrer');
  }

  function build(cfg) {
    if (document.getElementById('maya-widget-root')) return;

    injectStyles(cfg.accent, cfg.position, cfg.zIndex);

    var root = document.createElement('div');
    root.id = 'maya-widget-root';
    root.setAttribute('data-maya-brand', cfg.brand);

    var fab = document.createElement('button');
    fab.id = 'maya-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', cfg.label);
    fab.innerHTML = waIcon() + '<span>' + cfg.label + '</span>';

    var panel = null;
    if (cfg.mode === 'panel') {
      panel = document.createElement('div');
      panel.id = 'maya-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', cfg.brand + ' chat');
      panel.innerHTML =
        '<header>' +
        cfg.brand +
        '</header>' +
        '<div class="body">Ask about stock, sizing, store visits, or booking. ' +
        'Chat continues on WhatsApp with Maya.</div>' +
        '<div class="actions">' +
        '<a class="btn btn-primary" id="maya-wa-cta" rel="noopener noreferrer" target="_blank">Open WhatsApp</a>' +
        '<button type="button" class="btn btn-ghost" id="maya-panel-close">Close</button>' +
        '<p class="hint">Embedded web chat to the Maya backend ships later ' +
        '(needs a public /chat API). This launcher stays WhatsApp-first.</p>' +
        '</div>';
      root.appendChild(panel);
    }

    root.appendChild(fab);
    document.body.appendChild(root);

    if (cfg.mode === 'panel' && panel) {
      var cta = panel.querySelector('#maya-wa-cta');
      cta.href = waUrl(cfg.phone, cfg.message);
      panel.querySelector('#maya-panel-close').addEventListener('click', function () {
        panel.classList.remove('open');
      });
      fab.addEventListener('click', function () {
        panel.classList.toggle('open');
      });
    } else {
      fab.addEventListener('click', function () {
        openWhatsApp(cfg);
      });
    }
  }

  function init(options) {
    var cfg = {};
    var key;
    for (key in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) cfg[key] = DEFAULTS[key];
    var fromScript = readScriptConfig();
    for (key in fromScript) if (Object.prototype.hasOwnProperty.call(fromScript, key)) cfg[key] = fromScript[key];
    options = options || {};
    for (key in options) if (Object.prototype.hasOwnProperty.call(options, key)) cfg[key] = options[key];

    function go() {
      build(cfg);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', go);
    } else {
      go();
    }
    return cfg;
  }

  global.MayaWidget = { init: init, waUrl: waUrl, defaults: DEFAULTS };

  // Auto-boot when included as a script tag
  if (document.currentScript || true) {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
