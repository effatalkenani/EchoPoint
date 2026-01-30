document.addEventListener("DOMContentLoaded", () => {
  init();
});
const chime = new Audio("sounds/chime.mp3");
const DEMO_MODE = true;
//let notifiedPlaces = new Set();
let placeStates = {};

/* ================== GLOBAL ================== */
let markers = {};
let mapInstance = null;
let userMarker = null;
let userCircle = null;
let settingsOpen = false;
let activePlace = null;
let firstLocationCheck = true;

let locationRequested = false;
/* ================== GEOJSON PLACES ================== */
let geoPlaces = []; // المعالم القادمة من ملف GeoJSON


/* ================== STATE ================== */
const state = {
  step: 1,
  lang: "ar",
  duration: null,
  coords: null
};

/* ================== LANGUAGES ================== */
const LANGS = [
  {code:"en",native:"English",dir:"ltr"},
  {code:"ar",native:"العربية",dir:"rtl"},
];

/* ================== UI TEXT ================== */
const UI = {
  en:{
    title:"EchPoint — Adaptive Audio Guide",
    subtitle:"Language-first, location-aware audio experience",
    st1:"Step 1: Language",
    st2:"Step 2: Duration",
    st3:"Step 3: Location",
    st4:"Step 4: Map",
    langTitle:"Select your language",
    langDesc:"The interface adapts instantly.",
    durTitle:"Select listening duration",
    locTitle:"Enable location",
    locDesc:"Used to trigger nearby audio content.",
    mapTitle:"Nearby places",
    nearbyTitle:"Closest places to you"
  },
  ar:{
    title:"مَعالِم — مرشد صوتي تكيفي",
    subtitle:"تجربة صوتية تعتمد على اللغة والموقع",
    st1:"الخطوة 1: اللغة",
    st2:"الخطوة 2: المدة",
    st3:"الخطوة 3: الموقع",
    st4:"الخطوة 4: الخريطة",
    langTitle:"اختاري اللغة",
    langDesc:"الواجهة تتكيف فورًا.",
    durTitle:"اختاري مدة الاستماع",
    locTitle:"تفعيل الموقع",
    locDesc:"لتفعيل المحتوى الصوتي القريب.",
    mapTitle:"المعالم القريبة",
    nearbyTitle:"أقرب الأماكن لك"
  }
};

/* ================== PLACES + STORIES ================== 
const PLACES = [
  {
    name:{en:"Cardiff Castle",ar:"قلعة كارديف"},
    lat:51.4839,lng:-3.1812,
    story:{
      ar:`تقفين الآن بالقرب من قلعة كارديف، أحد أقدم المعالم التاريخية في ويلز.
بُنيت القلعة على أنقاض حصن روماني قبل أكثر من ألفي عام، وشهدت عصورًا متعاقبة من الحروب والتحصينات الملكية.
بين جدرانها الحجرية تختبئ قصص الملوك والنبلاء، وتطل أبراجها على قلب المدينة كحارس صامت للتاريخ.`,
      en:`You are now near Cardiff Castle, one of the oldest historic landmarks in Wales.
Built on the remains of a Roman fort over two thousand years ago, the castle has witnessed centuries of conflict and royal transformation.
Its stone walls and towers stand as silent guardians over the heart of the city.`
    }
  },
  {
    name:{en:"Bute Park",ar:"بيوت بارك"},
    lat:51.4855,lng:-3.1869,
    story:{
      ar:`بيوت بارك هي الرئة الخضراء لمدينة كارديف.
تمتد الحديقة بمحاذاة نهر تاف، وكانت يومًا ما حدائق خاصة لقلعة كارديف.
اليوم تُعد ملاذًا هادئًا للسكان والزوار، حيث تختلط أصوات الطبيعة بتاريخ المدينة.`,
      en:`Bute Park is the green heart of Cardiff.
Stretching along the River Taff, it was once the private gardens of Cardiff Castle.
Today it offers a peaceful escape where nature and history meet.`
    }
  },
  {
    name:{en:"River Taff",ar:"نهر تاف"},
    lat:51.4875,lng:-3.1900,
    story:{
      ar:`نهر تاف لعب دورًا محوريًا في نشأة كارديف.
على ضفافه تطورت التجارة والصناعة، وكان شريانًا حيويًا للمدينة.
اليوم يجري بهدوء، حاملاً معه ذاكرة الماضي وحياة الحاضر.`,
      en:`The River Taff played a vital role in the growth of Cardiff.
Along its banks, trade and industry once flourished.
Today it flows calmly, carrying memories of the past into modern life.`
    }
  }
];
*/
/* ================== HELPERS ================== */
let currentUtterance = null;
let currentPlace = null;

