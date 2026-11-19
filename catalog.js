"use strict";

(() => {
  const groups = [...calculatorCatalog,...dailyCatalog,...stemCatalog,...lawCatalog];
  const sharedLevels = {
    power:"middle",root:"middle",log:"high",fraction:"elementary",mean:"elementary",median:"middle",deviation:"high",gcd:"elementary",combinations:"high",quadratic:"high",
    circle:"middle",rectangle:"elementary",triangle:"elementary",hypotenuse:"middle",trapezoid:"middle",sector:"high",cylinder:"middle",sphere:"high",cone:"high",points:"middle",
    ohm:"high",kinetic:"high",density:"middle",frequency:"high",waves:"high",probability:"high"
  };
  const tools = groups.flatMap(group => group.tools.map(tool => ({...tool, group, daily:!group.id.startsWith("stem-"), level:tool.level || sharedLevels[tool.id]})));
  one("library-total").textContent = tools.length;
  one("site-tool-total").textContent = `${tools.length + document.querySelectorAll('[role="tab"]').length} `;
  const grid = one("catalog-grid");
  const modes = [...one("catalog-modes").querySelectorAll("button")];
  const category = one("catalog-category");
  const level = one("catalog-level");
  const search = one("catalog-search");
  const resetSearch = one("catalog-reset");
  const dialog = one("tool-dialog");
  const form = one("catalog-form");
  const fields = one("dialog-fields");
  const out = one("dialog-result");
  const currency = new Intl.NumberFormat("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
  let mode = "all";
  let selected, origin;

  const el = (tag, cls, value) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  };
  const icon = (name) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS(node.namespaceURI, "use");
    node.setAttribute("class", "icon");
    node.setAttribute("aria-hidden", "true");
    use.setAttribute("href", "#i-" + name);
    node.append(use);
    return node;
  };
  const normalize = (str) => str.toLowerCase().normalize("NFKD")
    .replace(/\p{Mark}/gu,"").replace(/[׳״"'‘’“”]/g,"").replace(/[-‑–—־]/g," ")
    .replace(/[ךםןףץ]/g,c=>({ך:"כ",ם:"מ",ן:"נ",ף:"פ",ץ:"צ"})[c]).trim();
  const cards = new Map();
  for (const tool of tools) {
    const card = el("button","catalog-card");
    card.type = "button";
    card.dataset.toolId = tool.id;
    card.setAttribute("aria-haspopup", "dialog");
    const top = el("span","catalog-card-top");
    const mark = el("span","category-mark",tool.group.mark);
    mark.setAttribute("aria-hidden","true");
    mark.dataset.tone = tool.group.id;
    top.append(mark,el("span","category-name",tool.group.name),icon("arrow"));
    card.append(top, el("strong","catalog-card-name",tool.name), el("span","catalog-card-description",tool.description));
    if (tool.level) card.append(el("span","catalog-level-tag",stemLevels[tool.level]));
    card.addEventListener("click", () => openTool(tool, card));
    cards.set(tool.id, {card, text: normalize([tool.name,tool.description,tool.group.name,stemLevels[tool.level],tool.keywords,tool.formula].join(" "))});
  }
  const inMode = (tool) => mode === "all" || (mode === "daily" ? tool.daily : Boolean(tool.level));
  function options() {
    const filtered = tools.filter(inMode);
    const domains = new Set(filtered.map(tool=>tool.group.id));
    const levels = new Set(filtered.map(tool=>tool.level).filter(Boolean));
    category.replaceChildren(new Option("כל התחומים","all"),...groups.filter(group=>domains.has(group.id)).map(group=>new Option(group.name,group.id)));
    level.replaceChildren(new Option("כל הרמות","all"),...Object.entries(stemLevels).filter(([id])=>levels.has(id)).map(([id,label])=>new Option(label,id)));
  }
  function changeMode(next) {
    if (mode !== next) { mode = next; options(); }
    render();
  }
  for (const button of modes) button.addEventListener("click",()=>changeMode(button.dataset.mode));
  category.addEventListener("change",render);
  level.addEventListener("change",render);
  function render() {
    const tokens = normalize(search.value).split(/\s+/).filter(Boolean);
    const visible = tools.filter((tool) => {
      const {text} = cards.get(tool.id);
      return inMode(tool) && (category.value === "all" || tool.group.id === category.value) &&
        (level.value === "all" || level.value === tool.level) && tokens.every((word) => text.includes(word));
    });
    for (const button of modes) button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    one("catalog-count").textContent = `מוצגים ${visible.length} מתוך ${tools.length} מחשבונים`;
    resetSearch.hidden = mode === "all" && category.value === "all" && level.value === "all" && !search.value;
    grid.replaceChildren(...visible.map(({id})=>cards.get(id).card));
    one("catalog-empty").hidden = visible.length > 0;
  }
  search.addEventListener("input",render);
  resetSearch.addEventListener("click",() => {
    search.value = "";
    mode = "all";
    options();
    render();
    search.focus();
  });

  function openTool(tool, button) {
    selected = tool;
    origin = button;
    one("dialog-category").textContent = [tool.group.name,stemLevels[tool.level]].filter(Boolean).join(" · ");
    one("dialog-title").textContent = tool.name;
    one("dialog-description").textContent = tool.description;
    const method = one("dialog-method");
    method.textContent = tool.formula || "";
    method.hidden = !tool.formula;
    fields.replaceChildren(...tool.fields.map((field,index) => {
      const label = el("label","field");
      const input = el("input");
      input.id = "tool-value-" + index;
      input.type = field.type;
      input.dir = "ltr";
      input.required = true;
      input.autocomplete = "off";
      input.defaultValue = field.value;
      if (field.type === "number") {
        input.step = field.step;
        input.inputMode = field.step === 1 && field.min >= 0 ? "numeric" : "decimal";
        if (field.min !== undefined) input.min = field.min;
        if (field.max !== undefined) input.max = field.max;
      } else if (field.type === "date") {
        input.min = "0001-01-01";
        input.max = "9999-12-31";
      } else {
        input.maxLength = 6000;
      }
      label.append(el("span","",field.label),input);
      return label;
    }));
    compute();
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  function getValue(input, field) {
    const fail = (message) => { input.setAttribute("aria-invalid","true"); throw Error(message); };
    if (field.type === "number" && input.validity.badInput) fail(`הזינו מספר תקין בשדה ״${field.label}״.`);
    if (!input.value.trim()) fail(`מלאו את השדה ״${field.label}״.`);
    if (field.type === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.value) || !input.validity.valid) fail("בחרו תאריך תקין בשנים 1 עד 9999.");
      return input.value;
    }
    if (field.type === "text") return input.value;
    const value = input.valueAsNumber;
    if (!Number.isFinite(value)) fail(`הזינו מספר תקין בשדה ״${field.label}״.`);
    if (field.min === Number.MIN_VALUE && value <= 0) fail(`הערך בשדה ״${field.label}״ חייב להיות גדול מאפס.`);
    if (field.min !== undefined && value < field.min) fail(`הערך הקטן ביותר בשדה ״${field.label}״ הוא ${format(field.min)}.`);
    if (field.max !== undefined && value > field.max) fail(`הערך הגדול ביותר בשדה ״${field.label}״ הוא ${format(field.max)}.`);
    if (field.step === 1 && !Number.isInteger(value)) fail(`הזינו מספר שלם בשדה ״${field.label}״.`);
    return value;
  }
  function compute() {
    const inputs = [...fields.querySelectorAll("input")];
    for (const input of inputs) input.removeAttribute("aria-invalid");
    let rows;
    try {
      rows = [selected.run(...inputs.map((input,index)=>getValue(input,selected.fields[index])))].flat();
      if (rows.some(({value})=>typeof value === "number" && !Number.isFinite(value))) {
        throw Error("אין תוצאה מספרית בטווח הנתמך. בדקו את הערכים ונסו שוב.");
      }
    } catch (error) {
      out.classList.add("invalid");
      out.replaceChildren(el("p","dialog-result-error",error.message));
      return;
    }
    out.classList.remove("invalid");
    out.replaceChildren(...rows.map(({value,unit,label})=>{
      const row = el("div","dialog-result-row");
      const content = el("strong","dialog-result-value");
      const numeric = typeof value === "number";
      const valueNode = el("bdi","",numeric ? (unit === "₪" && Math.abs(value) < 1e14 ? currency.format(value) : format(value)) : value);
      if (numeric) valueNode.dir = "ltr";
      if (unit === "%") valueNode.append("%");
      content.append(valueNode);
      if (unit && unit !== "%") content.append(el("bdi","dialog-result-unit",unit));
      row.append(el("span","dialog-result-label",label),content);
      return row;
    }));
  }
  form.addEventListener("submit", (event) => { event.preventDefault(); compute(); });
  one("catalog-calculate").addEventListener("click",compute);
  form.addEventListener("keydown",event=>{if(event.key==="Enter"&&event.target.matches("input")){event.preventDefault();compute();}});
  form.addEventListener("input", compute);
  one("example-reset").addEventListener("click",() => { form.reset(); compute(); });
  one("dialog-close").addEventListener("click",() => dialog.close());
  let pointerOnBackdrop = false;
  dialog.addEventListener("pointerdown",(event)=>{pointerOnBackdrop = event.target === dialog;});
  dialog.addEventListener("click",(event)=>{if (pointerOnBackdrop && event.target === dialog) dialog.close();});
  dialog.addEventListener("close",() => { if (!dialog.open) origin?.focus({preventScroll: true}); });
  one("library-total").textContent = tools.length;
  options();
  render();
})();
