import k from "events";
import $ from "crypto";
import R from "path";
import A from "child_process";
function C(t, e) {
  for (var n = 0; n < e.length; n++) {
    const r = e[n];
    if (typeof r != "string" && !Array.isArray(r)) {
      for (const i in r)
        if (i !== "default" && !(i in t)) {
          const s = Object.getOwnPropertyDescriptor(r, i);
          s && Object.defineProperty(t, i, s.get ? s : {
            enumerable: !0,
            get: () => r[i]
          });
        }
    }
  }
  return Object.freeze(Object.defineProperty(t, Symbol.toStringTag, { value: "Module" }));
}
var p = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function U(t) {
  return t && t.__esModule && Object.prototype.hasOwnProperty.call(t, "default") ? t.default : t;
}
function B(t) {
  if (t.__esModule) return t;
  var e = t.default;
  if (typeof e == "function") {
    var n = function r() {
      return this instanceof r ? Reflect.construct(e, arguments, this.constructor) : e.apply(this, arguments);
    };
    n.prototype = e.prototype;
  } else n = {};
  return Object.defineProperty(n, "__esModule", { value: !0 }), Object.keys(t).forEach(function(r) {
    var i = Object.getOwnPropertyDescriptor(t, r);
    Object.defineProperty(n, r, i.get ? i : {
      enumerable: !0,
      get: function() {
        return t[r];
      }
    });
  }), n;
}
const q = k;
let z = class extends q {
  constructor(e) {
    if (super(), typeof e != "function")
      throw "execution must be a function";
    this._execution = e;
  }
  execute(e) {
    let n;
    try {
      n = this._execution(e);
    } catch (r) {
      return this.emit("task-failed", r);
    }
    return n instanceof Promise ? n.then(() => this.emit("task-finished")).catch((r) => this.emit("task-failed", r)) : (this.emit("task-finished"), n);
  }
};
var H = z, W = /* @__PURE__ */ (() => {
  const t = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ], e = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec"
  ];
  function n(i, s) {
    for (let o = 0; o < s.length; o++)
      i = i.replace(new RegExp(s[o], "gi"), parseInt(o, 10) + 1);
    return i;
  }
  function r(i) {
    return i = n(i, t), i = n(i, e), i;
  }
  return r;
})(), F = /* @__PURE__ */ (() => {
  const t = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ], e = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  function n(i, s) {
    for (let o = 0; o < s.length; o++)
      i = i.replace(new RegExp(s[o], "gi"), parseInt(o, 10));
    return i;
  }
  function r(i) {
    return i = i.replace("7", "0"), i = n(i, t), n(i, e);
  }
  return r;
})(), L = /* @__PURE__ */ (() => {
  function t(n, r) {
    return n.indexOf("*") !== -1 ? n.replace("*", r) : n;
  }
  function e(n) {
    return n[0] = t(n[0], "0-59"), n[1] = t(n[1], "0-59"), n[2] = t(n[2], "0-23"), n[3] = t(n[3], "1-31"), n[4] = t(n[4], "1-12"), n[5] = t(n[5], "0-6"), n;
  }
  return e;
})(), V = /* @__PURE__ */ (() => {
  function t(r, i, s, o) {
    const a = [];
    let c = parseInt(o), l = parseInt(s);
    l > c && (c = parseInt(s), l = parseInt(o));
    for (let u = l; u <= c; u++)
      a.push(u);
    return r.replace(new RegExp(i, "i"), a.join());
  }
  function e(r) {
    const i = /(\d+)-(\d+)/;
    let s = i.exec(r);
    for (; s !== null && s.length > 0; )
      r = t(r, s[0], s[1], s[2]), s = i.exec(r);
    return r;
  }
  function n(r) {
    for (let i = 0; i < r.length; i++)
      r[i] = e(r[i]);
    return r;
  }
  return n;
})(), G = /* @__PURE__ */ (() => {
  function t(e) {
    for (var n = /^(.+)\/(\w+)$/, r = 0; r < e.length; r++) {
      var i = n.exec(e[r]), s = i !== null && i.length > 0;
      if (s) {
        var o = i[2];
        if (isNaN(o))
          throw o + " is not a valid step value";
        for (var a = i[1].split(","), c = [], l = parseInt(o, 10), u = 0; u <= a.length; u++) {
          var h = parseInt(a[u], 10);
          h % l === 0 && c.push(h);
        }
        e[r] = c.join(",");
      }
    }
    return e;
  }
  return t;
})();
const X = W, Z = F, J = L, K = V, Q = G;
var M = /* @__PURE__ */ (() => {
  function t(i) {
    return i.length === 5 ? ["0"].concat(i) : i;
  }
  function e(i) {
    return i.replace(/\s{2,}/g, " ").trim();
  }
  function n(i) {
    for (let s = 0; s < i.length; s++) {
      const o = i[s].split(",");
      for (let a = 0; a < o.length; a++)
        o[a] = parseInt(o[a]);
      i[s] = o;
    }
    return i;
  }
  function r(i) {
    let s = e(i).split(" ");
    return s = t(s), s[4] = X(s[4]), s[5] = Z(s[5]), s = J(s), s = K(s), s = Q(s), s = n(s), s.join(" ");
  }
  return r;
})();
const Y = M, tt = /^(?:\d+|\*|\*\/\d+)$/;
function g(t, e, n) {
  const r = t.split(",");
  for (const i of r) {
    const s = parseInt(i, 10);
    if (!Number.isNaN(s) && (s < e || s > n) || !tt.test(i))
      return !1;
  }
  return !0;
}
function et(t) {
  return !g(t, 0, 59);
}
function nt(t) {
  return !g(t, 0, 59);
}
function rt(t) {
  return !g(t, 0, 23);
}
function it(t) {
  return !g(t, 1, 31);
}
function st(t) {
  return !g(t, 1, 12);
}
function ot(t) {
  return !g(t, 0, 7);
}
function ct(t, e) {
  if (et(e[0]))
    throw new Error(`${t[0]} is a invalid expression for second`);
  if (nt(e[1]))
    throw new Error(`${t[1]} is a invalid expression for minute`);
  if (rt(e[2]))
    throw new Error(`${t[2]} is a invalid expression for hour`);
  if (it(e[3]))
    throw new Error(
      `${t[3]} is a invalid expression for day of month`
    );
  if (st(e[4]))
    throw new Error(`${t[4]} is a invalid expression for month`);
  if (ot(e[5]))
    throw new Error(`${t[5]} is a invalid expression for week day`);
}
function at(t) {
  if (typeof t != "string")
    throw new TypeError("pattern must be a string!");
  const e = t.split(" "), n = Y(t).split(" ");
  e.length === 5 && e.unshift("0"), ct(e, n);
}
var D = at;
const ut = D, ft = M;
function m(t, e) {
  return t.indexOf(",") !== -1 ? t.split(",").indexOf(e.toString()) !== -1 : t === e.toString();
}
let lt = class {
  constructor(e, n) {
    ut(e), this.pattern = ft(e), this.timezone = n, this.expressions = this.pattern.split(" "), this.dtf = this.timezone ? new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      fractionalSecondDigits: 3,
      timeZone: this.timezone
    }) : null;
  }
  match(e) {
    e = this.apply(e);
    const n = m(this.expressions[0], e.getSeconds()), r = m(this.expressions[1], e.getMinutes()), i = m(this.expressions[2], e.getHours()), s = m(this.expressions[3], e.getDate()), o = m(this.expressions[4], e.getMonth() + 1), a = m(this.expressions[5], e.getDay());
    return n && r && i && s && o && a;
  }
  apply(e) {
    return this.dtf ? new Date(this.dtf.format(e)) : e;
  }
};
var dt = lt;
const ht = k, mt = dt;
let gt = class extends ht {
  constructor(e, n, r) {
    super(), this.timeMatcher = new mt(e, n), this.autorecover = r;
  }
  start() {
    this.stop();
    let e = process.hrtime(), n = this.timeMatcher.apply(/* @__PURE__ */ new Date());
    const r = () => {
      const s = process.hrtime(e), o = (s[0] * 1e9 + s[1]) / 1e6, a = Math.floor(o / 1e3);
      for (let c = a; c >= 0; c--) {
        const l = new Date((/* @__PURE__ */ new Date()).getTime() - c * 1e3);
        let u = this.timeMatcher.apply(l);
        n.getTime() < u.getTime() && (c === 0 || this.autorecover) && this.timeMatcher.match(l) && (this.emit("scheduled-time-matched", u), u.setMilliseconds(0), n = u);
      }
      e = process.hrtime(), this.timeout = setTimeout(r, 1e3);
    };
    r();
  }
  stop() {
    this.timeout && clearTimeout(this.timeout), this.timeout = null;
  }
};
var pt = gt;
const y = new Uint8Array(256);
let v = y.length;
function O() {
  return v > y.length - 16 && ($.randomFillSync(y), v = 0), y.slice(v, v += 16);
}
const vt = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
function w(t) {
  return typeof t == "string" && vt.test(t);
}
const f = [];
for (let t = 0; t < 256; ++t)
  f.push((t + 256).toString(16).substr(1));