function speak(text, title = ""){
  const textBox = document.getElementById("playerText");

  // إذا فيه صوت شغال → أوقفيه
  if(currentUtterance){
    speechSynthesis.cancel();
    currentUtterance = null;

    document.getElementById("playerSub").textContent = "متوقف";
    textBox.classList.add("hidden");
    textBox.textContent = "";
    return;
  }

  const u = new SpeechSynthesisUtterance(text);
  u.lang = state.lang === "ar" ? "ar-SA" : "en-GB";

  document.getElementById("playerTitle").textContent = title;
  document.getElementById("playerSub").textContent = "تشغيل";

  // 👇 عرض النص
  textBox.textContent = text;
  textBox.classList.remove("hidden");

  u.onend = () => {
    currentUtterance = null;
    document.getElementById("playerSub").textContent = "متوقف";
    textBox.classList.add("hidden");
    textBox.textContent = "";
  };

  u.onerror = () => {
    currentUtterance = null;
    textBox.classList.add("hidden");
    textBox.textContent = "";
  };

  currentUtterance = u;
  speechSynthesis.speak(u);
}






function distance(a,b,c,d){
  const R=6371e3;
  const φ1=a*Math.PI/180, φ2=c*Math.PI/180;
  const Δφ=(c-a)*Math.PI/180, Δλ=(d-b)*Math.PI/180;
  const x=Math.sin(Δφ/2)**2+
          Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}


function getNarrationText(place){
  if(state.duration === "short"){
    return state.lang === "ar"
      ? `أنتِ الآن عند ${place.name}.`
      : `You are now at ${place.name}.`;
  }

  if(state.duration === "long"){
    return state.lang === "ar"
      ? place.story.ar_long
      : place.story.en_long;
  }

  return "";
}



/* ================== UI ================== */
function updateUI(){
  const pack = UI[state.lang];

  document.documentElement.lang = state.lang;
  document.documentElement.dir =
    LANGS.find(l=>l.code===state.lang).dir;

  Object.keys(pack).forEach(k=>{
    const el=document.getElementById(k);
    if(el) el.textContent=pack[k];
  });

  document.querySelectorAll(".step").forEach(s=>{
    const n=+s.dataset.step;
    s.classList.toggle("active", n===state.step);
    s.classList.toggle("done", n<state.step);
  });

  ["step1","step2","step3","step4"].forEach((id,i)=>{
    document.getElementById(id)
      .classList.toggle("hidden", state.step!==i+1);
  });

  // 👇 هذا هو السطر المهم الجديد
  const stepsCard = document.getElementById("stepsCard");

  if(state.step === 4){
    stepsCard.classList.add("hidden");
  }else{
    stepsCard.classList.remove("hidden");
  }
}


function toggleSettings(){
  settingsOpen = !settingsOpen;

  const stepsBox = document.querySelector(".steps");
  stepsBox.classList.toggle("hidden", settingsOpen);
}




function goTo(n){
  state.step=n;
  updateUI();
}

/* ================== LOCATION ================== */
function enableLocation(){

  navigator.geolocation.watchPosition(
    pos => {
      state.coords = pos.coords;

      if(state.step !== 4) goTo(4);

      initMap();
      updateUserLocation();

      checkNearbyPlaces();   // 👈 هنا الإشعارات
      renderGeoPlaces();
    },
    err => console.error("Geolocation error:", err),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );

}






/* ================== DURATION ================== */
function selectDuration(value){
  state.duration = value;

  // تفعيل زر Next
  const nextBtn = document.getElementById("next2");
  if(nextBtn) nextBtn.disabled = false;

  // تمييز الزر المختار
  document.querySelectorAll(".duration-btn")
    .forEach(b => b.classList.remove("active"));

  const activeBtn = document.querySelector(
    `.duration-btn[data-value="${value}"]`
  );
  if(activeBtn) activeBtn.classList.add("active");

  console.log("Duration selected:", value);
}




