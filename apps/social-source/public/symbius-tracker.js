/**
 * Symbius Tracker — SDK browser (IIFE).
 * Uso:
 * <script>
 *   window.SYMBIUS_ORG_ID = '...';
 *   window.SYMBIUS_API_KEY = '...';
 *   window.SYMBIUS_API_BASE = 'https://flow.symbius.com.br';
 * </script>
 * <script src="https://flow.symbius.com.br/symbius-tracker.js" async></script>
 */
(function (w) {
  "use strict";

  var COOKIE_VID = "st_vid";
  var COOKIE_SID = "st_sid";
  var COOKIE_ST = "st_id";
  var SESSION_MS = 30 * 60 * 1000;

  function cfg(key, fallback) {
    return (w[key] != null && w[key] !== "") ? w[key] : fallback;
  }

  function getCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function setCookie(name, value, days) {
    var max = days ? "; max-age=" + days * 86400 : "";
    document.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      max +
      "; path=/; SameSite=Lax";
  }

  function rid(prefix) {
    var t = Date.now().toString(36);
    var r = Math.random().toString(36).slice(2, 10);
    return prefix + "_" + t + r;
  }

  function qp() {
    var out = {};
    try {
      var sp = new URLSearchParams(w.location.search);
      [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "fbclid",
        "gclid",
        "ttclid",
        "msclkid",
        "symbius_lead_id",
      ].forEach(function (k) {
        var v = sp.get(k);
        if (v) out[k] = v;
      });
    } catch (e) {}
    return out;
  }

  function ensureIds() {
    var vid = getCookie(COOKIE_VID) || rid("vis");
    setCookie(COOKIE_VID, vid, 365);

    var sid = getCookie(COOKIE_SID);
    var sidAt = Number(getCookie("st_sid_at") || 0);
    if (!sid || !sidAt || Date.now() - sidAt > SESSION_MS) {
      sid = rid("sess");
    }
    setCookie(COOKIE_SID, sid, 1);
    setCookie("st_sid_at", String(Date.now()), 1);

    var q = qp();
    if (q.symbius_lead_id) {
      setCookie(COOKIE_ST, q.symbius_lead_id, 365);
    }
    var st = getCookie(COOKIE_ST);

    return { vid: vid, sid: sid, st: st, q: q };
  }

  function apiBase() {
    return String(cfg("SYMBIUS_API_BASE", "")).replace(/\/$/, "");
  }

  function post(path, body) {
    var org = cfg("SYMBIUS_ORG_ID", "");
    var key = cfg("SYMBIUS_API_KEY", "");
    if (!org || !key || !apiBase()) return Promise.resolve(null);
    return fetch(apiBase() + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": org,
        "x-api-key": key,
      },
      body: JSON.stringify(body),
      keepalive: true,
    }).then(function (r) {
      return r.json().catch(function () {
        return null;
      });
    });
  }

  function campaignFromQuery(q) {
    return {
      source: q.utm_source || null,
      medium: q.utm_medium || null,
      name: q.utm_campaign || null,
      content: q.utm_content || null,
      term: q.utm_term || null,
    };
  }

  function clickIds(q) {
    return {
      fbclid: q.fbclid || null,
      gclid: q.gclid || null,
      ttclid: q.ttclid || null,
      msclkid: q.msclkid || null,
    };
  }

  var Symbius = {
    track: function (eventName, properties) {
      var ids = ensureIds();
      return post("/api/v1/events", {
        event: eventName,
        anonymous_id: ids.vid,
        session_id: ids.sid,
        st_id: ids.st,
        context: {
          page: {
            url: w.location.href,
            referrer: document.referrer || null,
          },
          campaign: campaignFromQuery(ids.q),
          click_ids: clickIds(ids.q),
        },
        properties: properties || {},
      });
    },
    identify: function (traits) {
      var ids = ensureIds();
      traits = traits || {};
      return post("/api/v1/identify", {
        anonymous_id: ids.vid,
        st_id: ids.st || traits.st_id || null,
        email: traits.email || null,
        phone: traits.phone || null,
        traits: { name: traits.name || null },
        context: {
          page: {
            url: w.location.href,
            referrer: document.referrer || null,
          },
          campaign: campaignFromQuery(ids.q),
          click_ids: clickIds(ids.q),
        },
      }).then(function (res) {
        if (res && res.st_id) setCookie(COOKIE_ST, res.st_id, 365);
        return res;
      });
    },
    getStId: function () {
      return getCookie(COOKIE_ST);
    },
  };

  w.Symbius = Symbius;

  function boot() {
    ensureIds();
    Symbius.track("page_view");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
