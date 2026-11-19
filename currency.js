"use strict";

(() => {
  const fxUrl="https://api.frankfurter.dev/v2/providers/ecb/rates";
  const btcUrl="https://api.coinbase.com/v2/prices/BTC-USD/spot";
  const currencies={ILS:"שקל חדש",USD:"דולר אמריקאי",EUR:"אירו",BTC:"ביטקוין",GBP:"לירה שטרלינג",CAD:"דולר קנדי",AUD:"דולר אוסטרלי",JPY:"ין יפני",CHF:"פרנק שווייצרי",CNY:"יואן סיני"};
  const amount=one("currency-amount"),from=one("currency-from"),to=one("currency-to");
  const swap=one("currency-swap"),refresh=one("currency-refresh"),status=one("currency-status");
  const output=one("currency-result"),detail=one("currency-detail");
  const formatDate=new Intl.DateTimeFormat("he-IL",{dateStyle:"long",timeZone:"UTC"});
  const formatMoment=new Intl.DateTimeFormat("he-IL",{dateStyle:"short",timeStyle:"medium",timeZone:"Asia/Jerusalem"});
  const formatRate=new Intl.NumberFormat("en-US",{maximumSignificantDigits:9});
  let fx, bitcoin, lastLoad=0;
  const loading={fx:false,btc:false},failed={fx:false,btc:false};
  for(const [select,initial] of [[from,"USD"],[to,"ILS"]]){
    select.replaceChildren(...Object.entries(currencies).map(([code,name])=>new Option(`${code} · ${name}`,code)));
    select.value=initial;
    select.disabled=false;
  }
  swap.disabled=false;
  const needsBtc=()=>from.value==="BTC"||to.value==="BTC";
  const needsFx=()=>[from.value,to.value].some(code=>code!=="BTC"&&code!=="USD");
  const usdPer=code=>code==="BTC"?bitcoin?.usd:code==="USD"?1:fx?.rates.USD/fx?.rates[code];

  function render(){
    refresh.disabled=loading.fx||loading.btc;
    const a=from.value,b=to.value,same=a===b;
    const rate=same?1:usdPer(a)/usdPer(b);
    const messages=[];
    if(same)messages.push("אותו מטבע בשני הצדדים. אין צורך בשער המרה.");
    if(!same&&needsFx()){
      if(fx){
        const date=new Date(fx.date+"T00:00:00Z");
        messages.push("תאריך שערי הייחוס: "+formatDate.format(date)+
          (failed.fx?" (הרענון נכשל; מוצג השער הקודם).":Date.now()-date.getTime()>4*86400000?" (ישן מארבעה ימים).":"."));
      }else messages.push(loading.fx?"טוען שערי מטבע…":failed.fx?"שערי המטבע לא זמינים כרגע. נסו לרענן.":"שערי המטבע טרם נטענו.");
    }
    if(!same&&needsBtc()){
      if(bitcoin) messages.push("מחיר הביטקוין התקבל ב־"+formatMoment.format(bitcoin.received)+
        (failed.btc?" (הרענון נכשל; מוצג המחיר הקודם).":Date.now()-bitcoin.received>120000?" (לא מחיר חי).":"."));
      else messages.push(loading.btc?"טוען מחיר ביטקוין…":failed.btc?"מחיר הביטקוין לא זמין כרגע. נסו לרענן.":"מחיר הביטקוין טרם נטען.");
    }
    status.textContent=messages.join(" ");
    output.textContent="—";
    detail.textContent="";
    output.classList.remove("compact");
    if(!Number.isFinite(rate)||rate<=0)return;
    detail.textContent=`1 ${a} = ${formatRate.format(rate)} ${b}`;
    const sum=amount.valueAsNumber, value=sum*rate;
    if(!Number.isFinite(sum)||sum<0||!Number.isFinite(value))return;
    output.textContent=b==="BTC"
      ? "BTC\u00a0"+new Intl.NumberFormat("en-US",{maximumFractionDigits:8}).format(value)
      : new Intl.NumberFormat("en-US",{style:"currency",currency:b,currencyDisplay:"code"}).format(value);
    output.classList.toggle("compact",output.textContent.length>13);
  }
  async function fetchData(url){
    for(let attempt=0;attempt<2;attempt++){
      const abort=new AbortController();
      const timer=setTimeout(()=>abort.abort(),4500);
      try{
        const response=await fetch(url,{cache:"no-store",credentials:"omit",signal:abort.signal});
        if(!response.ok)throw Error("rate response");
        return await response.json();
      }catch(error){if(attempt===1)throw error;}
      finally{clearTimeout(timer);}
    }
  }
  async function request(kind,task){
    if(loading[kind])return;
    loading[kind]=true;
    failed[kind]=false;
    render();
    try{await task();}
    catch{failed[kind]=true;}
    finally{loading[kind]=false;render();}
  }
  const updateFx=()=>request("fx",async()=>{
    const rows=await fetchData(fxUrl);
    if(!Array.isArray(rows))throw Error("invalid rates");
    const dates=new Map();
    for(const row of rows){
      if(row?.base!=="EUR"||!Object.hasOwn(currencies,row.quote)||row.quote==="BTC"||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(Date.parse(row.date))||!Number.isFinite(row.rate)||row.rate<=0)continue;
      if(!dates.has(row.date))dates.set(row.date,{EUR:1});
      dates.get(row.date)[row.quote]=row.rate;
    }
    const date=[...dates.keys()].sort().reverse().find(d=>Object.keys(currencies).every(code=>code==="BTC"||Object.hasOwn(dates.get(d),code)));
    if(!date||fx?.date>date)throw Error("incomplete rates");
    fx={date,rates:dates.get(date)};
  });
  const updateBtc=()=>request("btc",async()=>{
    const {data}=await fetchData(btcUrl);
    const usd=Number(data?.amount);
    if(data?.base!=="BTC"||data.currency!=="USD"||!Number.isFinite(usd)||usd<=0)throw Error("invalid bitcoin quote");
    bitcoin={usd,received:Date.now()};
  });
  function load(){
    lastLoad=Date.now();
    updateFx();
    updateBtc();
  }
  function change(){
    render();
    if(lastLoad&&needsBtc()&&from.value!==to.value&&(!bitcoin||Date.now()-bitcoin.received>60000))updateBtc();
  }
  document.addEventListener("tool-selected",event=>{
    if(event.detail==="currency"&&(!lastLoad||Date.now()-lastLoad>300000))load();
  });
  refresh.addEventListener("click",load);
  amount.addEventListener("input",render);
  for(const field of [from,to])field.addEventListener("change",change);
  swap.addEventListener("click",()=>{[from.value,to.value]=[to.value,from.value];change();});
  render();
})();
