var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import require$$0$1 from "events";
import require$$0 from "node:crypto";
import path from "path";
import require$$1 from "child_process";
import require$$3 from "stream";
import require$$5 from "url";
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
var nodeCron$2 = {};
var inlineScheduledTask = {};
var runner = {};
var createId = {};
var __importDefault$5 = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
  return mod && mod.__esModule ? mod : { "default": mod };
};
Object.defineProperty(createId, "__esModule", { value: true });
createId.createID = createID;
const node_crypto_1 = __importDefault$5(require$$0);
function createID(prefix = "", length = 16) {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = node_crypto_1.default.randomBytes(length);
  const id = Array.from(values, (v) => charset[v % charset.length]).join("");
  return prefix ? `${prefix}-${id}` : id;
}
var logger$1 = {};
Object.defineProperty(logger$1, "__esModule", { value: true });
const levelColors = {
  INFO: "\x1B[36m",
  WARN: "\x1B[33m",
  ERROR: "\x1B[31m",
  DEBUG: "\x1B[35m"
};
const GREEN = "\x1B[32m";
const RESET = "\x1B[0m";
function log$1(level, message, extra) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const color = levelColors[level] ?? "";
  const prefix = `[${timestamp}] [PID: ${process.pid}] ${GREEN}[NODE-CRON]${GREEN} ${color}[${level}]${RESET}`;
  const output = `${prefix} ${message}`;
  switch (level) {
    case "ERROR":
      console.error(output, extra ?? "");
      break;
    case "DEBUG":
      console.debug(output, extra ?? "");
      break;
    case "WARN":
      console.warn(output);
      break;
    case "INFO":
    default:
      console.info(output);
      break;
  }
}
const logger = {
  info(message) {
    log$1("INFO", message);
  },
  warn(message) {
    log$1("WARN", message);
  },
  error(message, err) {
    if (message instanceof Error) {
      log$1("ERROR", message.message, message);
    } else {
      log$1("ERROR", message, err);
    }
  },
  debug(message, err) {
    if (message instanceof Error) {
      log$1("DEBUG", message.message, message);
    } else {
      log$1("DEBUG", message, err);
    }
  }
};
logger$1.default = logger;
var trackedPromise = {};
Object.defineProperty(trackedPromise, "__esModule", { value: true });
trackedPromise.TrackedPromise = void 0;
class TrackedPromise {
  constructor(executor) {
    __publicField(this, "promise");
    __publicField(this, "error");
    __publicField(this, "state");
    __publicField(this, "value");
    this.state = "pending";
    this.promise = new Promise((resolve, reject) => {
      executor((value) => {
        this.state = "fulfilled";
        this.value = value;
        resolve(value);
      }, (error) => {
        this.state = "rejected";
        this.error = error;
        reject(error);
      });
    });
  }
  getPromise() {
    return this.promise;
  }
  getState() {
    return this.state;
  }
  isPending() {
    return this.state === "pending";
  }
  isFulfilled() {
    return this.state === "fulfilled";
  }
  isRejected() {
    return this.state === "rejected";
  }
  getValue() {
    return this.value;
  }
  getError() {
    return this.error;
  }
  then(onfulfilled, onrejected) {
    return this.promise.then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.promise.catch(onrejected);
  }
  finally(onfinally) {
    return this.promise.finally(onfinally);
  }
}
trackedPromise.TrackedPromise = TrackedPromise;
var __importDefault$4 = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
  return mod && mod.__esModule ? mod : { "default": mod };
};
Object.defineProperty(runner, "__esModule", { value: true });
runner.Runner = void 0;
const create_id_1$2 = createId;
const logger_1$2 = __importDefault$4(logger$1);
const tracked_promise_1 = trackedPromise;
function emptyOnFn() {
}
function emptyHookFn() {
  return true;
}
function defaultOnError(date, error) {
  logger_1$2.default.error("Task failed with error!", error);
}
class Runner {
  constructor(timeMatcher2, onMatch, options) {
    __publicField(this, "timeMatcher");
    __publicField(this, "onMatch");
    __publicField(this, "noOverlap");
    __publicField(this, "maxExecutions");
    __publicField(this, "maxRandomDelay");
    __publicField(this, "runCount");
    __publicField(this, "running");
    __publicField(this, "heartBeatTimeout");
    __publicField(this, "onMissedExecution");
    __publicField(this, "onOverlap");
    __publicField(this, "onError");
    __publicField(this, "beforeRun");
    __publicField(this, "onFinished");
    __publicField(this, "onMaxExecutions");
    this.timeMatcher = timeMatcher2;
    this.onMatch = onMatch;
    this.noOverlap = options == void 0 || options.noOverlap === void 0 ? false : options.noOverlap;
    this.maxExecutions = options == null ? void 0 : options.maxExecutions;
    this.maxRandomDelay = (options == null ? void 0 : options.maxRandomDelay) || 0;
    this.onMissedExecution = (options == null ? void 0 : options.onMissedExecution) || emptyOnFn;
    this.onOverlap = (options == null ? void 0 : options.onOverlap) || emptyOnFn;
    this.onError = (options == null ? void 0 : options.onError) || defaultOnError;
    this.onFinished = (options == null ? void 0 : options.onFinished) || emptyHookFn;
    this.beforeRun = (options == null ? void 0 : options.beforeRun) || emptyHookFn;
    this.onMaxExecutions = (options == null ? void 0 : options.onMaxExecutions) || emptyOnFn;
    this.runCount = 0;
    this.running = false;
  }
  start() {
    this.running = true;
    let lastExecution;
    let expectedNextExecution;
    const scheduleNextHeartBeat = (currentDate) => {
      if (this.running) {
        clearTimeout(this.heartBeatTimeout);
        this.heartBeatTimeout = setTimeout(heartBeat, getDelay(this.timeMatcher, currentDate));
      }
    };
    const runTask = (date) => {
      return new Promise(async (resolve) => {
        const execution = {
          id: (0, create_id_1$2.createID)("exec"),
          reason: "scheduled"
        };
        const shouldExecute = await this.beforeRun(date, execution);
        const randomDelay = Math.floor(Math.random() * this.maxRandomDelay);
        if (shouldExecute) {
          setTimeout(async () => {
            try {
              this.runCount++;
              execution.startedAt = /* @__PURE__ */ new Date();
              const result = await this.onMatch(date, execution);
              execution.finishedAt = /* @__PURE__ */ new Date();
              execution.result = result;
              this.onFinished(date, execution);
              if (this.maxExecutions && this.runCount >= this.maxExecutions) {
                this.onMaxExecutions(date);
                this.stop();
              }
            } catch (error) {
              execution.finishedAt = /* @__PURE__ */ new Date();
              execution.error = error;
              this.onError(date, error, execution);
            }
            resolve(true);
          }, randomDelay);
        }
      });
    };
    const checkAndRun = (date) => {
      return new tracked_promise_1.TrackedPromise(async (resolve, reject) => {
        try {
          if (this.timeMatcher.match(date)) {
            await runTask(date);
          }
          resolve(true);
        } catch (err) {
          reject(err);
        }
      });
    };
    const heartBeat = async () => {
      const currentDate = nowWithoutMs();
      if (expectedNextExecution && expectedNextExecution.getTime() < currentDate.getTime()) {
        while (expectedNextExecution.getTime() < currentDate.getTime()) {
          logger_1$2.default.warn(`missed execution at ${expectedNextExecution}! Possible blocking IO or high CPU user at the same process used by node-cron.`);
          expectedNextExecution = this.timeMatcher.getNextMatch(expectedNextExecution);
          runAsync(this.onMissedExecution, expectedNextExecution, defaultOnError);
        }
      }
      if (lastExecution && lastExecution.getState() === "pending") {
        runAsync(this.onOverlap, currentDate, defaultOnError);
        if (this.noOverlap) {
          logger_1$2.default.warn("task still running, new execution blocked by overlap prevention!");
          expectedNextExecution = this.timeMatcher.getNextMatch(currentDate);
          scheduleNextHeartBeat(currentDate);
          return;
        }
      }
      lastExecution = checkAndRun(currentDate);
      expectedNextExecution = this.timeMatcher.getNextMatch(currentDate);
      scheduleNextHeartBeat(currentDate);
    };
    this.heartBeatTimeout = setTimeout(() => {
      heartBeat();
    }, getDelay(this.timeMatcher, nowWithoutMs()));
  }
  nextRun() {
    return this.timeMatcher.getNextMatch(/* @__PURE__ */ new Date());
  }
  stop() {
    this.running = false;
    if (this.heartBeatTimeout) {
      clearTimeout(this.heartBeatTimeout);
      this.heartBeatTimeout = void 0;
    }
  }
  isStarted() {
    return !!this.heartBeatTimeout && this.running;
  }
  isStopped() {
    return !this.isStarted();
  }
  async execute() {
    const date = /* @__PURE__ */ new Date();
    const execution = {
      id: (0, create_id_1$2.createID)("exec"),
      reason: "invoked"
    };
    try {
      const shouldExecute = await this.beforeRun(date, execution);
      if (shouldExecute) {
        this.runCount++;
        execution.startedAt = /* @__PURE__ */ new Date();
        const result = await this.onMatch(date, execution);
        execution.finishedAt = /* @__PURE__ */ new Date();
        execution.result = result;
        this.onFinished(date, execution);
      }
    } catch (error) {
      execution.finishedAt = /* @__PURE__ */ new Date();
      execution.error = error;
      this.onError(date, error, execution);
    }
  }
}
runner.Runner = Runner;
async function runAsync(fn, date, onError) {
  try {
    await fn(date);
  } catch (error) {
    onError(date, error);
  }
}
function getDelay(timeMatcher2, currentDate) {
  const maxDelay = 864e5;
  const nextRun = timeMatcher2.getNextMatch(currentDate);
  const now = /* @__PURE__ */ new Date();
  const delay = nextRun.getTime() - now.getTime();
  if (delay > maxDelay) {
    return maxDelay;
  }
  return Math.max(0, delay);
}
function nowWithoutMs() {
  const date = /* @__PURE__ */ new Date();
  date.setMilliseconds(0);
  return date;
}
var timeMatcher = {};
var convertion = {};
var monthNamesConversion = {};
Object.defineProperty(monthNamesConversion, "__esModule", { value: true });
monthNamesConversion.default = /* @__PURE__ */ (() => {
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
      expression = expression.replace(new RegExp(items[i], "gi"), i + 1);
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
var weekDayNamesConversion = {};
Object.defineProperty(weekDayNamesConversion, "__esModule", { value: true });
weekDayNamesConversion.default = /* @__PURE__ */ (() => {
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
      expression = expression.replace(new RegExp(items[i], "gi"), i);
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
var asteriskToRangeConversion = {};
Object.defineProperty(asteriskToRangeConversion, "__esModule", { value: true });
asteriskToRangeConversion.default = /* @__PURE__ */ (() => {
  function convertAsterisk(expression, replecement) {
    if (expression.indexOf("*") !== -1) {
      return expression.replace("*", replecement);
    }
    return expression;
  }
  function convertAsterisksToRanges(expressions) {
    expressions[0] = convertAsterisk(expressions[0], "0-59");
    expressions[1] = convertAsterisk(expressions[1], "0-59");
    expressions[2] = convertAsterisk(expressions[2], "0-23");
    expressions[3] = convertAsterisk(expressions[3], "1-31");
    expressions[4] = convertAsterisk(expressions[4], "1-12");
    expressions[5] = convertAsterisk(expressions[5], "0-6");
    return expressions;
  }
  return convertAsterisksToRanges;
})();
var rangeConversion = {};
Object.defineProperty(rangeConversion, "__esModule", { value: true });
rangeConversion.default = /* @__PURE__ */ (() => {
  function replaceWithRange(expression, text, init, end, stepTxt) {
    const step = parseInt(stepTxt);
    const numbers = [];
    let last = parseInt(end);
    let first = parseInt(init);
    if (first > last) {
      last = parseInt(init);
      first = parseInt(end);
    }
    for (let i = first; i <= last; i += step) {
      numbers.push(i);
    }
    return expression.replace(new RegExp(text, "i"), numbers.join());
  }
  function convertRange(expression) {
    const rangeRegEx = /(\d+)-(\d+)(\/(\d+)|)/;
    let match = rangeRegEx.exec(expression);
    while (match !== null && match.length > 0) {
      expression = replaceWithRange(expression, match[0], match[1], match[2], match[4] || "1");
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
var __importDefault$3 = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
  return mod && mod.__esModule ? mod : { "default": mod };
};
Object.defineProperty(convertion, "__esModule", { value: true });
const month_names_conversion_1 = __importDefault$3(monthNamesConversion);
const week_day_names_conversion_1 = __importDefault$3(weekDayNamesConversion);
const asterisk_to_range_conversion_1 = __importDefault$3(asteriskToRangeConversion);
const range_conversion_1 = __importDefault$3(rangeConversion);
convertion.default = /* @__PURE__ */ (() => {
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
    let expressions = removeSpaces(`${expression}`).split(" ");
    expressions = appendSeccondExpression(expressions);
    expressions[4] = (0, month_names_conversion_1.default)(expressions[4]);
    expressions[5] = (0, week_day_names_conversion_1.default)(expressions[5]);
    expressions = (0, asterisk_to_range_conversion_1.default)(expressions);
    expressions = (0, range_conversion_1.default)(expressions);
    expressions = normalizeIntegers(expressions);
    return expressions;
  }
  return interprete;
})();
var localizedTime = {};
Object.defineProperty(localizedTime, "__esModule", { value: true });
localizedTime.LocalizedTime = void 0;
class LocalizedTime {
  constructor(date, timezone) {
    __publicField(this, "timestamp");
    __publicField(this, "parts");
    __publicField(this, "timezone");
    this.timestamp = date.getTime();
    this.timezone = timezone;
    this.parts = buildDateParts(date, timezone);
  }
  toDate() {
    return new Date(this.timestamp);
  }
  toISO() {
    const gmt = this.parts.gmt.replace(/^GMT/, "");
    const offset = gmt ? gmt : "Z";
    const pad = (n) => String(n).padStart(2, "0");
    return `${this.parts.year}-${pad(this.parts.month)}-${pad(this.parts.day)}T${pad(this.parts.hour)}:${pad(this.parts.minute)}:${pad(this.parts.second)}.${String(this.parts.milisecond).padStart(3, "0")}` + offset;
  }
  getParts() {
    return this.parts;
  }
  set(field, value) {
    this.parts[field] = value;
    const newDate = new Date(this.toISO());
    this.timestamp = newDate.getTime();
    this.parts = buildDateParts(newDate, this.timezone);
  }
}
localizedTime.LocalizedTime = LocalizedTime;
function buildDateParts(date, timezone) {
  const dftOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false
  };
  if (timezone) {
    dftOptions.timeZone = timezone;
  }
  const dateFormat = new Intl.DateTimeFormat("en-US", dftOptions);
  const parts = dateFormat.formatToParts(date).filter((part) => {
    return part.type !== "literal";
  }).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    day: parseInt(parts.day),
    month: parseInt(parts.month),
    year: parseInt(parts.year),
    hour: parts.hour === "24" ? 0 : parseInt(parts.hour),
    minute: parseInt(parts.minute),
    second: parseInt(parts.second),
    milisecond: date.getMilliseconds(),
    weekday: parts.weekday,
    gmt: getTimezoneGMT(date, timezone)
  };
}
function getTimezoneGMT(date, timezone) {
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  let offsetInMinutes = (utcDate.getTime() - tzDate.getTime()) / 6e4;
  const sign = offsetInMinutes <= 0 ? "+" : "-";
  offsetInMinutes = Math.abs(offsetInMinutes);
  if (offsetInMinutes === 0)
    return "Z";
  const hours = Math.floor(offsetInMinutes / 60).toString().padStart(2, "0");
  const minutes = Math.floor(offsetInMinutes % 60).toString().padStart(2, "0");
  return `GMT${sign}${hours}:${minutes}`;
}
var matcherWalker = {};
var hasRequiredMatcherWalker;
function requireMatcherWalker() {
  if (hasRequiredMatcherWalker) return matcherWalker;
  hasRequiredMatcherWalker = 1;
  var __importDefault2 = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { "default": mod };
  };
  Object.defineProperty(matcherWalker, "__esModule", { value: true });
  matcherWalker.MatcherWalker = void 0;
  const convertion_1 = __importDefault2(convertion);
  const localized_time_12 = localizedTime;
  const time_matcher_12 = requireTimeMatcher();
  const week_day_names_conversion_12 = __importDefault2(weekDayNamesConversion);
  class MatcherWalker {
    constructor(cronExpression, baseDate, timezone) {
      __publicField(this, "cronExpression");
      __publicField(this, "baseDate");
      __publicField(this, "pattern");
      __publicField(this, "expressions");
      __publicField(this, "timeMatcher");
      __publicField(this, "timezone");
      this.cronExpression = cronExpression;
      this.baseDate = baseDate;
      this.timeMatcher = new time_matcher_12.TimeMatcher(cronExpression, timezone);
      this.timezone = timezone;
      this.expressions = (0, convertion_1.default)(cronExpression);
    }
    isMatching() {
      return this.timeMatcher.match(this.baseDate);
    }
    matchNext() {
      const findNextDateIgnoringWeekday = () => {
        const baseDate = new Date(this.baseDate.getTime());
        baseDate.setMilliseconds(0);
        const localTime = new localized_time_12.LocalizedTime(baseDate, this.timezone);
        const dateParts = localTime.getParts();
        const date2 = new localized_time_12.LocalizedTime(localTime.toDate(), this.timezone);
        const seconds = this.expressions[0];
        const nextSecond = availableValue(seconds, dateParts.second);
        if (nextSecond) {
          date2.set("second", nextSecond);
          if (this.timeMatcher.match(date2.toDate())) {
            return date2;
          }
        }
        date2.set("second", seconds[0]);
        const minutes = this.expressions[1];
        const nextMinute = availableValue(minutes, dateParts.minute);
        if (nextMinute) {
          date2.set("minute", nextMinute);
          if (this.timeMatcher.match(date2.toDate())) {
            return date2;
          }
        }
        date2.set("minute", minutes[0]);
        const hours = this.expressions[2];
        const nextHour = availableValue(hours, dateParts.hour);
        if (nextHour) {
          date2.set("hour", nextHour);
          if (this.timeMatcher.match(date2.toDate())) {
            return date2;
          }
        }
        date2.set("hour", hours[0]);
        const days = this.expressions[3];
        const nextDay = availableValue(days, dateParts.day);
        if (nextDay) {
          date2.set("day", nextDay);
          if (this.timeMatcher.match(date2.toDate())) {
            return date2;
          }
        }
        date2.set("day", days[0]);
        const months = this.expressions[4];
        const nextMonth = availableValue(months, dateParts.month);
        if (nextMonth) {
          date2.set("month", nextMonth);
          if (this.timeMatcher.match(date2.toDate())) {
            return date2;
          }
        }
        date2.set("year", date2.getParts().year + 1);
        date2.set("month", months[0]);
        return date2;
      };
      const date = findNextDateIgnoringWeekday();
      const weekdays = this.expressions[5];
      let currentWeekday = parseInt((0, week_day_names_conversion_12.default)(date.getParts().weekday));
      while (!(weekdays.indexOf(currentWeekday) > -1)) {
        date.set("year", date.getParts().year + 1);
        currentWeekday = parseInt((0, week_day_names_conversion_12.default)(date.getParts().weekday));
      }
      return date;
    }
  }
  matcherWalker.MatcherWalker = MatcherWalker;
  function availableValue(values, currentValue) {
    const availableValues = values.sort((a, b) => a - b).filter((s) => s > currentValue);
    if (availableValues.length > 0)
      return availableValues[0];
    return false;
  }
  return matcherWalker;
}
var hasRequiredTimeMatcher;
function requireTimeMatcher() {
  if (hasRequiredTimeMatcher) return timeMatcher;
  hasRequiredTimeMatcher = 1;
  var __importDefault2 = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { "default": mod };
  };
  Object.defineProperty(timeMatcher, "__esModule", { value: true });
  timeMatcher.TimeMatcher = void 0;
  const index_12 = __importDefault2(convertion);
  const week_day_names_conversion_12 = __importDefault2(weekDayNamesConversion);
  const localized_time_12 = localizedTime;
  const matcher_walker_1 = requireMatcherWalker();
  function matchValue(allowedValues, value) {
    return allowedValues.indexOf(value) !== -1;
  }
  class TimeMatcher {
    constructor(pattern, timezone) {
      __publicField(this, "timezone");
      __publicField(this, "pattern");
      __publicField(this, "expressions");
      this.timezone = timezone;
      this.pattern = pattern;
      this.expressions = (0, index_12.default)(pattern);
    }
    match(date) {
      const localizedTime2 = new localized_time_12.LocalizedTime(date, this.timezone);
      const parts = localizedTime2.getParts();
      const runOnSecond = matchValue(this.expressions[0], parts.second);
      const runOnMinute = matchValue(this.expressions[1], parts.minute);
      const runOnHour = matchValue(this.expressions[2], parts.hour);
      const runOnDay = matchValue(this.expressions[3], parts.day);
      const runOnMonth = matchValue(this.expressions[4], parts.month);
      const runOnWeekDay = matchValue(this.expressions[5], parseInt((0, week_day_names_conversion_12.default)(parts.weekday)));
      return runOnSecond && runOnMinute && runOnHour && runOnDay && runOnMonth && runOnWeekDay;
    }
    getNextMatch(date) {
      const walker = new matcher_walker_1.MatcherWalker(this.pattern, date, this.timezone);
      const next = walker.matchNext();
      return next.toDate();
    }
  }
  timeMatcher.TimeMatcher = TimeMatcher;
  return timeMatcher;
}
var stateMachine = {};
Object.defineProperty(stateMachine, "__esModule", { value: true });
stateMachine.StateMachine = void 0;
const allowedTransitions = {
  "stopped": ["stopped", "idle", "destroyed"],
  "idle": ["idle", "running", "stopped", "destroyed"],
  "running": ["running", "idle", "stopped", "destroyed"],
  "destroyed": ["destroyed"]
};
class StateMachine {
  constructor(initial = "stopped") {
    __publicField(this, "state");
    this.state = initial;
  }
  changeState(state) {
    if (allowedTransitions[this.state].includes(state)) {
      this.state = state;
    } else {
      throw new Error(`invalid transition from ${this.state} to ${state}`);
    }
  }
}
stateMachine.StateMachine = StateMachine;
var __importDefault$2 = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
  return mod && mod.__esModule ? mod : { "default": mod };
};
Object.defineProperty(inlineScheduledTask, "__esModule", { value: true });
inlineScheduledTask.InlineScheduledTask = void 0;
const events_1 = __importDefault$2(require$$0$1);
const runner_1 = runner;
const time_matcher_1$1 = requireTimeMatcher();
const create_id_1$1 = createId;
const state_machine_1$1 = stateMachine;
const logger_1$1 = __importDefault$2(logger$1);
const localized_time_1$1 = localizedTime;
let TaskEmitter$1 = class TaskEmitter extends events_1.default {
};
class InlineScheduledTask {
  constructor(cronExpression, taskFn, options) {
    __publicField(this, "emitter");
    __publicField(this, "cronExpression");
    __publicField(this, "timeMatcher");
    __publicField(this, "runner");
    __publicField(this, "id");
    __publicField(this, "name");
    __publicField(this, "stateMachine");
    __publicField(this, "timezone");
    this.emitter = new TaskEmitter$1();
    this.cronExpression = cronExpression;
    this.id = (0, create_id_1$1.createID)("task", 12);
    this.name = (options == null ? void 0 : options.name) || this.id;
    this.timezone = options == null ? void 0 : options.timezone;
    this.timeMatcher = new time_matcher_1$1.TimeMatcher(cronExpression, options == null ? void 0 : options.timezone);
    this.stateMachine = new state_machine_1$1.StateMachine();
    const runnerOptions = {
      timezone: options == null ? void 0 : options.timezone,
      noOverlap: options == null ? void 0 : options.noOverlap,
      maxExecutions: options == null ? void 0 : options.maxExecutions,
      maxRandomDelay: options == null ? void 0 : options.maxRandomDelay,
      beforeRun: (date, execution) => {
        if (execution.reason === "scheduled") {
          this.changeState("running");
        }
        this.emitter.emit("execution:started", this.createContext(date, execution));
        return true;
      },
      onFinished: (date, execution) => {
        if (execution.reason === "scheduled") {
          this.changeState("idle");
        }
        this.emitter.emit("execution:finished", this.createContext(date, execution));
        return true;
      },
      onError: (date, error, execution) => {
        logger_1$1.default.error(error);
        this.emitter.emit("execution:failed", this.createContext(date, execution));
        this.changeState("idle");
      },
      onOverlap: (date) => {
        this.emitter.emit("execution:overlap", this.createContext(date));
      },
      onMissedExecution: (date) => {
        this.emitter.emit("execution:missed", this.createContext(date));
      },
      onMaxExecutions: (date) => {
        this.emitter.emit("execution:maxReached", this.createContext(date));
        this.destroy();
      }
    };
    this.runner = new runner_1.Runner(this.timeMatcher, (date, execution) => {
      return taskFn(this.createContext(date, execution));
    }, runnerOptions);
  }
  getNextRun() {
    if (this.stateMachine.state !== "stopped") {
      return this.runner.nextRun();
    }
    return null;
  }
  changeState(state) {
    if (this.runner.isStarted()) {
      this.stateMachine.changeState(state);
    }
  }
  start() {
    if (this.runner.isStopped()) {
      this.runner.start();
      this.stateMachine.changeState("idle");
      this.emitter.emit("task:started", this.createContext(/* @__PURE__ */ new Date()));
    }
  }
  stop() {
    if (this.runner.isStarted()) {
      this.runner.stop();
      this.stateMachine.changeState("stopped");
      this.emitter.emit("task:stopped", this.createContext(/* @__PURE__ */ new Date()));
    }
  }
  getStatus() {
    return this.stateMachine.state;
  }
  destroy() {
    if (this.stateMachine.state === "destroyed")
      return;
    this.stop();
    this.stateMachine.changeState("destroyed");
    this.emitter.emit("task:destroyed", this.createContext(/* @__PURE__ */ new Date()));
  }
  execute() {
    return new Promise((resolve, reject) => {
      const onFail = (context) => {
        var _a;
        this.off("execution:finished", onFail);
        reject((_a = context.execution) == null ? void 0 : _a.error);
      };
      const onFinished = (context) => {
        var _a;
        this.off("execution:failed", onFail);
        resolve((_a = context.execution) == null ? void 0 : _a.result);
      };
      this.once("execution:finished", onFinished);
      this.once("execution:failed", onFail);
      this.runner.execute();
    });
  }
  on(event, fun) {
    this.emitter.on(event, fun);
  }
  off(event, fun) {
    this.emitter.off(event, fun);
  }
  once(event, fun) {
    this.emitter.once(event, fun);
  }
  createContext(executionDate, execution) {
    const localTime = new localized_time_1$1.LocalizedTime(executionDate, this.timezone);
    const ctx = {
      date: localTime.toDate(),
      dateLocalIso: localTime.toISO(),
      triggeredAt: /* @__PURE__ */ new Date(),
      task: this,
      execution
    };
    return ctx;
  }
}
inlineScheduledTask.InlineScheduledTask = InlineScheduledTask;
var taskRegistry = {};
Object.defineProperty(taskRegistry, "__esModule", { value: true });
taskRegistry.TaskRegistry = void 0;
const tasks = /* @__PURE__ */ new Map();
class TaskRegistry {
  add(task) {
    if (this.has(task.id)) {
      throw Error(`task ${task.id} already registred!`);
    }
    tasks.set(task.id, task);
    task.on("task:destroyed", () => {
      this.remove(task);
    });
  }
  get(taskId) {
    return tasks.get(taskId);
  }
  remove(task) {
    if (this.has(task.id)) {
      task == null ? void 0 : task.destroy();
      tasks.delete(task.id);
    }
  }
  all() {
    return tasks;
  }
  has(taskId) {
    return tasks.has(taskId);
  }
  killAll() {
    tasks.forEach((id) => this.remove(id));
  }
}
taskRegistry.TaskRegistry = TaskRegistry;
var patternValidation = {};
var __importDefault$1 = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
  return mod && mod.__esModule ? mod : { "default": mod };
};
Object.defineProperty(patternValidation, "__esModule", { value: true });
const index_1 = __importDefault$1(convertion);
const validationRegex = /^(?:\d+|\*|\*\/\d+)$/;
function isValidExpression(expression, min, max) {
  const options = expression;
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
    throw new Error(`${patterns[3]} is a invalid expression for day of month`);
  if (isInvalidMonth(executablePatterns[4]))
    throw new Error(`${patterns[4]} is a invalid expression for month`);
  if (isInvalidWeekDay(executablePatterns[5]))
    throw new Error(`${patterns[5]} is a invalid expression for week day`);
}
function validate(pattern) {
  if (typeof pattern !== "string")
    throw new TypeError("pattern must be a string!");
  const patterns = pattern.split(" ");
  const executablePatterns = (0, index_1.default)(pattern);
  if (patterns.length === 5)
    patterns.unshift("0");
  validateFields(patterns, executablePatterns);
}
patternValidation.default = validate;
var backgroundScheduledTask = {};
var __importDefault = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
  return mod && mod.__esModule ? mod : { "default": mod };
};
Object.defineProperty(backgroundScheduledTask, "__esModule", { value: true });
const path_1 = path;
const child_process_1 = require$$1;
const create_id_1 = createId;
const stream_1 = require$$3;
const state_machine_1 = stateMachine;
const localized_time_1 = localizedTime;
const logger_1 = __importDefault(logger$1);
const time_matcher_1 = requireTimeMatcher();
const daemonPath = (0, path_1.resolve)(__dirname, "daemon.js");
class TaskEmitter2 extends stream_1.EventEmitter {
}
class BackgroundScheduledTask {
  constructor(cronExpression, taskPath, options) {
    __publicField(this, "emitter");
    __publicField(this, "id");
    __publicField(this, "name");
    __publicField(this, "cronExpression");
    __publicField(this, "taskPath");
    __publicField(this, "options");
    __publicField(this, "forkProcess");
    __publicField(this, "stateMachine");
    this.cronExpression = cronExpression;
    this.taskPath = taskPath;
    this.options = options;
    this.id = (0, create_id_1.createID)("task");
    this.name = (options == null ? void 0 : options.name) || this.id;
    this.emitter = new TaskEmitter2();
    this.stateMachine = new state_machine_1.StateMachine("stopped");
    this.on("task:stopped", () => {
      var _a;
      (_a = this.forkProcess) == null ? void 0 : _a.kill();
      this.forkProcess = void 0;
      this.stateMachine.changeState("stopped");
    });
    this.on("task:destroyed", () => {
      var _a;
      (_a = this.forkProcess) == null ? void 0 : _a.kill();
      this.forkProcess = void 0;
      this.stateMachine.changeState("destroyed");
    });
  }
  getNextRun() {
    var _a;
    if (this.stateMachine.state !== "stopped") {
      const timeMatcher2 = new time_matcher_1.TimeMatcher(this.cronExpression, (_a = this.options) == null ? void 0 : _a.timezone);
      return timeMatcher2.getNextMatch(/* @__PURE__ */ new Date());
    }
    return null;
  }
  start() {
    return new Promise((resolve, reject) => {
      if (this.forkProcess) {
        return resolve(void 0);
      }
      const timeout = setTimeout(() => {
        reject(new Error("Start operation timed out"));
      }, 5e3);
      try {
        this.forkProcess = (0, child_process_1.fork)(daemonPath);
        this.forkProcess.on("error", (err) => {
          clearTimeout(timeout);
          reject(new Error(`Error on daemon: ${err.message}`));
        });
        this.forkProcess.on("exit", (code, signal) => {
          if (code !== 0 && signal !== "SIGTERM") {
            const erro = new Error(`node-cron daemon exited with code ${code || signal}`);
            logger_1.default.error(erro);
            clearTimeout(timeout);
            reject(erro);
          }
        });
        this.forkProcess.on("message", (message) => {
          var _a, _b, _c, _d, _e, _f;
          if (message.jsonError) {
            if ((_a = message.context) == null ? void 0 : _a.execution) {
              message.context.execution.error = deserializeError(message.jsonError);
              delete message.jsonError;
            }
          }
          if ((_c = (_b = message.context) == null ? void 0 : _b.task) == null ? void 0 : _c.state) {
            this.stateMachine.changeState((_e = (_d = message.context) == null ? void 0 : _d.task) == null ? void 0 : _e.state);
          }
          if (message.context) {
            const execution = (_f = message.context) == null ? void 0 : _f.execution;
            execution == null ? true : delete execution.hasError;
            const context = this.createContext(new Date(message.context.date), execution);
            this.emitter.emit(message.event, context);
          }
        });
        this.once("task:started", () => {
          this.stateMachine.changeState("idle");
          clearTimeout(timeout);
          resolve(void 0);
        });
        this.forkProcess.send({
          command: "task:start",
          path: this.taskPath,
          cron: this.cronExpression,
          options: this.options
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.forkProcess) {
        return resolve(void 0);
      }
      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId);
        reject(new Error("Stop operation timed out"));
      }, 5e3);
      const cleanupAndResolve = () => {
        clearTimeout(timeoutId);
        this.off("task:stopped", onStopped);
        this.forkProcess = void 0;
        resolve(void 0);
      };
      const onStopped = () => {
        cleanupAndResolve();
      };
      this.once("task:stopped", onStopped);
      this.forkProcess.send({
        command: "task:stop"
      });
    });
  }
  getStatus() {
    return this.stateMachine.state;
  }
  destroy() {
    return new Promise((resolve, reject) => {
      if (!this.forkProcess) {
        return resolve(void 0);
      }
      const timeoutId = setTimeout(() => {
        clearTimeout(timeoutId);
        reject(new Error("Destroy operation timed out"));
      }, 5e3);
      const onDestroy = () => {
        clearTimeout(timeoutId);
        this.off("task:destroyed", onDestroy);
        resolve(void 0);
      };
      this.once("task:destroyed", onDestroy);
      this.forkProcess.send({
        command: "task:destroy"
      });
    });
  }
  execute() {
    return new Promise((resolve, reject) => {
      if (!this.forkProcess) {
        return reject(new Error("Cannot execute background task because it hasn't been started yet. Please initialize the task using the start() method before attempting to execute it."));
      }
      const timeoutId = setTimeout(() => {
        cleanupListeners();
        reject(new Error("Execution timeout exceeded"));
      }, 5e3);
      const cleanupListeners = () => {
        clearTimeout(timeoutId);
        this.off("execution:finished", onFinished);
        this.off("execution:failed", onFail);
      };
      const onFinished = (context) => {
        var _a;
        cleanupListeners();
        resolve((_a = context.execution) == null ? void 0 : _a.result);
      };
      const onFail = (context) => {
        var _a;
        cleanupListeners();
        reject(((_a = context.execution) == null ? void 0 : _a.error) || new Error("Execution failed without specific error"));
      };
      this.once("execution:finished", onFinished);
      this.once("execution:failed", onFail);
      this.forkProcess.send({
        command: "task:execute"
      });
    });
  }
  on(event, fun) {
    this.emitter.on(event, fun);
  }
  off(event, fun) {
    this.emitter.off(event, fun);
  }
  once(event, fun) {
    this.emitter.once(event, fun);
  }
  createContext(executionDate, execution) {
    var _a;
    const localTime = new localized_time_1.LocalizedTime(executionDate, (_a = this.options) == null ? void 0 : _a.timezone);
    const ctx = {
      date: localTime.toDate(),
      dateLocalIso: localTime.toISO(),
      triggeredAt: /* @__PURE__ */ new Date(),
      task: this,
      execution
    };
    return ctx;
  }
}
function deserializeError(str) {
  const data = JSON.parse(str);
  const Err = globalThis[data.name] || Error;
  const err = new Err(data.message);
  if (data.stack) {
    err.stack = data.stack;
  }
  Object.keys(data).forEach((key) => {
    if (!["name", "message", "stack"].includes(key)) {
      err[key] = data[key];
    }
  });
  return err;
}
backgroundScheduledTask.default = BackgroundScheduledTask;
(function(exports$1) {
  var __importDefault2 = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { "default": mod };
  };
  Object.defineProperty(exports$1, "__esModule", { value: true });
  exports$1.nodeCron = exports$1.getTask = exports$1.getTasks = void 0;
  exports$1.schedule = schedule;
  exports$1.createTask = createTask;
  exports$1.solvePath = solvePath;
  exports$1.validate = validate2;
  const inline_scheduled_task_1 = inlineScheduledTask;
  const task_registry_1 = taskRegistry;
  const pattern_validation_1 = __importDefault2(patternValidation);
  const background_scheduled_task_1 = __importDefault2(backgroundScheduledTask);
  const path_12 = __importDefault2(path);
  const url_1 = require$$5;
  const registry = new task_registry_1.TaskRegistry();
  function schedule(expression, func, options) {
    const task = createTask(expression, func, options);
    task.start();
    return task;
  }
  function createTask(expression, func, options) {
    let task;
    if (func instanceof Function) {
      task = new inline_scheduled_task_1.InlineScheduledTask(expression, func, options);
    } else {
      const taskPath = solvePath(func);
      task = new background_scheduled_task_1.default(expression, taskPath, options);
    }
    registry.add(task);
    return task;
  }
  function solvePath(filePath) {
    var _a;
    if (path_12.default.isAbsolute(filePath))
      return (0, url_1.pathToFileURL)(filePath).href;
    if (filePath.startsWith("file://"))
      return filePath;
    const stackLines = (_a = new Error().stack) == null ? void 0 : _a.split("\n");
    if (stackLines) {
      stackLines == null ? void 0 : stackLines.shift();
      const callerLine = stackLines == null ? void 0 : stackLines.find((line) => {
        return line.indexOf(__filename) === -1;
      });
      const match = callerLine == null ? void 0 : callerLine.match(/(file:\/\/)?(((\/?)(\w:))?([/\\].+)):\d+:\d+/);
      if (match) {
        const dir = `${match[5] ?? ""}${path_12.default.dirname(match[6])}`;
        return (0, url_1.pathToFileURL)(path_12.default.resolve(dir, filePath)).href;
      }
    }
    throw new Error(`Could not locate task file ${filePath}`);
  }
  function validate2(expression) {
    try {
      (0, pattern_validation_1.default)(expression);
      return true;
    } catch (e) {
      return false;
    }
  }
  exports$1.getTasks = registry.all;
  exports$1.getTask = registry.get;
  exports$1.nodeCron = {
    schedule,
    createTask,
    validate: validate2,
    getTasks: exports$1.getTasks,
    getTask: exports$1.getTask
  };
  exports$1.default = exports$1.nodeCron;
})(nodeCron$2);
const nodeCron = /* @__PURE__ */ getDefaultExportFromCjs(nodeCron$2);
const nodeCron$1 = /* @__PURE__ */ _mergeNamespaces({
  __proto__: null,
  default: nodeCron
}, [nodeCron$2]);
export {
  nodeCron$1 as n
};
