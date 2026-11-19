"use strict";

(() => {
  const dayMs=86400000;
  const zone="Asia/Jerusalem";
  const civilFormat=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"});
  const clockFormat=new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  const hebrewFormat=new Intl.DateTimeFormat("he-IL-u-ca-hebrew-nu-latn",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric"});
  const gregorianFormat=new Intl.DateTimeFormat("he-IL",{timeZone:"UTC",weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const gregorianShort=new Intl.DateTimeFormat("he-IL",{timeZone:"UTC",month:"short",day:"numeric"});
  const timeFormat=new Intl.DateTimeFormat("en-GB",{timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  const grid=one("calendar-days");
  const city=one("calendar-city"),yearPanel=one("calendar-year"),months=one("calendar-months");
  const api="https://www.hebcal.com/hebcal";
  const cached=new Map();
  const weekdays=stamp=>new Date(stamp).getUTCDay();
  const holidayEvent=item=>["holiday","roshchodesh","mevarchim"].includes(item.category);
  const itemName=item=>item.hebrew||item.title;
  function el(tag,cls,content){
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(content)node.textContent=content;
    return node;
  }
  const parts=(format,date)=>Object.fromEntries(format.formatToParts(date).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
  const iso=stamp=>new Date(stamp).toISOString().slice(0,10);
  const here=now=>{const {year,month,day}=parts(civilFormat,now);return Date.parse(`${year}-${month}-${day}T12:00:00Z`);};
  const hp=stamp=>{const {year,month,day}=parts(hebrewFormat,stamp);return {year:+year,month,day:+day};};
  const numerals=[[400,"ת"],[300,"ש"],[200,"ר"],[100,"ק"],[90,"צ"],[80,"פ"],[70,"ע"],[60,"ס"],[50,"נ"],[40,"מ"],[30,"ל"],[20,"כ"],[10,"י"],[9,"ט"],[8,"ח"],[7,"ז"],[6,"ו"],[5,"ה"],[4,"ד"],[3,"ג"],[2,"ב"],[1,"א"]];
  function hebrewNumber(value){
    let str="";
    for(const [number,letter] of numerals){
      while(value>=number){
        if(value===15||value===16){str+=value===15?"טו":"טז";value=0;}
        else{str+=letter;value-=number;}
      }
    }
    return str.length>1?str.slice(0,-1)+"״"+str.at(-1):str?str+"׳":"";
  }
  const hebrewYear=year=>hebrewNumber(Math.floor(year/1000))+hebrewNumber(year%1000);
  const hebrewLong=stamp=>{const {year,month,day}=hp(stamp);return `${hebrewNumber(day)} ב${month} ${hebrewYear(year)}`;};
  const monthStart=stamp=>stamp-(hp(stamp).day-1)*dayMs;
  function monthAfter(start){
    const day29=start+29*dayMs;
    return hp(day29).day===1?day29:day29+dayMs;
  }
  function yearMonths(stamp){
    const {year}=hp(stamp);
    let start=monthStart(stamp);
    while(hp(start-dayMs).year===year)start=monthStart(start-dayMs);
    const list=[];
    do{list.push(start);start=monthAfter(start);}while(hp(start).year===year);
    return {year,list,end:start};
  }
  let today=here(new Date()),selected=today,first=monthStart(today),period=yearMonths(today);
  let data=null,loadKey="",sequence=0,loading=true;
  const eventsAt=stamp=>data?.get(iso(stamp))||[];
  const holidaysAt=stamp=>eventsAt(stamp).filter(holidayEvent);
  const calendarRange=stamp=>hp(stamp).year>=5700&&hp(stamp).year<=5900;
  function paintDays(focus=false){
    const {year,month}=hp(first), next=monthAfter(first), elements=[];
    one("calendar-month").textContent=`${month} ${hebrewYear(year)}`;
    for(let blank=0;blank<weekdays(first);blank++){
      const space=document.createElement("span");space.setAttribute("aria-hidden","true");elements.push(space);
    }
    for(let cell=first;cell<next;cell+=dayMs){
      const button=document.createElement("button");
      button.type="button";button.className="calendar-day";
      button.dataset.date=iso(cell);
      const holiday=holidaysAt(cell),isShabbat=weekdays(cell)===6;
      const tags=[isShabbat?"שבת":"",...holiday.map(itemName)].filter(Boolean);
      if(isShabbat)button.classList.add("cal-day-shabbat");
      if(holiday.length)button.classList.add("cal-day-holiday");
      button.tabIndex=cell===selected?0:-1;
      button.setAttribute("aria-label",[hebrewLong(cell),gregorianFormat.format(cell),...tags].join(", "));
      button.setAttribute("aria-pressed",String(cell===selected));
      if(cell===today)button.setAttribute("aria-current","date");
      const h=document.createElement("b"),g=document.createElement("small");
      h.textContent=hebrewNumber(hp(cell).day);
      g.textContent=gregorianShort.format(cell);
      button.append(h,g);
      if(tags.length){
        const detail=el("span","cal-day-event",holiday.length?itemName(holiday[0]):"שבת");
        detail.setAttribute("aria-hidden","true");
        button.title=tags.join(", ");
        button.append(detail);
      }
      button.addEventListener("click",()=>{
        choose(cell);
        setYear(true);
        one("calendar-hebrew").focus();
      });
      elements.push(button);
    }
    grid.replaceChildren(...elements);
    if(focus)grid.querySelector(`[data-date="${iso(selected)}"]`)?.focus({preventScroll:true});
  }
  function paintYear(){
    if(yearPanel.hidden)return;
    one("calendar-year-title").textContent=`שנת ${hebrewYear(period.year)} (${period.year})`;
    if(document.activeElement!==one("calendar-jump-value"))one("calendar-jump-value").value=period.year;
    one("calendar-year-prev").disabled=period.year<=5700;
    one("calendar-year-next").disabled=period.year>=5900;
    const nodes=period.list.map(start=>{
      const {month}=hp(start),last=monthAfter(start)-dayMs;
      const button=el("button","cal-year-month");
      button.type="button";
      button.setAttribute("aria-pressed",String(start===first));
      button.append(el("strong","",month),el("small","",`${gregorianShort.format(start)} עד ${gregorianShort.format(last)}`));
      button.addEventListener("click",()=>{
        choose(start,true);
        grid.querySelector('[tabindex="0"]')?.scrollIntoView({block:"nearest"});
      });
      return button;
    });
    months.replaceChildren(...nodes);
  }
  function setYear(open,focus=false){
    yearPanel.hidden=!open;
    const toggle=one("calendar-year-toggle");
    toggle.setAttribute("aria-expanded",String(open));
    toggle.textContent=open?"הסתרת תצוגת שנה":"הצגת שנה";
    if(open)paintYear();
    if(focus)one("calendar-year-title").focus();
  }
  const books={Genesis:"בראשית",Exodus:"שמות",Leviticus:"ויקרא",Numbers:"במדבר",Deuteronomy:"דברים",Joshua:"יהושע",Judges:"שופטים","I Samuel":"שמואל א׳","II Samuel":"שמואל ב׳","I Kings":"מלכים א׳","II Kings":"מלכים ב׳",Isaiah:"ישעיהו",Jeremiah:"ירמיהו",Ezekiel:"יחזקאל",Hosea:"הושע",Joel:"יואל",Amos:"עמוס",Obadiah:"עובדיה",Jonah:"יונה",Micah:"מיכה",Nahum:"נחום",Habakkuk:"חבקוק",Zephaniah:"צפניה",Haggai:"חגי",Zechariah:"זכריה",Malachi:"מלאכי"};
  function references(value){
    return value.split(/;\s*/).map(ref=>{
      const result=ref.match(/^(.+?)\s+(\d.*)$/);
      if(!result||!books[result[1]])return el("bdi","",ref);
      const node=el("span","cal-reference");
      node.append(books[result[1]]," ",el("bdi","",result[2]));
      return node;
    });
  }
  function fact(list,label,value,kind){
    if(!value)return;
    const term=el("dt","",label),definition=el("dd","");
    if(kind==="ref"){
      references(value).forEach((ref,i)=>{if(i)definition.append("; ");definition.append(ref);});
    }else if(kind==="time"){
      const t=el("time","",timeFormat.format(new Date(value)));
      t.dateTime=value;t.dir="ltr";definition.append(t);
    }else definition.textContent=value;
    list.append(term,definition);
  }
  const timeEvent=(stamp,type)=>eventsAt(stamp).find(event=>event.category===type)?.date;
  function paintDetails(){
    one("calendar-hebrew").textContent=hebrewLong(selected);
    one("calendar-gregorian").textContent=gregorianFormat.format(selected);
    const holidays=one("calendar-holidays");
    holidays.replaceChildren(...[...(weekdays(selected)===6?["שבת"]:[]),...holidaysAt(selected).map(itemName)].map(label=>el("span","cal-chip",label)));
    const display=one("calendar-events"),status=one("calendar-status");
    display.setAttribute("aria-busy",String(loading));
    one("calendar-retry").hidden=Boolean(data)||loading;
    status.textContent=loading?"טוען חגים, זמני שבת וקריאות…":data?"":"נתוני החגים, השבת והקריאות לא נטענו. אפשר לנסות שוב.";
    display.replaceChildren();
    if(!data)return;
    const dow=weekdays(selected),saturday=selected+(6-dow)*dayMs,friday=saturday-dayMs;
    const events=eventsAt(saturday);
    const parasha=events.find(item=>item.category==="parashat");
    const special=events.find(item=>holidayEvent(item)&&item.leyning?.haftarah);
    const reading=parasha?.leyning||special?.leyning;
    const work=el("dl","");
    fact(work,"כניסת שבת · שישי",timeEvent(friday,"candles"),"time");
    fact(work,"צאת שבת · מוצ״ש",timeEvent(saturday,"havdalah"),"time");
    if(!timeEvent(saturday,"havdalah")&&timeEvent(saturday,"candles")){
      fact(work,"המעבר לחג במוצ״ש",timeEvent(saturday,"candles"),"time");
    }
    if(!work.children.length)fact(work,"זמני שבת","לא התקבלו זמנים לשבת זו.");
    fact(work,"פרשת השבוע",parasha&&itemName(parasha));
    if(!parasha)fact(work,"קריאת השבת",special?itemName(special):"לא נמסרה קריאה לשבת זו.");
    fact(work,"הפטרה",reading?.haftarah,"ref");
    fact(work,"הפטרה ספרדית (אם שונה)",reading?.haftarah_sephardic,"ref");
    display.append(el("h4","",`שבת · ${gregorianShort.format(saturday)}`),work);
    if(selected!==saturday){
      const festival=holidaysAt(selected).find(item=>item.leyning);
      const details=el("dl","");
      if(selected!==friday)fact(details,"הדלקת נרות",timeEvent(selected,"candles"),"time");
      fact(details,"צאת החג",timeEvent(selected,"havdalah"),"time");
      fact(details,"קריאה בתורה",festival?.leyning?.torah,"ref");
      fact(details,"הפטרת החג",festival?.leyning?.haftarah,"ref");
      fact(details,"הפטרה ספרדית (אם שונה)",festival?.leyning?.haftarah_sephardic,"ref");
      if(details.children.length)display.append(el("h4","","מועדים בתאריך הנבחר"),details);
    }
  }
  function ensureEvents(){
    const minutes=city.selectedOptions[0].dataset.minutes;
    one("calendar-convention").textContent=`בעיר שנבחרה, הדלקת נרות בערב שבת ${minutes} דקות לפני השקיעה. צאת שבת לפי שקיעת השמש ל־8.5° מתחת לאופק. בערבי חג הסמוכים לשבת זמני ההדלקה עשויים להיות שונים.`;
    const key=`${period.year}:${city.value}`;
    if(loadKey===key)return;
    loadKey=key;
    const ticket=++sequence;
    data=cached.get(key)||null;
    loading=!data;
    if(data)return;
    const params=new URLSearchParams({
      v:"1",cfg:"json",maj:"on",min:"on",mod:"on",mf:"on",nx:"on",ss:"on",i:"on",c:"on",s:"on",leyning:"on",
      geo:"geoname",geonameid:city.value,b:minutes,M:"on",lg:"he",
      start:iso(period.list[0]-7*dayMs),end:iso(period.end+7*dayMs)
    });
    fetch(`${api}?${params}`,{signal:AbortSignal.timeout(9500)})
      .then(response=>{if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();})
      .then(({items})=>{
        if(!Array.isArray(items)||!items.some(item=>item.category==="candles")||!items.some(item=>item.category==="parashat"))throw Error("Missing calendar items");
        const byDay=new Map();
        for(const item of items){
          const date=item.date.slice(0,10);
          if(!byDay.has(date))byDay.set(date,[]);
          byDay.get(date).push(item);
        }
        if(cached.size>=10)cached.delete(cached.keys().next().value);
        cached.set(key,byDay);
        if(ticket===sequence)data=byDay;
      })
      .catch(()=>{if(ticket===sequence)data=null;})
      .finally(()=>{
        if(ticket!==sequence)return;
        loading=false;
        paintDays(grid.contains(document.activeElement));paintDetails();
      });
  }
  function paint(focus=false){
    ensureEvents();
    paintDays(focus);paintDetails();paintYear();
    one("calendar-prev").disabled=!calendarRange(first-dayMs);
    one("calendar-next").disabled=!calendarRange(monthAfter(first));
  }
  function choose(stamp,focus=false){
    if(!calendarRange(stamp))return;
    selected=stamp;first=monthStart(stamp);
    if(hp(stamp).year!==period.year)period=yearMonths(stamp);
    paint(focus);
  }
  function jump(year){
    if(!Number.isInteger(year)||year<5700||year>5900)return;
    if(year===period.year){one("calendar-year-title").focus();return;}
    const target=yearMonths(Date.UTC(year-3761,10,15,12)).list;
    const month=hp(selected).month,matched=target.find(stamp=>hp(stamp).month===month);
    const start=matched||target[0];
    choose(matched?Math.min(start+(hp(selected).day-1)*dayMs,monthAfter(start)-dayMs):start);
    one("calendar-year-title").focus({preventScroll:true});
  }
  one("calendar-prev").addEventListener("click",()=>choose(monthStart(first-dayMs)));
  one("calendar-next").addEventListener("click",()=>choose(monthAfter(first)));
  one("calendar-today").addEventListener("click",()=>choose(today,true));
  one("calendar-year-toggle").addEventListener("click",()=>setYear(yearPanel.hidden,yearPanel.hidden));
  one("calendar-year-prev").addEventListener("click",()=>jump(period.year-1));
  one("calendar-year-next").addEventListener("click",()=>jump(period.year+1));
  const jumpInput=one("calendar-jump-value");
  const jumpFromInput=()=>{if(jumpInput.reportValidity())jump(jumpInput.valueAsNumber);};
  one("calendar-jump-submit").addEventListener("click",jumpFromInput);
  jumpInput.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();jumpFromInput();}});
  one("calendar-retry").addEventListener("click",()=>{loadKey="";paint();one("calendar-hebrew").focus({preventScroll:true});});
  city.addEventListener("change",()=>paint());
  grid.addEventListener("keydown",event=>{
    const target=event.target.closest(".calendar-day");
    if(!target)return;
    const offsets={ArrowLeft:1,ArrowRight:-1,ArrowDown:7,ArrowUp:-7};
    if(Object.hasOwn(offsets,event.key)){event.preventDefault();choose(selected+offsets[event.key]*dayMs,true);}
    else if (["Home","End","PageUp","PageDown"].includes(event.key)){
      event.preventDefault();
      const stamp=event.key==="Home"?first:event.key==="End"?monthAfter(first)-dayMs:event.key==="PageUp"?monthStart(first-dayMs):monthAfter(first);
      choose(stamp,true);
    }
  });
  function updateClock(initial=false){
    const now=new Date(), date=here(now);
    const live=one("israel-clock");
    live.textContent=clockFormat.format(now);
    live.dateTime=now.toISOString();
    if(initial||date!==today){
      const followsToday=selected===today;
      today=date;
      for(const [id,value] of [["today-hebrew",hebrewLong(today)],["today-gregorian",gregorianFormat.format(today)]]){
        const node=one(id);node.textContent=value;node.dateTime=iso(today);
      }
      if(followsToday)choose(today,grid.contains(document.activeElement));
      else paint(grid.contains(document.activeElement));
    }
  }
  updateClock(true);
  setInterval(updateClock,1000);
})();