/* ================== LOAD GEOJSON ================== */
function loadPlacesFromGeoJSON(){
  return fetch("ma3alem_cardiff.geojson")
    .then(res => res.json())
    .then(data => {
      geoPlaces = data.features.map(f => {
        const g = f.geometry;
        const p = f.properties;

        // 📍 Point
        if(g.type === "Point"){
          return {
            name: p.Name,
            lat: g.coordinates[1],
            lng: g.coordinates[0],
            story: {
              ar_long: p.Story.ar_long,
              en_long: p.Story.en_long
            },
            trigger: p.TriggerType,
            radius: p.RadiusMeters || 120
          };
        }

        // 🏰 Polygon
        if(g.type === "Polygon"){
          const center = g.coordinates[0][0];
          return {
            name: p.Name,
            lat: center[1],
            lng: center[0],
            story: {
              ar_long: p.Story.ar_long,
              en_long: p.Story.en_long
            },
            trigger: "enter_area"
          };
        }
      });
    });
}


/* ================== MAP ================== */
function initMap(){
  if(mapInstance) return;

  mapInstance = L.map("map").setView(
    [state.coords.latitude, state.coords.longitude], 15
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
    .addTo(mapInstance);

loadPlacesFromGeoJSON().then(() => {
  geoPlaces.forEach(place => {
    markers[place.name] = L.marker(
      [place.lat, place.lng],
      { icon: redIcon() }
    )
    .addTo(mapInstance)
    .on("click", () => activateGeoPlace(place));
  });

  checkNearbyPlaces();   // ✅ الآن geoPlaces جاهزة
  renderGeoPlaces();
});

}



function updateUserLocation(){
  const latlng=[state.coords.latitude,state.coords.longitude];

  if(!userMarker){
    userMarker = L.circleMarker(latlng,{
      radius:6,color:"#3b82f6",fillOpacity:1
    }).addTo(mapInstance);
  }else{
    userMarker.setLatLng(latlng);
  }

  if(!userCircle){
    userCircle = L.circle(latlng,{
      radius:100,color:"#3b82f6",fillOpacity:0.1
    }).addTo(mapInstance);
  }else{
    userCircle.setLatLng(latlng);
  }
}

function redIcon(){
  return L.icon({
    iconUrl:"https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png",
    iconSize:[32,32],iconAnchor:[16,32]
  });
}
function greenIcon(){
  return L.icon({
    iconUrl:"https://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png",
    iconSize:[32,32],iconAnchor:[16,32]
  });
}

/* ================== PLACES ================== 
function renderPlaces(){
  const box=document.getElementById("places");
  box.innerHTML="";

  PLACES
    .map(p=>({...p,
      dist:distance(
        state.coords.latitude,
        state.coords.longitude,
        p.lat,p.lng)
    }))
    .sort((a,b)=>a.dist-b.dist)
    .forEach(p=>{
      const div=document.createElement("div");
      div.className="place";
      div.innerHTML=`
        <h4>${p.name[state.lang]}</h4>
        <small>${Math.round(p.dist)} متر</small><br><br>
        <button class="btn" onclick="activatePlace('${p.name.en}')">
  ▶ تشغيل الصوت
</button>

      `;
      box.appendChild(div);
    });
}
*/
/*
function activatePlace(nameEn){
  const place = PLACES.find(p => p.name.en === nameEn);

  Object.values(markers).forEach(m => m.setIcon(redIcon()));
  markers[nameEn]?.setIcon(greenIcon());

  speak(
    place.story[state.lang],
    place.name[state.lang]
  );
}
*/



function activateGeoPlace(place){
  Object.values(markers).forEach(m => m.setIcon(redIcon()));
  markers[place.name]?.setIcon(greenIcon());

  // 🔔 صوت تنبيه
  chime.play().then(() => {
    setTimeout(() => {
      const narration = getNarrationText(place);
      speak(narration, place.name);
    }, 500);
  });
}




function showSystemNotification(title, body) {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title, {
      body,
     icon: "/icons/icon-192.png",
      vibrate: [200, 100, 200],
      tag: "maalem-location", // مهم
      renotify: true
    });
  });
}



