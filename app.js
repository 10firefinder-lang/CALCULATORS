"use strict";

const one = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll('[role="tab"]')];
let active = "basic";
function selectTool(tab, focus = false) {
  active = tab.dataset.tool;
  document.dispatchEvent(new CustomEvent("tool-selected", {detail: active}));
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    one(item.getAttribute("aria-controls")).hidden = !selected;
  }
  if (focus) tab.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTool(tab));
  tab.addEventListener("keydown", (event) => {
    const target = { ArrowLeft: (index + 1) % tabs.length, ArrowRight: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    selectTool(tabs[target], true);
  });
});

const glyph = { "+": "+", "-": "−", "*": "×", "/": "÷" };
const isOp = (token) => Object.hasOwn(glyph, token);
const expressionText = (tokens) => tokens.map((token) => isOp(token) ? glyph[token] : token.replace(/^-/, "−")).join(" ");
const tidy = (number) => Object.is(number, -0) ? 0 : Number(number.toPrecision(14));
const format = (number) => {
  const n = tidy(number);
  if ((Math.abs(n) < 0.000001 && n !== 0) || Math.abs(n) >= 1e14) return n.toExponential().replace("e-", "e−");
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 19 }).format(n);
};
let tokens = [], entry = "", lastFormula = "", finished = false, issue = "";
const history = [];
const display = one("display");
function reset() {
  tokens = [];
  entry = lastFormula = issue = "";
  finished = false;
}
function render() {
  const shown = entry || tokens.at(-2) || "0";
  const value = issue || (finished ? format(Number(shown)) : shown.replace(/^-/, "−"));
  display.textContent = value;
  display.classList.toggle("error", Boolean(issue));
  display.classList.toggle("compact", !issue && value.length > 11);
  display.dir = issue ? "rtl" : "ltr";
  one("formula").textContent = lastFormula || expressionText(tokens);
}
function renderHistory() {
  const list = one("history-list");
  list.replaceChildren();
  list.hidden = !history.length;
  one("empty-history").hidden = Boolean(history.length);
  one("clear-history").hidden = !history.length;
  for (const { formula, result } of history) {
    const row = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    const expr = document.createElement("span");
    const value = document.createElement("strong");
    expr.dir = value.dir = "ltr";
    expr.textContent = formula;
    value.textContent = format(result);
    button.append(expr, value);
    button.addEventListener("click", () => {
      reset();
      entry = String(result);
      lastFormula = formula;
      finished = true;
      render();
    });
    row.append(button);
    list.append(row);
  }
}
one("clear-history").addEventListener("click", () => {
  history.length = 0;
  renderHistory();
  document.querySelector('[data-key="clear"]').focus();
});
function evaluate(items) {
  let total = 0;
  let group = Number(items[0]);
  let sign = 1;
  for (let i = 1; i < items.length; i += 2) {
    const op = items[i], n = Number(items[i + 1]);
    if (op === "/" && n === 0) throw Error("אי אפשר לחלק באפס");
    if (op === "*") group *= n;
    else if (op === "/") group /= n;
    else {
      total += sign * group;
      group = n;
      sign = op === "+" ? 1 : -1;
    }
  }
  const result = total + sign * group;
  if (!Number.isFinite(result)) throw Error("התוצאה מחוץ לטווח");
  return tidy(result);
}
function press(key) {
  if (key === "clear") reset();
  else if (key === "back") {
    if (issue) reset();
    else if (!entry && tokens.length) {
      tokens.pop();
      entry = tokens.pop() || "";
    } else {
      if (finished) {
        lastFormula = "";
        finished = false;
      }
      entry = entry.includes("e") ? "" : entry.slice(0, -1);
    }
  } else if (key === "=") {
    if (issue || finished || !entry || entry === "-") return;
    const items = [...tokens, entry];
    lastFormula = expressionText(items) + " =";
    try {
      const result = evaluate(items);
      entry = String(result);
      history.unshift({ formula: lastFormula, result });
      if (history.length > 15) history.pop();
      renderHistory();
    } catch (error) {
      issue = error.message;
    }
    tokens = [];
    finished = true;
  } else if (isOp(key)) {
    if (issue) return;
    if (entry && entry !== "-") {
      if (tokens.length >= 38) return;
      tokens.push(entry, key);
      entry = lastFormula = "";
      finished = false;
    } else if (tokens.length && entry !== "-" && key !== "-") {
      tokens[tokens.length - 1] = key;
    } else if (key === "-" && !entry) {
      entry = "-";
    } else if (!tokens.length && !entry) tokens = ["0", key];
  } else if (key === "sign" || key === "%") {
    if (issue) return;
    if (finished) lastFormula = "";
    if (key === "sign") entry = entry.startsWith("-") ? entry.slice(1) : "-" + entry;
    else if (entry && entry !== "-") {
      const amount = Number(entry);
      const op = tokens.at(-1);
      let result = amount / 100;
      if (op === "+" || op === "-") {
        try { result = evaluate(tokens.slice(0, -1)) * result; }
        catch (error) { issue = error.message; }
      }
      if (!Number.isFinite(result)) issue = "התוצאה מחוץ לטווח";
      if (!issue) entry = String(tidy(result));
    }
  } else {
    if (finished || issue) reset();
    if (entry.length >= 16) return;
    if (entry.includes("e")) entry = "";
    if (key === ".") {
      if (entry.includes(".")) return;
      if (!entry || entry === "-") entry += "0";
    } else if (entry === "0" || entry === "-0") {
      entry = entry.slice(0, -1);
    }
    entry += key;
  }
  render();
}
document.querySelector(".keypad").addEventListener("click", (event) => {
  const button = event.target.closest("[data-key]");
  if (button) press(button.dataset.key);
});
document.addEventListener("keydown", (event) => {
  if (active !== "basic" || one("tool-dialog")?.open || event.ctrlKey || event.altKey || event.metaKey || event.target.matches("input,select,textarea") || event.target.closest("#library,#calendar,.combo,header")) return;
  const typedOnBasicTab = event.target === one("tab-basic") && entry && !finished;
  if (event.key === "Enter" && event.target.closest('button:not([data-key])') && !typedOnBasicTab) return;
  const key = { Enter: "=", Escape: "clear", Backspace: "back", Delete: "clear", x: "*", X: "*", ",": "." }[event.key] || event.key;
  if (/^[0-9.+*/%=-]$/.test(key) || key === "clear" || key === "back") {
    event.preventDefault();
    press(key);
  }
});

