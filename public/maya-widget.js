/**
 * Maya WhatsApp-style embed widget (sellable drop-in)
 *
 * Default mode: floating FAB → WhatsApp-like panel with:
 *   - Chat here (in-page thread via POST /public/webchat)
 *   - Open WhatsApp (wa.me deep link)
 *
 * Same Meta Cloud API test pipeline: webchat calls handle_inbound, so Maya
 * replies also land on the user's phone WhatsApp (allowed test numbers).
 *
 * Usage:
 *   <script
 *     src="/maya-widget.js"
 *     data-phone="15551609401"
 *     data-message="Hi Maya — I found you on hereyougo.me."
 *     data-label="Chat with Maya"
 *     data-brand="Maya"
 *     data-mode="chat"
 *     data-backend-base-url="https://YOUR_TUNNEL"
 *     data-accent="#25D366"
 *     async></script>
 *
 * Or: MayaWidget.init({ phone: '15551609401', mode: 'chat', backendBaseUrl: '...' });
 */
(function (global) {
  'use strict';

  var PHONE_KEY = 'maya_webchat_phone';
  var POLL_MS = 3000;

  var DEFAULTS = {
    phone: '15551609401', // Meta Cloud API Test Number (+1 555-160-9401)
    message: 'Hi Maya — I found you on hereyougo.me.',
    label: 'Chat with Maya',
    brand: 'Maya',
    position: 'right', // right | left
    mode: 'chat', // chat | panel | fab
    zIndex: 2147483000,
    accent: '#25D366',
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

  function trimSlash(url) {
    return String(url || '').replace(/\/+$/, '');
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
    var side = position === 'left' ? 'left:20px;' : 'right:20px;';
    var css =
      '#maya-widget-root{all:initial;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}' +
      '#maya-widget-root *{box-sizing:border-box}' +
      '#maya-fab{position:fixed;bottom:20px;' +
      side +
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
      side +
      'z-index:' +
      (zIndex - 1) +
      ';width:min(360px,calc(100vw - 24px));height:min(560px,calc(100vh - 110px));' +
      'background:#e5ddd5;color:#111;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.28);' +
      'overflow:hidden;display:none;flex-direction:column}' +
      '#maya-panel.open{display:flex}' +
      '#maya-panel header.maya-hdr{background:#075E54;color:#fff;padding:12px 14px;display:flex;' +
      'align-items:center;gap:10px;flex:0 0 auto}' +
      '#maya-panel header.maya-hdr .maya-avatar{width:36px;height:36px;border-radius:50%;' +
      'background:' +
      accent +
      ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex:0 0 auto}' +
      '#maya-panel header.maya-hdr .maya-meta{flex:1;min-width:0}' +
      '#maya-panel header.maya-hdr .maya-title{font-weight:700;font-size:15px;line-height:1.2}' +
      '#maya-panel header.maya-hdr .maya-sub{font-size:11px;opacity:.85;margin-top:2px}' +
      '#maya-panel header.maya-hdr a.maya-wa-link,#maya-panel header.maya-hdr button.maya-icon-btn{' +
      'background:transparent;border:0;color:#fff;cursor:pointer;padding:6px;border-radius:8px;' +
      'font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap}' +
      '#maya-panel header.maya-hdr a.maya-wa-link:hover,#maya-panel header.maya-hdr button.maya-icon-btn:hover{' +
      'background:rgba(255,255,255,.12)}' +
      '#maya-panel .maya-screen{flex:1;display:flex;flex-direction:column;min-height:0;background:#fff}' +
      '#maya-panel .maya-choice{padding:20px 16px;display:flex;flex-direction:column;gap:12px;flex:1;' +
      'justify-content:center;background:linear-gradient(180deg,#f7f8fa 0%,#fff 100%)}' +
      '#maya-panel .maya-choice h2{margin:0 0 4px;font-size:18px;color:#111}' +
      '#maya-panel .maya-choice p{margin:0 0 8px;font-size:13px;color:#555;line-height:1.45}' +
      '#maya-panel a.btn,#maya-panel button.btn{display:block;text-align:center;text-decoration:none;' +
      'padding:12px 14px;border-radius:10px;border:0;font-weight:600;font-size:14px;cursor:pointer;' +
      'font-family:inherit}' +
      '#maya-panel a.btn-primary,#maya-panel button.btn-primary{background:' +
      accent +
      ';color:#fff}' +
      '#maya-panel button.btn-ghost,#maya-panel a.btn-ghost{background:#f2f4f8;color:#222}' +
      '#maya-panel .maya-hint{font-size:11px;color:#777;line-height:1.4;margin-top:4px}' +
      '#maya-panel .maya-phone-form{padding:16px;display:flex;flex-direction:column;gap:10px;flex:1;' +
      'justify-content:center;background:#fff}' +
      '#maya-panel .maya-phone-form label{font-size:13px;font-weight:600;color:#222}' +
      '#maya-panel .maya-phone-form input{width:100%;padding:11px 12px;border:1px solid #ccc;' +
      'border-radius:10px;font-size:15px;font-family:inherit}' +
      '#maya-panel .maya-phone-form input:focus{outline:2px solid ' +
      accent +
      ';outline-offset:1px;border-color:' +
      accent +
      '}' +
      '#maya-panel .maya-thread{flex:1;display:flex;flex-direction:column;min-height:0;background:#e5ddd5}' +
      '#maya-panel .maya-msgs{flex:1;overflow-y:auto;padding:12px 10px;display:flex;flex-direction:column;gap:6px}' +
      '#maya-panel .maya-bubble{max-width:82%;padding:8px 10px;border-radius:8px;font-size:13.5px;' +
      'line-height:1.4;white-space:pre-wrap;word-wrap:break-word;box-shadow:0 1px 0.5px rgba(0,0,0,.13)}' +
      '#maya-panel .maya-bubble.user{align-self:flex-end;background:#dcf8c6;border-top-right-radius:2px;color:#111}' +
      '#maya-panel .maya-bubble.assistant{align-self:flex-start;background:#fff;border-top-left-radius:2px;color:#111}' +
      '#maya-panel .maya-typing{align-self:flex-start;background:#fff;padding:8px 12px;border-radius:8px;' +
      'font-size:12px;color:#666;display:none}' +
      '#maya-panel .maya-typing.on{display:inline-block}' +
      '#maya-panel .maya-composer{flex:0 0 auto;display:flex;gap:8px;padding:8px;background:#f0f0f0;' +
      'align-items:flex-end}' +
      '#maya-panel .maya-composer textarea{flex:1;resize:none;border:0;border-radius:20px;padding:10px 14px;' +
      'font-size:14px;font-family:inherit;max-height:100px;min-height:40px;line-height:1.3}' +
      '#maya-panel .maya-composer button.send{border:0;border-radius:50%;width:40px;height:40px;' +
      'background:' +
      accent +
      ';color:#fff;cursor:pointer;font-weight:700;flex:0 0 auto}' +
      '#maya-panel .maya-composer button.send:disabled{opacity:.5;cursor:not-allowed}' +
      '#maya-panel footer.maya-ftr{flex:0 0 auto;background:#f7f7f7;padding:6px 10px;display:flex;' +
      'justify-content:space-between;align-items:center;font-size:11px;color:#666;border-top:1px solid #e5e5e5}' +
      '#maya-panel footer.maya-ftr a{color:#075E54;font-weight:600;text-decoration:none}' +
      '#maya-panel .maya-err{color:#b00020;font-size:12px;margin-top:4px}';
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

  function getStoredPhone() {
    try {
      return digitsOnly(localStorage.getItem(PHONE_KEY) || '');
    } catch (e) {
      return '';
    }
  }

  function setStoredPhone(phone) {
    try {
      localStorage.setItem(PHONE_KEY, digitsOnly(phone));
    } catch (e) {
      /* ignore */
    }
  }

  function build(cfg) {
    if (document.getElementById('maya-widget-root')) return;

    var mode = (cfg.mode || 'chat').toLowerCase();
    if (mode === 'panel') mode = 'chat'; // panel upgraded to full chat UI

    injectStyles(cfg.accent, cfg.position, cfg.zIndex);

    var root = document.createElement('div');
    root.id = 'maya-widget-root';
    root.setAttribute('data-maya-brand', cfg.brand);

    var fab = document.createElement('button');
    fab.id = 'maya-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', cfg.label);
    fab.innerHTML = waIcon() + '<span>' + escapeHtml(cfg.label) + '</span>';

    if (mode === 'fab') {
      root.appendChild(fab);
      document.body.appendChild(root);
      fab.addEventListener('click', function () {
        openWhatsApp(cfg);
      });
      return;
    }

    // Chat / panel mode
    var panel = document.createElement('div');
    panel.id = 'maya-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', cfg.brand + ' chat');

    var waHref = waUrl(cfg.phone, cfg.message);
    var brandInitial = (cfg.brand || 'M').charAt(0).toUpperCase();

    panel.innerHTML =
      '<header class="maya-hdr">' +
      '<div class="maya-avatar">' +
      escapeHtml(brandInitial) +
      '</div>' +
      '<div class="maya-meta">' +
      '<div class="maya-title">' +
      escapeHtml(cfg.brand) +
      '</div>' +
      '<div class="maya-sub">online · WhatsApp</div>' +
      '</div>' +
      '<a class="maya-wa-link" id="maya-hdr-wa" href="' +
      waHref +
      '" target="_blank" rel="noopener noreferrer">Open WhatsApp</a>' +
      '<button type="button" class="maya-icon-btn" id="maya-panel-close" aria-label="Close">✕</button>' +
      '</header>' +
      '<div class="maya-screen" id="maya-screen"></div>' +
      '<footer class="maya-ftr">' +
      '<span>Synced with phone WhatsApp</span>' +
      '<a id="maya-ftr-wa" href="' +
      waHref +
      '" target="_blank" rel="noopener noreferrer">Open WhatsApp</a>' +
      '</footer>';

    root.appendChild(panel);
    root.appendChild(fab);
    document.body.appendChild(root);

    var screen = panel.querySelector('#maya-screen');
    var pollTimer = null;
    var sessionId =
      's' +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8);
    var lastRenderedCount = 0;
    var sending = false;

    function stopPoll() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function startPoll(userPhone) {
      stopPoll();
      if (!cfg.backendBaseUrl || !userPhone) return;
      pollTimer = setInterval(function () {
        if (!panel.classList.contains('open')) return;
        loadHistory(userPhone, true);
      }, POLL_MS);
    }

    function showChoice() {
      stopPoll();
      screen.innerHTML =
        '<div class="maya-choice">' +
        '<h2>Chat with ' +
        escapeHtml(cfg.brand) +
        '</h2>' +
        '<p>Continue in this browser, or open WhatsApp on your phone. Same Maya · same Meta test pipeline.</p>' +
        '<button type="button" class="btn btn-primary" id="maya-chat-here">Chat here</button>' +
        '<a class="btn btn-ghost" id="maya-open-wa" href="' +
        waHref +
        '" target="_blank" rel="noopener noreferrer">Open WhatsApp</a>' +
        '<p class="maya-hint">Chat-here uses a WhatsApp number allowed on the Meta <strong>test</strong> WABA (the same number on your phone).</p>' +
        '</div>';
      screen.querySelector('#maya-chat-here').addEventListener('click', function () {
        var stored = getStoredPhone();
        if (stored) {
          showThread(stored);
        } else {
          showPhoneForm();
        }
      });
    }

    function showPhoneForm() {
      stopPoll();
      screen.innerHTML =
        '<div class="maya-phone-form">' +
        '<label for="maya-phone-input">Your WhatsApp number</label>' +
        '<input id="maya-phone-input" type="tel" inputmode="tel" autocomplete="tel" ' +
        'placeholder="+91 98765 43210" aria-describedby="maya-phone-hint" />' +
        '<p class="maya-hint" id="maya-phone-hint">E.164 digits (country code + number). Must be allowed on the Meta test WABA — same number you use on phone WhatsApp.</p>' +
        '<div class="maya-err" id="maya-phone-err" hidden></div>' +
        '<button type="button" class="btn btn-primary" id="maya-phone-save">Continue</button>' +
        '<button type="button" class="btn btn-ghost" id="maya-phone-back">Back</button>' +
        '</div>';
      var input = screen.querySelector('#maya-phone-input');
      var err = screen.querySelector('#maya-phone-err');
      screen.querySelector('#maya-phone-back').addEventListener('click', showChoice);
      screen.querySelector('#maya-phone-save').addEventListener('click', function () {
        var p = digitsOnly(input.value);
        if (p.length < 8 || p.length > 15) {
          err.hidden = false;
          err.textContent = 'Enter a valid WhatsApp number with country code (8–15 digits).';
          return;
        }
        setStoredPhone(p);
        showThread(p);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          screen.querySelector('#maya-phone-save').click();
        }
      });
      setTimeout(function () {
        input.focus();
      }, 50);
    }

    function renderMessages(messages) {
      var box = screen.querySelector('#maya-msgs');
      if (!box) return;
      var html = '';
      for (var i = 0; i < messages.length; i++) {
        var m = messages[i];
        var role = m.role === 'user' ? 'user' : 'assistant';
        html +=
          '<div class="maya-bubble ' +
          role +
          '">' +
          escapeHtml(m.content || '') +
          '</div>';
      }
      box.innerHTML = html;
      box.scrollTop = box.scrollHeight;
      lastRenderedCount = messages.length;
    }

    function loadHistory(userPhone, soft) {
      var base = trimSlash(cfg.backendBaseUrl);
      if (!base) return Promise.resolve();
      return fetch(
        base + '/public/webchat/history?phone=' + encodeURIComponent(userPhone) + '&limit=40',
        { credentials: 'omit' }
      )
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (res) {
          if (!res.ok || !res.j || !res.j.ok) return;
          var msgs = res.j.messages || [];
          if (soft && msgs.length === lastRenderedCount) return;
          renderMessages(msgs);
        })
        .catch(function () {
          /* ignore poll errors */
        });
    }

    function showThread(userPhone) {
      screen.innerHTML =
        '<div class="maya-thread">' +
        '<div class="maya-msgs" id="maya-msgs"></div>' +
        '<div class="maya-typing" id="maya-typing">Maya is typing…</div>' +
        '<div class="maya-composer">' +
        '<textarea id="maya-input" rows="1" placeholder="Type a message" aria-label="Message"></textarea>' +
        '<button type="button" class="send" id="maya-send" aria-label="Send">➤</button>' +
        '</div>' +
        '<div style="padding:4px 10px 8px;background:#f0f0f0;font-size:11px;color:#666;display:flex;justify-content:space-between;gap:8px">' +
        '<span>Using …' +
        escapeHtml(userPhone.slice(-4)) +
        '</span>' +
        '<button type="button" id="maya-change-phone" style="border:0;background:transparent;color:#075E54;font-weight:600;cursor:pointer;font-size:11px">Change number</button>' +
        '</div>' +
        '</div>';

      var input = screen.querySelector('#maya-input');
      var sendBtn = screen.querySelector('#maya-send');
      var typing = screen.querySelector('#maya-typing');

      screen.querySelector('#maya-change-phone').addEventListener('click', function () {
        try {
          localStorage.removeItem(PHONE_KEY);
        } catch (e) {
          /* ignore */
        }
        showPhoneForm();
      });

      function autosize() {
        input.style.height = 'auto';
        input.style.height = Math.min(100, input.scrollHeight) + 'px';
      }
      input.addEventListener('input', autosize);

      function doSend() {
        if (sending) return;
        var text = (input.value || '').trim();
        if (!text) return;
        var base = trimSlash(cfg.backendBaseUrl);
        if (!base) {
          alert('Chat backend is not configured (data-backend-base-url). Use Open WhatsApp instead.');
          return;
        }
        sending = true;
        sendBtn.disabled = true;
        typing.classList.add('on');

        // Optimistic user bubble
        var box = screen.querySelector('#maya-msgs');
        var bub = document.createElement('div');
        bub.className = 'maya-bubble user';
        bub.textContent = text;
        box.appendChild(bub);
        box.scrollTop = box.scrollHeight;
        input.value = '';
        autosize();

        fetch(base + '/public/webchat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'omit',
          body: JSON.stringify({
            phone: userPhone,
            text: text,
            session_id: sessionId,
          }),
        })
          .then(function (r) {
            return r.json().then(function (j) {
              return { ok: r.ok, status: r.status, j: j };
            });
          })
          .then(function (res) {
            typing.classList.remove('on');
            sending = false;
            sendBtn.disabled = false;
            if (!res.ok || !res.j || !res.j.ok) {
              var errBub = document.createElement('div');
              errBub.className = 'maya-bubble assistant';
              errBub.textContent =
                (res.j && (res.j.hint || res.j.error)) ||
                'Could not reach Maya. Check the number is on the Meta test list, or Open WhatsApp.';
              box.appendChild(errBub);
              box.scrollTop = box.scrollHeight;
              return;
            }
            var replies = res.j.replies || [];
            for (var i = 0; i < replies.length; i++) {
              var rb = document.createElement('div');
              rb.className = 'maya-bubble assistant';
              rb.textContent = replies[i];
              box.appendChild(rb);
            }
            box.scrollTop = box.scrollHeight;
            lastRenderedCount += 1 + replies.length;
            // Refresh from memory for full sync (also captures phone-side turns)
            loadHistory(userPhone, false);
          })
          .catch(function () {
            typing.classList.remove('on');
            sending = false;
            sendBtn.disabled = false;
            var errBub = document.createElement('div');
            errBub.className = 'maya-bubble assistant';
            errBub.textContent = 'Network error talking to Maya. Try Open WhatsApp.';
            box.appendChild(errBub);
          });
      }

      sendBtn.addEventListener('click', doSend);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          doSend();
        }
      });

      loadHistory(userPhone, false).then(function () {
        startPoll(userPhone);
      });
      setTimeout(function () {
        input.focus();
      }, 50);
    }

    panel.querySelector('#maya-panel-close').addEventListener('click', function () {
      panel.classList.remove('open');
      stopPoll();
    });

    fab.addEventListener('click', function () {
      var opening = !panel.classList.contains('open');
      panel.classList.toggle('open');
      if (opening) {
        if (!screen.innerHTML) showChoice();
        var stored = getStoredPhone();
        if (stored && screen.querySelector('.maya-thread')) {
          startPoll(stored);
        }
      } else {
        stopPoll();
      }
    });

    // Initial empty → choice when first opened
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

  if (document.currentScript || true) {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