function checkNearbyPlaces() {
  if (!state.coords || geoPlaces.length === 0) return;

  // 👈 مهم للاختبار
  if (DEMO_MODE) firstLocationCheck = true;

  geoPlaces.forEach(p => {
    const d = distance(
      state.coords.latitude,
      state.coords.longitude,
      p.lat,
      p.lng
    );

    const radius = p.radius || 120;

    // تهيئة الحالة
    if (!placeStates[p.name]) {
      placeStates[p.name] = { inside: false };
    }

    // ✅ الحالة الخاصة: أول تشغيل + أنتِ داخل المكان
    if (firstLocationCheck && d <= radius) {
      placeStates[p.name].inside = true;

      activateGeoPlace(p);
      showInAppNotification(p, d);

      const message =
        state.lang === "ar"
          ? `أنتِ الآن عند ${p.name}`
          : `You are now at ${p.name}`;

      showSystemNotification("📍 معالم", message);
    }

    // 🔔 دخول طبيعي (بعدها)
    if (d <= radius && !placeStates[p.name].inside) {
      placeStates[p.name].inside = true;

      activateGeoPlace(p);
      showInAppNotification(p, d);

      const message =
        state.lang === "ar"
          ? `أنتِ الآن عند ${p.name}`
          : `You are now at ${p.name}`;

      showSystemNotification("📍 معالم", message);
    }

    // خروج من المكان
    if (d > radius) {
      placeStates[p.name].inside = false;
    }
  });

  // ❗ بعد أول فحص
  firstLocationCheck = false;
}







function showInAppNotification(place, d){
  const toast = document.getElementById("toast");
  toast.textContent =
    state.lang === "ar"
      ? `📍 أنتِ الآن عند ${place.name}`
      : `📍 You are now at ${place.name}`;

  toast.classList.remove("hidden");

  setTimeout(()=>{
    toast.classList.add("hidden");
  }, 4000);
}
function renderGeoPlaces(){
  const box = document.getElementById("places");
  box.innerHTML = "";

  geoPlaces
    .map(p => ({
      ...p,
      dist: distance(
        state.coords.latitude,
        state.coords.longitude,
        p.lat,
        p.lng
      )
    }))
    .sort((a,b)=>a.dist-b.dist)
    .forEach(p=>{
      const div = document.createElement("div");
      div.className = "place";
      div.innerHTML = `
        <h4>${p.name}</h4>
        <small>${Math.round(p.dist)} متر</small><br><br>
        <button class="btn" onclick="focusOnPlace('${p.name}')">
          ▶ تشغيل
        </button>
      `;
      box.appendChild(div);
    });
}


function focusOnPlace(name){
  const p = geoPlaces.find(x => x.name === name);
  if(!p) return;

  mapInstance.setView([p.lat, p.lng], 17);
  activateGeoPlace(p);
}


function renderPlacesList() {
  const box = document.getElementById("placesList");
  if (!box || !state.coords) return;

  box.innerHTML = "";

  geoPlaces
    .map(p => ({
      ...p,
      dist: distance(
        state.coords.latitude,
        state.coords.longitude,
        p.lat,
        p.lng
      )
    }))
    .sort((a, b) => a.dist - b.dist)
    .forEach(place => {
      const div = document.createElement("div");
      div.className = "place-item";
      div.innerHTML = `
        <strong>${place.name}</strong><br>
        <small>${Math.round(place.dist)} متر</small>
      `;

      div.onclick = () => {
        mapInstance.setView([place.lat, place.lng], 17);
        activateGeoPlace(place);
      };

      box.appendChild(div);
    });
}

/* ================== INIT ================== */
function init(){
  const langList=document.getElementById("langList");
  LANGS.forEach(l=>{
    const b=document.createElement("button");
    b.textContent=l.native;
    b.onclick=()=>{
      state.lang=l.code;
      localStorage.setItem("maalem_lang",l.code);
      document.querySelectorAll("#langList button")
        .forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      document.getElementById("next1").disabled=false;
      updateUI();
    };
    langList.appendChild(b);
  });

  document.getElementById("next1").onclick=()=>goTo(2);
  document.getElementById("next2").onclick=()=>goTo(3);

  state.lang=localStorage.getItem("maalem_lang")||"ar";
  updateUI();

  // ✅ هنا
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js")
      .then(() => console.log("✅ Service Worker registered"))
      .catch(err => console.error("❌ SW error", err));
  }
}