function resultText(id, detailId, value, detail, message = false) {
  const node = one(id);
  node.textContent = value;
  node.classList.toggle("message", message);
  node.classList.toggle("compact", !message && value.length > 12);
  one(detailId).textContent = detail;
}
function updatePercent() {
  const mode = one("percent-mode").value;
  const a = one("percent-a").valueAsNumber;
  const b = one("percent-b").valueAsNumber;
  const labels = { of: ["אחוז (%)", "מספר"], part: ["חלק", "שלם"], change: ["ערך התחלתי", "ערך חדש"] }[mode];
  one("percent-label-a").textContent = labels[0];
  one("percent-label-b").textContent = labels[1];
  const show = (value, detail, message = false) => resultText("percent-result", "percent-detail", value, detail, message);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return show("—", "הזינו שני מספרים כדי לראות תוצאה.");
  if ((mode === "part" && b === 0) || (mode === "change" && a === 0)) return show("אי אפשר לחלק באפס", mode === "part" ? "השלם לא יכול להיות אפס." : "הערך ההתחלתי לא יכול להיות אפס.", true);
  const n = mode === "of" ? a / 100 * b : mode === "part" ? a / b * 100 : ((b - a) / Math.abs(a)) * 100;
  const description = mode === "of" ? "הערך של האחוז מתוך המספר" : mode === "part" ? "החלק באחוזים מתוך השלם" : n > 0 ? "עלייה ביחס לערך ההתחלתי" : n < 0 ? "ירידה ביחס לערך ההתחלתי" : "אין שינוי בין הערכים";
  if (!Number.isFinite(n)) return show("התוצאה מחוץ לטווח", "נסו ערכים קטנים יותר.", true);
  show(format(n) + (mode === "of" ? "" : "%"), description);
}
one("percent-mode").addEventListener("change", updatePercent);
one("percent-a").addEventListener("input", updatePercent);
one("percent-b").addEventListener("input", updatePercent);
updatePercent();

const units = {
  length: [["קילומטר", "ק״מ", 1000], ["מטר", "מ׳", 1], ["סנטימטר", "ס״מ", .01], ["מילימטר", "מ״מ", .001], ["מייל", "mi", 1609.344], ["רגל", "ft", .3048], ["אינץ׳", "in", .0254]],
  mass: [["קילוגרם", "ק״ג", 1], ["גרם", "ג׳", .001], ["מיליגרם", "מ״ג", .000001], ["טון מטרי", "טון", 1000], ["ליברה", "lb", .45359237], ["אונקיה", "oz", .028349523125]],
  temperature: [["צלזיוס", "°C"], ["פרנהייט", "°F"], ["קלווין", "K"]],
  volume: [["ליטר", "ל׳", 1], ["מיליליטר", "מ״ל", .001], ["מטר מעוקב", "מ״ק", 1000], ["גלון אמריקאי", "gal", 3.785411784]],
  time: [["שעה", "שע׳", 3600], ["דקה", "דק׳", 60], ["שנייה", "שנ׳", 1], ["יממה", "יממה", 86400], ["שבוע", "שבוע", 604800]]
};
const category = one("convert-category");
const from = one("convert-from"), to = one("convert-to");
function updateConversion() {
  const number = one("convert-number").valueAsNumber;
  const set = units[category.value];
  const a = +from.value, b = +to.value;
  const show = (value, detail, message = false) => resultText("convert-result", "convert-detail", value, detail, message);
  if (!Number.isFinite(number)) return show("—", "הזינו ערך כדי לראות תוצאה.");
  let n;
  if (category.value === "temperature") {
    if (number < [-273.15, -459.67, 0][a]) return show("מתחת לאפס המוחלט", "הזינו טמפרטורה בטווח האפשרי.", true);
    const celsius = [number, (number - 32) * 5 / 9, number - 273.15][a];
    n = a === b ? number : [celsius, celsius * 9 / 5 + 32, celsius + 273.15][b];
    if (b === 2 && n < 0 && n > -1e-10) n = 0;
  } else {
    n = number * (set[a][2] / set[b][2]);
  }
  if (!Number.isFinite(n)) return show("התוצאה מחוץ לטווח", "נסו ערך קטן יותר.", true);
  show(format(n) + "\u00a0" + set[b][1], `המרת ${format(number)} ${set[a][0]} ל${set[b][0]}`);
}
function loadUnits() {
  for (const field of [from, to]) {
    field.replaceChildren(...units[category.value].map(([name], i) => new Option(name, String(i))));
  }
  to.selectedIndex = 1;
  updateConversion();
}
category.addEventListener("change", loadUnits);
from.addEventListener("change", updateConversion);
to.addEventListener("change", updateConversion);
one("convert-number").addEventListener("input", updateConversion);
one("swap-units").addEventListener("click", () => {
  [from.value, to.value] = [to.value, from.value];
  updateConversion();
});
loadUnits();
