"use strict";

(() => {
  const controls = [];
  let current = null;
  function close(restore = false) {
    if (!current) return;
    const old = current;
    current = null;
    old.list.hidden = true;
    old.box.classList.remove("combo-up");
    old.button.setAttribute("aria-expanded","false");
    if (restore) old.button.focus({preventScroll:true});
  }
  function activate(state, index) {
    const options = [...state.list.children];
    const count = options.length;
    if (!count) return;
    const item = options[(index + count) % count];
    item.focus({preventScroll:true});
    const a = item.getBoundingClientRect(), b = state.list.getBoundingClientRect();
    if (a.bottom > b.bottom) state.list.scrollTop += a.bottom-b.bottom;
    else if (a.top < b.top) state.list.scrollTop -= b.top-a.top;
  }
  function show(state, focus = true) {
    const {select,button,list,box} = state;
    if (select.disabled || !select.options.length) return;
    if (current === state) { close(true); return; }
    close();
    const options = [...select.options].filter(option=>!option.disabled && !option.hidden);
    if (!options.length) return;
    list.replaceChildren(...options.map(option=>{
      const item = document.createElement("button");
      item.className = "combo-item";
      item.type = "button";
      item.tabIndex = -1;
      item.dataset.value = option.value;
      item.setAttribute("role","option");
      item.setAttribute("aria-selected",String(option.selected));
      item.dir = select.dir || "auto";
      item.textContent = option.textContent;
      item.addEventListener("click",()=>{
        select.value = option.value;
        close(true);
        sync(state);
        select.dispatchEvent(new Event("input",{bubbles:true}));
        select.dispatchEvent(new Event("change",{bubbles:true}));
      });
      return item;
    }));
    current = state;
    list.hidden = false;
    button.setAttribute("aria-expanded","true");
    const {top,bottom} = button.getBoundingClientRect();
    const height = window.visualViewport?.height ?? window.innerHeight;
    const above = top - 12, below = height-bottom-12;
    const up = below<Math.min(252,list.scrollHeight) && above>below;
    box.classList.toggle("combo-up",up);
    list.style.maxHeight = Math.max(85,Math.min(262,up?above:below))+"px";
    if (focus) activate(state,Math.max(0,options.findIndex(option=>option.selected)));
  }
  function sync(state) {
    const {select,button,caption} = state;
    button.disabled = select.disabled || !select.options.length;
    const value = select.selectedOptions[0]?.textContent || "בחרו אפשרות";
    caption.textContent = value;
    button.setAttribute("aria-label",`${state.label}: ${value}`);
    if (current===state && button.disabled) close();
  }
  for (const select of document.querySelectorAll("select")) {
    const label = select.closest("label");
    if (!label) continue;
    const name = [...label.childNodes].filter(node=>node!==select).map(node=>node.textContent).join(" ").trim();
    const field = document.createElement("div");
    field.className = label.className;
    label.before(field);
    field.append(...label.childNodes);
    label.remove();
    select.hidden = true;
    select.tabIndex = -1;
    const box=document.createElement("div"), button=document.createElement("button"), caption=document.createElement("span"), list=document.createElement("div");
    box.className = "combo";
    button.className = "combo-button";
    button.type = "button";
    button.id = select.id+"-toggle";
    button.setAttribute("aria-haspopup","listbox");
    button.setAttribute("aria-expanded","false");
    caption.className = "combo-value";
    caption.dir = select.dir || "auto";
    button.append(caption);
    list.className = "combo-list";
    list.id = select.id+"-choices";
    list.hidden = true;
    list.setAttribute("role","listbox");
    list.setAttribute("aria-label",name);
    button.setAttribute("aria-controls",list.id);
    box.append(button,list);
    field.append(box);
    const state = {label:name,select,box,button,caption,list,typed:"",lastType:0};
    controls.push(state);
    button.addEventListener("click",()=>show(state));
    box.addEventListener("keydown",event=>{
      const key=event.key;
      if (current!==state) {
        if (key==="ArrowDown" || key==="ArrowUp") { event.preventDefault(); show(state); }
        return;
      }
      if (key==="Tab") { close(true); return; }
      if (key==="Escape") { event.preventDefault(); event.stopPropagation(); close(true); return; }
      const items=[...list.children];
      const index=items.indexOf(document.activeElement);
      if (["ArrowDown","ArrowUp","Home","End"].includes(key)) {
        event.preventDefault();
        activate(state,key==="Home"?0:key==="End"?items.length-1:index+(key==="ArrowDown"?1:-1));
      } else if (key.length===1 && key!==" " && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const now=Date.now();
        state.typed=(now-state.lastType>650?"":state.typed)+key.toLowerCase();
        state.lastType=now;
        const match=items.findIndex(item=>item.textContent.toLowerCase().startsWith(state.typed));
        if(match>=0){event.preventDefault();activate(state,match);}
      }
    });
    new MutationObserver(()=>{if(current===state){close();} sync(state);}).observe(select,{childList:true,attributes:true,subtree:true});
    sync(state);
  }
  const syncAll = () => queueMicrotask(()=>controls.forEach(sync));
  document.addEventListener("change",syncAll);
  document.addEventListener("click",syncAll);
  document.addEventListener("pointerdown",event=>{if(current&&!current.box.contains(event.target))close();});
  document.addEventListener("focusin",event=>{if(current&&!current.box.contains(event.target))close();});
  document.addEventListener("tool-selected",()=>close());
  window.addEventListener("resize",()=>close());
})();
