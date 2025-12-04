import require$$0$1 from "events";
import crypto from "crypto";
import path$1 from "path";
import require$$2 from "child_process";
function _mergeNamespaces(n, m) {
  for (var i = 0; i < m.length; i++) {
    const e = m[i];
    if (typeof e !== "string" && !Array.isArray(e)) {
      for (const k in e) {
        if (k !== "default" && !(k in n)) {
          const d = Object.getOwnPropertyDescriptor(e, k);
          if (d) {
            Object.defineProperty(n, k, d.get ? d : {
              enumerable: true,
              get: () => e[k]
            });
          }
        }
      }
    }
  }
  return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }));
}
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
  if (typeof f == "function") {
    var a = function a2() {
      if (this instanceof a2) {
        return Reflect.construct(f, arguments, this.constructor);
      }
      return f.apply(this, arguments);
    };
    a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, "__esModule", { value: true });
  Object.keys(n).forEach(function(k) {
    var d = Object.getOwnPropertyDescriptor(n, k);
    Object.defineProperty(a, k, d.get ? d : {
      enumerable: true,
      get: function() {
        return n[k];
      }
    });
  });
  return a;
}
const EventEmitter$3 = require$$0$1;
let Task$1 = class Task extends EventEmitter$3 {
  constructor(execution) {
    super();
    if (typeof execution !== "function") {
      throw "execution must be a function";
    }
    this._execution = execution;
  }
  execute(now) {
    let exec;
    try {
      exec = this._execution(now);
    } catch (error) {
      return this.emit("task-failed", error);
    }
    if (exec instanceof Promise) {
      return exec.then(() => this.emit("task-finished")).catch((error) => this.emit("task-failed", error));
    } else {
      this.emit("task-finished");
      return exec;
    }
  }
};
var task = Task$1;
var monthNamesConversion$1 = /* @__PURE__ */ (() => {
  const months = [
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
  ];
  const shortMonths = [
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
  function convertMonthName(expression, items) {
    for (let i = 0; i < items.length; i++) {
      expression = expression.replace(new RegExp(items[i], "gi"), parseInt(i, 10) + 1);
    }
    return expression;
  }
  function interprete(monthExpression) {
    monthExpression = convertMonthName(monthExpression, months);
    monthExpression = convertMonthName(monthExpression, shortMonths);
    return monthExpression;
  }
  return interprete;
})();
var weekDayNamesConversion$1 = /* @__PURE__ */ (() => {
  const weekDays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ];
  const shortWeekDays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  function convertWeekDayName(expression, items) {
    for (let i = 0; i < items.length; i++) {
      expression = expression.replace(new RegExp(items[i], "gi"), parseInt(i, 10));
    }
    return expression;
  }
  function convertWeekDays(expression) {
    expression = expression.replace("7", "0");
    expression = convertWeekDayName(expression, weekDays);
    return convertWeekDayName(expression, shortWeekDays);
  }
  return convertWeekDays;
})();
var asteriskToRangeConversion = /* @__PURE__ */ (() => {
  function convertAsterisk(expression, replecement) {
    if (expression.indexOf("*") !== -1) {
      return expression.replace("*", replecement);
    }
    return expression;
  }
  function convertAsterisksToRanges2(expressions) {
    expressions[0] = convertAsterisk(expressions[0], "0-59");
    expressions[1] = convertAsterisk(expressions[1], "0-59");
    expressions[2] = convertAsterisk(expressions[2], "0-23");
    expressions[3] = convertAsterisk(expressions[3], "1-31");
    expressions[4] = convertAsterisk(expressions[4], "1-12");
    expressions[5] = convertAsterisk(expressions[5], "0-6");
    return expressions;
  }
  return convertAsterisksToRanges2;
})();
var rangeConversion = /* @__PURE__ */ (() => {
  function replaceWithRange(expression, text, init, end) {
    const numbers = [];
    let last = parseInt(end);
    let first = parseInt(init);
    if (first > last) {
      last = parseInt(init);
      first = parseInt(end);
    }
    for (let i = first; i <= last; i++) {
      numbers.push(i);
    }
    return expression.replace(new RegExp(text, "i"), numbers.join());
  }
  function convertRange(expression) {
    const rangeRegEx = /(\d+)-(\d+)/;
    let match = rangeRegEx.exec(expression);
    while (match !== null && match.length > 0) {
      expression = replaceWithRange(expression, match[0], match[1], match[2]);
      match = rangeRegEx.exec(expression);
    }
    return expression;
  }
  function convertAllRanges(expressions) {
    for (let i = 0; i < expressions.length; i++) {
      expressions[i] = convertRange(expressions[i]);
    }
    return expressions;
  }
  return convertAllRanges;
})();
var stepValuesConversion = /* @__PURE__ */ (() => {
  function convertSteps2(expressions) {
    var stepValuePattern = /^(.+)\/(\w+)$/;
    for (var i = 0; i < expressions.length; i++) {
      var match = stepValuePattern.exec(expressions[i]);
      var isStepValue = match !== null && match.length > 0;
      if (isStepValue) {
        var baseDivider = match[2];
        if (isNaN(baseDivider)) {
          throw baseDivider + " is not a valid step value";
        }
        var values = match[1].split(",");
        var stepValues = [];
        var divider = parseInt(baseDivider, 10);
        for (var j = 0; j <= values.length; j++) {
          var value = parseInt(values[j], 10);
          if (value % divider === 0) {
            stepValues.push(value);
          }
        }
        expressions[i] = stepValues.join(",");
      }
    }
    return expressions;
  }
  return convertSteps2;
})();
const monthNamesConversion = monthNamesConversion$1;
const weekDayNamesConversion = weekDayNamesConversion$1;
const convertAsterisksToRanges = asteriskToRangeConversion;
const convertRanges = rangeConversion;
const convertSteps = stepValuesConversion;
var convertExpression$2 = /* @__PURE__ */ (() => {
  function appendSeccondExpression(expressions) {
    if (expressions.length === 5) {
      return ["0"].concat(expressions);
    }
    return expressions;
  }
  function removeSpaces(str) {
    return str.replace(/\s{2,}/g, " ").trim();
  }
  function normalizeIntegers(expressions) {
    for (let i = 0; i < expressions.length; i++) {
      const numbers = expressions[i].split(",");
      for (let j = 0; j < numbers.length; j++) {
        numbers[j] = parseInt(numbers[j]);
      }
      expressions[i] = numbers;
    }
    return expressions;
  }
  function interprete(expression) {
    let expressions = removeSpaces(expression).split(" ");
    expressions = appendSeccondExpression(expressions);
    expressions[4] = monthNamesConversion(expressions[4]);
    expressions[5] = weekDayNamesConversion(expressions[5]);
    expressions = convertAsterisksToRanges(expressions);
    expressions = convertRanges(expressions);
    expressions = convertSteps(expressions);
    expressions = normalizeIntegers(expressions);
    return expressions.join(" ");
  }
  return interprete;
})();
const convertExpression$1 = convertExpression$2;
const validationRegex = /^(?:\d+|\*|\*\/\d+)$/;
function isValidExpression(expression, min, max) {
  const options = expression.split(",");
  for (const option of options) {
    const optionAsInt = parseInt(option, 10);
    if (!Number.isNaN(optionAsInt) && (optionAsInt < min || optionAsInt > max) || !validationRegex.test(option))
      return false;
  }
  return true;
}
function isInvalidSecond(expression) {
  return !isValidExpression(expression, 0, 59);
}
function isInvalidMinute(expression) {
  return !isValidExpression(expression, 0, 59);
}
function isInvalidHour(expression) {
  return !isValidExpression(expression, 0, 23);
}
function isInvalidDayOfMonth(expression) {
  return !isValidExpression(expression, 1, 31);
}
function isInvalidMonth(expression) {
  return !isValidExpression(expression, 1, 12);
}
function isInvalidWeekDay(expression) {
  return !isValidExpression(expression, 0, 7);
}
function validateFields(patterns, executablePatterns) {
  if (isInvalidSecond(executablePatterns[0]))
    throw new Error(`${patterns[0]} is a invalid expression for second`);
  if (isInvalidMinute(executablePatterns[1]))
    throw new Error(`${patterns[1]} is a invalid expression for minute`);
  if (isInvalidHour(executablePatterns[2]))
    throw new Error(`${patterns[2]} is a invalid expression for hour`);
  if (isInvalidDayOfMonth(executablePatterns[3]))
    throw new Error(
      `${patterns[3]} is a invalid expression for day of month`
    );
  if (isInvalidMonth(executablePatterns[4]))
    throw new Error(`${patterns[4]} is a invalid expression for month`);
  if (isInvalidWeekDay(executablePatterns[5]))
    throw new Error(`${patterns[5]} is a invalid expression for week day`);
}
function validate$2(pattern) {
  if (typeof pattern !== "string")
    throw new TypeError("pattern must be a string!");
  const patterns = pattern.split(" ");
  const executablePatterns = convertExpression$1(pattern).split(" ");
  if (patterns.length === 5) patterns.unshift("0");
  validateFields(patterns, executablePatterns);
}
var patternValidation = validate$2;
const validatePattern = patternValidation;
const convertExpression = convertExpression$2;
function matchPattern(pattern, value) {
  if (pattern.indexOf(",") !== -1) {
    const patterns = pattern.split(",");
    return patterns.indexOf(value.toString()) !== -1;
  }
  return pattern === value.toString();
}
let TimeMatcher$1 = class TimeMatcher {
  constructor(pattern, timezone) {
    validatePattern(pattern);
    this.pattern = convertExpression(pattern);
    this.timezone = timezone;
    this.expressions = this.pattern.split(" ");
    this.dtf = this.timezone ? new Intl.DateTimeFormat("en-US", {
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
  match(date) {
    date = this.apply(date);
    const runOnSecond = matchPattern(this.expressions[0], date.getSeconds());
    const runOnMinute = matchPattern(this.expressions[1], date.getMinutes());
    const runOnHour = matchPattern(this.expressions[2], date.getHours());
    const runOnDay = matchPattern(this.expressions[3], date.getDate());
    const runOnMonth = matchPattern(this.expressions[4], date.getMonth() + 1);
    const runOnWeekDay = matchPattern(this.expressions[5], date.getDay());
    return runOnSecond && runOnMinute && runOnHour && runOnDay && runOnMonth && runOnWeekDay;
  }
  apply(date) {
    if (this.dtf) {
      return new Date(this.dtf.format(date));
    }
    return date;
  }
};
var timeMatcher = TimeMatcher$1;
const EventEmitter$2 = require$$0$1;
const TimeMatcher2 = timeMatcher;
let Scheduler$1 = class Scheduler extends EventEmitter$2 {
  constructor(pattern, timezone, autorecover) {
    super();
    this.timeMatcher = new TimeMatcher2(pattern, timezone);
    this.autorecover = autorecover;
  }
  start() {
    this.stop();
    let lastCheck = process.hrtime();
    let lastExecution = this.timeMatcher.apply(/* @__PURE__ */ new Date());
    const matchTime = () => {
      const delay = 1e3;
      const elapsedTime = process.hrtime(lastCheck);
      const elapsedMs = (elapsedTime[0] * 1e9 + elapsedTime[1]) / 1e6;
      const missedExecutions = Math.floor(elapsedMs / 1e3);
      for (let i = missedExecutions; i >= 0; i--) {
        const date = new Date((/* @__PURE__ */ new Date()).getTime() - i * 1e3);
        let date_tmp = this.timeMatcher.apply(date);
        if (lastExecution.getTime() < date_tmp.getTime() && (i === 0 || this.autorecover) && this.timeMatcher.match(date)) {
          this.emit("scheduled-time-matched", date_tmp);
          date_tmp.setMilliseconds(0);
          lastExecution = date_tmp;
        }
      }
      lastCheck = process.hrtime();
      this.timeout = setTimeout(matchTime, delay);
    };
    matchTime();
  }
  stop() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = null;
  }
};
var scheduler = Scheduler$1;
const rnds8Pool = new Uint8Array(256);
let poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    crypto.randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}
const REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
function validate$1(uuid2) {
  return typeof uuid2 === "string" && REGEX.test(uuid2);
}
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).substr(1));
}
function stringify(arr, offset = 0) {
  const uuid2 = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
  if (!validate$1(uuid2)) {
    throw TypeError("Stringified UUID is invalid");
  }
  return uuid2;
}
let _nodeId;
let _clockseq;
let _lastMSecs = 0;
let _lastNSecs = 0;
function v1(options, buf, offset) {
  let i = buf && offset || 0;
  const b = buf || new Array(16);
  options = options || {};
  let node = options.node || _nodeId;
  let clockseq = options.clockseq !== void 0 ? options.clockseq : _clockseq;
  if (node == null || clockseq == null) {
    const seedBytes = options.random || (options.rng || rng)();
    if (node == null) {
      node = _nodeId = [seedBytes[0] | 1, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }
    if (clockseq == null) {
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 16383;
    }
  }
  let msecs = options.msecs !== void 0 ? options.msecs : Date.now();
  let nsecs = options.nsecs !== void 0 ? options.nsecs : _lastNSecs + 1;
  const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 1e4;
  if (dt < 0 && options.clockseq === void 0) {
    clockseq = clockseq + 1 & 16383;
  }
  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === void 0) {
    nsecs = 0;
  }
  if (nsecs >= 1e4) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }
  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq;
  msecs += 122192928e5;
  const tl = ((msecs & 268435455) * 1e4 + nsecs) % 4294967296;
  b[i++] = tl >>> 24 & 255;
  b[i++] = tl >>> 16 & 255;
  b[i++] = tl >>> 8 & 255;
  b[i++] = tl & 255;
  const tmh = msecs / 4294967296 * 1e4 & 268435455;
  b[i++] = tmh >>> 8 & 255;
  b[i++] = tmh & 255;
  b[i++] = tmh >>> 24 & 15 | 16;
  b[i++] = tmh >>> 16 & 255;
  b[i++] = clockseq >>> 8 | 128;
  b[i++] = clockseq & 255;
  for (let n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }
  return buf || stringify(b);
}
function parse(uuid2) {
  if (!validate$1(uuid2)) {
    throw TypeError("Invalid UUID");
  }
  let v;
  const arr = new Uint8Array(16);
  arr[0] = (v = parseInt(uuid2.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 255;
  arr[2] = v >>> 8 & 255;
  arr[3] = v & 255;
  arr[4] = (v = parseInt(uuid2.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 255;
  arr[6] = (v = parseInt(uuid2.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 255;
  arr[8] = (v = parseInt(uuid2.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 255;
  arr[10] = (v = parseInt(uuid2.slice(24, 36), 16)) / 1099511627776 & 255;
  arr[11] = v / 4294967296 & 255;
  arr[12] = v >>> 24 & 255;
  arr[13] = v >>> 16 & 255;
  arr[14] = v >>> 8 & 255;
  arr[15] = v & 255;
  return arr;
}
function stringToBytes(str) {
  str = unescape(encodeURIComponent(str));
  const bytes = [];
  for (let i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }
  return bytes;
}
const DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
function v35(name, version2, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    if (typeof value === "string") {
      value = stringToBytes(value);
    }
    if (typeof namespace === "string") {
      namespace = parse(namespace);
    }
    if (namespace.length !== 16) {
      throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
    }
    let bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 15 | version2;
    bytes[8] = bytes[8] & 63 | 128;
    if (buf) {
      offset = offset || 0;
      for (let i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }
      return buf;
    }
    return stringify(bytes);
  }
  try {
    generateUUID.name = name;
  } catch (err) {
  }
  generateUUID.DNS = DNS;
  generateUUID.URL = URL;
  return generateUUID;
}
function md5(bytes) {
  if (Array.isArray(bytes)) {
    bytes = Buffer.from(bytes);
  } else if (typeof bytes === "string") {
    bytes = Buffer.from(bytes, "utf8");
  }
  return crypto.createHash("md5").update(bytes).digest();
}
const v3 = v35("v3", 48, md5);
function v4(options, buf, offset) {
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return stringify(rnds);
}
function sha1(bytes) {
  if (Array.isArray(bytes)) {
    bytes = Buffer.from(bytes);
  } else if (typeof bytes === "string") {
    bytes = Buffer.from(bytes, "utf8");
  }
  return crypto.createHash("sha1").update(bytes).digest();
}
const v5 = v35("v5", 80, sha1);
const nil = "00000000-0000-0000-0000-000000000000";
function version(uuid2) {
  if (!validate$1(uuid2)) {
    throw TypeError("Invalid UUID");
  }
  return parseInt(uuid2.substr(14, 1), 16);
}
const esmNode = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  NIL: nil,
  parse,
  stringify,
  v1,
  v3,
  v4,
  v5,
  validate: validate$1,
  version
}, Symbol.toStringTag, { value: "Module" }));
const require$$0 = /* @__PURE__ */ getAugmentedNamespace(esmNode);
const EventEmitter$1 = require$$0$1;
const Task2 = task;
const Scheduler2 = scheduler;
const uuid$1 = require$$0;
let ScheduledTask$1 = class ScheduledTask extends EventEmitter$1 {
  constructor(cronExpression, func, options) {
    super();
    if (!options) {
      options = {
        scheduled: true,
        recoverMissedExecutions: false
      };
    }
    this.options = options;
    this.options.name = this.options.name || uuid$1.v4();
    this._task = new Task2(func);
    this._scheduler = new Scheduler2(cronExpression, options.timezone, options.recoverMissedExecutions);
    this._scheduler.on("scheduled-time-matched", (now) => {
      this.now(now);
    });
    if (options.scheduled !== false) {
      this._scheduler.start();
    }
    if (options.runOnInit === true) {
      this.now("init");
    }
  }
  now(now = "manual") {
    let result = this._task.execute(now);
    this.emit("task-done", result);
  }
  start() {
    this._scheduler.start();
  }
  stop() {
    this._scheduler.stop();
  }
};
var scheduledTask = ScheduledTask$1;
const EventEmitter = require$$0$1;
const path = path$1;
const { fork } = require$$2;
const uuid = require$$0;
const daemonPath = `${__dirname}/daemon.js`;
let BackgroundScheduledTask$1 = class BackgroundScheduledTask extends EventEmitter {
  constructor(cronExpression, taskPath, options) {
    super();
    if (!options) {
      options = {
        scheduled: true,
        recoverMissedExecutions: false
      };
    }
    this.cronExpression = cronExpression;
    this.taskPath = taskPath;
    this.options = options;
    this.options.name = this.options.name || uuid.v4();
    if (options.scheduled) {
      this.start();
    }
  }
  start() {
    this.stop();
    this.forkProcess = fork(daemonPath);
    this.forkProcess.on("message", (message) => {
      switch (message.type) {
        case "task-done":
          this.emit("task-done", message.result);
          break;
      }
    });
    let options = this.options;
    options.scheduled = true;
    this.forkProcess.send({
      type: "register",
      path: path.resolve(this.taskPath),
      cron: this.cronExpression,
      options
    });
  }
  stop() {
    if (this.forkProcess) {
      this.forkProcess.kill();
    }
  }
  pid() {
    if (this.forkProcess) {
      return this.forkProcess.pid;
    }
  }
  isRunning() {
    return !this.forkProcess.killed;
  }
};
var backgroundScheduledTask = BackgroundScheduledTask$1;
var storage$1 = (() => {
  if (!commonjsGlobal.scheduledTasks) {
    commonjsGlobal.scheduledTasks = /* @__PURE__ */ new Map();
  }
  return {
    save: (task2) => {
      if (!task2.options) {
        const uuid2 = require$$0;
        task2.options = {};
        task2.options.name = uuid2.v4();
      }
      commonjsGlobal.scheduledTasks.set(task2.options.name, task2);
    },
    getTasks: () => {
      return commonjsGlobal.scheduledTasks;
    }
  };
})();
const ScheduledTask2 = scheduledTask;
const BackgroundScheduledTask2 = backgroundScheduledTask;
const validation = patternValidation;
const storage = storage$1;
function schedule(expression, func, options) {
  const task2 = createTask(expression, func, options);
  storage.save(task2);
  return task2;
}
function createTask(expression, func, options) {
  if (typeof func === "string")
    return new BackgroundScheduledTask2(expression, func, options);
  return new ScheduledTask2(expression, func, options);
}
function validate(expression) {
  try {
    validation(expression);
    return true;
  } catch (_) {
    return false;
  }
}
function getTasks() {
  return storage.getTasks();
}
var nodeCron = { schedule, validate, getTasks };
const nodeCron_default = /* @__PURE__ */ getDefaultExportFromCjs(nodeCron);
const nodeCron$1 = /* @__PURE__ */ _mergeNamespaces({
  __proto__: null,
  default: nodeCron_default
}, [nodeCron]);
export {
  nodeCron$1 as n
};