function T(t, e = 0) {
  const n = (f[t[e + 0]] + f[t[e + 1]] + f[t[e + 2]] + f[t[e + 3]] + "-" + f[t[e + 4]] + f[t[e + 5]] + "-" + f[t[e + 6]] + f[t[e + 7]] + "-" + f[t[e + 8]] + f[t[e + 9]] + "-" + f[t[e + 10]] + f[t[e + 11]] + f[t[e + 12]] + f[t[e + 13]] + f[t[e + 14]] + f[t[e + 15]]).toLowerCase();
  if (!w(n))
    throw TypeError("Stringified UUID is invalid");
  return n;
}
let S, x, E = 0, I = 0;
function yt(t, e, n) {
  let r = e && n || 0;
  const i = e || new Array(16);
  t = t || {};
  let s = t.node || S, o = t.clockseq !== void 0 ? t.clockseq : x;
  if (s == null || o == null) {
    const d = t.random || (t.rng || O)();
    s == null && (s = S = [d[0] | 1, d[1], d[2], d[3], d[4], d[5]]), o == null && (o = x = (d[6] << 8 | d[7]) & 16383);
  }
  let a = t.msecs !== void 0 ? t.msecs : Date.now(), c = t.nsecs !== void 0 ? t.nsecs : I + 1;
  const l = a - E + (c - I) / 1e4;
  if (l < 0 && t.clockseq === void 0 && (o = o + 1 & 16383), (l < 0 || a > E) && t.nsecs === void 0 && (c = 0), c >= 1e4)
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  E = a, I = c, x = o, a += 122192928e5;
  const u = ((a & 268435455) * 1e4 + c) % 4294967296;
  i[r++] = u >>> 24 & 255, i[r++] = u >>> 16 & 255, i[r++] = u >>> 8 & 255, i[r++] = u & 255;
  const h = a / 4294967296 * 1e4 & 268435455;
  i[r++] = h >>> 8 & 255, i[r++] = h & 255, i[r++] = h >>> 24 & 15 | 16, i[r++] = h >>> 16 & 255, i[r++] = o >>> 8 | 128, i[r++] = o & 255;
  for (let d = 0; d < 6; ++d)
    i[r + d] = s[d];
  return e || T(i);
}
function b(t) {
  if (!w(t))
    throw TypeError("Invalid UUID");
  let e;
  const n = new Uint8Array(16);
  return n[0] = (e = parseInt(t.slice(0, 8), 16)) >>> 24, n[1] = e >>> 16 & 255, n[2] = e >>> 8 & 255, n[3] = e & 255, n[4] = (e = parseInt(t.slice(9, 13), 16)) >>> 8, n[5] = e & 255, n[6] = (e = parseInt(t.slice(14, 18), 16)) >>> 8, n[7] = e & 255, n[8] = (e = parseInt(t.slice(19, 23), 16)) >>> 8, n[9] = e & 255, n[10] = (e = parseInt(t.slice(24, 36), 16)) / 1099511627776 & 255, n[11] = e / 4294967296 & 255, n[12] = e >>> 24 & 255, n[13] = e >>> 16 & 255, n[14] = e >>> 8 & 255, n[15] = e & 255, n;
}
function kt(t) {
  t = unescape(encodeURIComponent(t));
  const e = [];
  for (let n = 0; n < t.length; ++n)
    e.push(t.charCodeAt(n));
  return e;
}
const wt = "6ba7b810-9dad-11d1-80b4-00c04fd430c8", Tt = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
function j(t, e, n) {
  function r(i, s, o, a) {
    if (typeof i == "string" && (i = kt(i)), typeof s == "string" && (s = b(s)), s.length !== 16)
      throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
    let c = new Uint8Array(16 + i.length);
    if (c.set(s), c.set(i, s.length), c = n(c), c[6] = c[6] & 15 | e, c[8] = c[8] & 63 | 128, o) {
      a = a || 0;
      for (let l = 0; l < 16; ++l)
        o[a + l] = c[l];
      return o;
    }
    return T(c);
  }
  try {
    r.name = t;
  } catch {
  }
  return r.DNS = wt, r.URL = Tt, r;
}
function xt(t) {
  return Array.isArray(t) ? t = Buffer.from(t) : typeof t == "string" && (t = Buffer.from(t, "utf8")), $.createHash("md5").update(t).digest();
}
const Et = j("v3", 48, xt);
function It(t, e, n) {
  t = t || {};
  const r = t.random || (t.rng || O)();
  if (r[6] = r[6] & 15 | 64, r[8] = r[8] & 63 | 128, e) {
    n = n || 0;
    for (let i = 0; i < 16; ++i)
      e[n + i] = r[i];
    return e;
  }
  return T(r);
}
function $t(t) {
  return Array.isArray(t) ? t = Buffer.from(t) : typeof t == "string" && (t = Buffer.from(t, "utf8")), $.createHash("sha1").update(t).digest();
}
const _t = j("v5", 80, $t), St = "00000000-0000-0000-0000-000000000000";
function Mt(t) {
  if (!w(t))
    throw TypeError("Invalid UUID");
  return parseInt(t.substr(14, 1), 16);
}
const Dt = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  NIL: St,
  parse: b,
  stringify: T,
  v1: yt,
  v3: Et,
  v4: It,
  v5: _t,
  validate: w,
  version: Mt
}, Symbol.toStringTag, { value: "Module" })), _ = /* @__PURE__ */ B(Dt), Ot = k, bt = H, jt = pt, Pt = _;
let Nt = class extends Ot {
  constructor(e, n, r) {
    super(), r || (r = {
      scheduled: !0,
      recoverMissedExecutions: !1
    }), this.options = r, this.options.name = this.options.name || Pt.v4(), this._task = new bt(n), this._scheduler = new jt(e, r.timezone, r.recoverMissedExecutions), this._scheduler.on("scheduled-time-matched", (i) => {
      this.now(i);
    }), r.scheduled !== !1 && this._scheduler.start(), r.runOnInit === !0 && this.now("init");
  }
  now(e = "manual") {
    let n = this._task.execute(e);
    this.emit("task-done", n);
  }
  start() {
    this._scheduler.start();
  }
  stop() {
    this._scheduler.stop();
  }
};
var Rt = Nt;
const At = k, Ct = R, { fork: Ut } = A, Bt = _, qt = `${__dirname}/daemon.js`;
let zt = class extends At {
  constructor(e, n, r) {
    super(), r || (r = {
      scheduled: !0,
      recoverMissedExecutions: !1
    }), this.cronExpression = e, this.taskPath = n, this.options = r, this.options.name = this.options.name || Bt.v4(), r.scheduled && this.start();
  }
  start() {
    this.stop(), this.forkProcess = Ut(qt), this.forkProcess.on("message", (n) => {
      switch (n.type) {
        case "task-done":
          this.emit("task-done", n.result);
          break;
      }
    });
    let e = this.options;
    e.scheduled = !0, this.forkProcess.send({
      type: "register",
      path: Ct.resolve(this.taskPath),
      cron: this.cronExpression,
      options: e
    });
  }
  stop() {
    this.forkProcess && this.forkProcess.kill();
  }
  pid() {
    if (this.forkProcess)
      return this.forkProcess.pid;
  }
  isRunning() {
    return !this.forkProcess.killed;
  }
};
var Ht = zt, Wt = (p.scheduledTasks || (p.scheduledTasks = /* @__PURE__ */ new Map()), {
  save: (t) => {
    if (!t.options) {
      const e = _;
      t.options = {}, t.options.name = e.v4();
    }
    p.scheduledTasks.set(t.options.name, t);
  },
  getTasks: () => p.scheduledTasks
});
const Ft = Rt, Lt = Ht, Vt = D, P = Wt;
function Gt(t, e, n) {
  const r = Xt(t, e, n);
  return P.save(r), r;
}
function Xt(t, e, n) {
  return typeof e == "string" ? new Lt(t, e, n) : new Ft(t, e, n);
}
function Zt(t) {
  try {
    return Vt(t), !0;
  } catch {
    return !1;
  }
}
function Jt() {
  return P.getTasks();
}
var N = { schedule: Gt, validate: Zt, getTasks: Jt };
const Kt = /* @__PURE__ */ U(N), ce = /* @__PURE__ */ C({
  __proto__: null,
  default: Kt
}, [N]);
export {
  ce as n
};
