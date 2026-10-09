/* =====================================================
   INTI PERHITUNGAN (tanpa DOM)
   ===================================================== */
const r5 = x => Math.round(x * 1e5) / 1e5;
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const norm360 = a => ((a % 360) + 360) % 360;
const normLng = d => ((d + 180) % 360 + 360) % 360 - 180;   // ke rentang [-180, 180)
const normDiff = d => { d = norm360(d); return d > 180 ? d - 360 : d; };  // ke rentang (-180, 180]

const KAABA = {
  lat: r5(21 + 25/60 + 21.03/3600),
  lng: r5(39 + 49/60 + 34.33/3600)
};

const toDMS = v => {
  const t = Math.abs(v), d = Math.floor(t), mf = (t - d) * 60, m = Math.floor(mf);
  return {d, m, s: Math.round((mf - m) * 60 * 100) / 100};
};
const fmtDMS = (o, suffix) => `${o.d}° ${o.m}' ${o.s}"` + (suffix ? ` ${suffix}` : "");

/* Arah kiblat dengan rumus segitiga bola.
   Selisih bujur dinormalisasi ke -180..180 supaya lokasi di Pasifik
   (Hawaii, Samoa, Alaska barat) tidak salah arah. */
function hitungKiblat(lat, lng){
  const dl = normLng(lng - KAABA.lng);          // > 0: tempat di timur Ka'bah
  const C = r5(Math.abs(dl));
  const a = 90 - lat, b = 90 - KAABA.lat;
  const timur = dl > 0;
  const hasil = {lat, lng, dl, C, a, b, timur, bujurRaw: r5(Math.abs(lng - KAABA.lng))};
  const sinA0 = Math.sin(rad(a));

  if (C === 0 || C === 180 || Math.abs(sinA0) < 1e-9) {
    let az;
    if (Math.abs(sinA0) < 1e-9) az = lat > 0 ? 180 : 0;            // di kutub
    else if (C === 180) az = (lat + KAABA.lat) > 0 ? 0 : 180;       // bujur berseberangan: lewat kutub terdekat
    else az = lat > KAABA.lat ? 180 : 0;                            // satu bujur dengan Ka'bah
    return {...hasil, special: true, B: az, az,
      rumus: az === 180 ? "Lurus ke Selatan (180°)" : "Lurus ke Utara (0°)"};
  }

  const sinA = r5(sinA0), cosA = r5(Math.cos(rad(a)));
  const cotb = r5(1 / Math.tan(rad(b)));
  const sinC = r5(Math.sin(rad(C))), cotC = r5(1 / Math.tan(rad(C)));
  const cotB = r5((cotb * sinA) / sinC - cosA * cotC);
  let B = r5(deg(cotB === 0 ? Math.PI / 2 : Math.atan(1 / cotB)));
  if (B < 0) B += 180;
  // B selalu diukur dari Utara menuju sisi Ka'bah:
  // tempat di timur Ka'bah -> kiblat ke barat (360° - B), di barat Ka'bah -> kiblat ke timur (B)
  const az = r5(timur ? 360 - B : B);
  return {...hasil, special: false, sinA, cosA, cotb, sinC, cotC, cotB, B, az,
    rumus: timur ? "360° - B" : "B"};
}

/* Notasi arah dari B: dari Utara/Selatan dan dari Barat/Timur */
function notasiArah(B, timur){
  const sisi = timur ? "Barat" : "Timur";
  const dariUtara = `${B.toFixed(2)}° dari Utara ke ${sisi}`;
  const alt = B <= 90 ? `${(90 - B).toFixed(2)}° dari ${sisi} ke Utara`
                      : `${(B - 90).toFixed(2)}° dari ${sisi} ke Selatan`;
  return {dariUtara, alt, sisi};
}

/* =====================================================
   UI
   ===================================================== */
const $ = id => document.getElementById(id);
const CITIES = {
  "Yogyakarta":[-7.78333,110.36667], "Jakarta":[-6.2,106.81667], "Surabaya":[-7.25,112.75],
  "Medan":[3.58333,98.66667], "Makassar":[-5.14,119.41], "Denpasar":[-8.65,115.21667], "Jayapura":[-2.53,140.7]
};
let mode = "DMS";

(function gambarSkala(){
  let h = "";
  const names = {0:"U",45:"TL",90:"T",135:"TG",180:"S",225:"BD",270:"B",315:"BL"};
  for (let a = 0; a < 360; a += 5) {
    const major = a % 45 === 0, mid = a % 15 === 0;
    const r1 = 168, r2 = major ? 150 : mid ? 157 : 162;
    const s = Math.sin(rad(a)), c = -Math.cos(rad(a));
    h += `<line x1="${200+r1*s}" y1="${200+r1*c}" x2="${200+r2*s}" y2="${200+r2*c}" stroke="var(--mute)" stroke-width="${major?2:1}"/>`;
    if (major) h += `<text x="${200+186*s}" y="${200+186*c}" text-anchor="middle" dominant-baseline="central" font-size="${a%90===0?15:11}" font-weight="600" fill="var(--ink)" font-family="Instrument Sans,sans-serif">${names[a]}</text>`;
  }
  $("ticks").innerHTML = h;
})();

function setMode(m){
  mode = m;
  $("tDMS").setAttribute("aria-selected", m === "DMS");
  $("tDEC").setAttribute("aria-selected", m === "DEC");
  $("fDMS").hidden = m !== "DMS"; $("fDEC").hidden = m !== "DEC";
}
$("tDMS").onclick = () => setMode("DMS");
$("tDEC").onclick = () => setMode("DEC");

function isiKoordinat(lat, lng){
  $("latX").value = lat; $("lngX").value = lng;
  const a = toDMS(lat), b = toDMS(lng);
  $("latDir").value = lat < 0 ? "S" : "U"; $("latD").value = a.d; $("latM").value = a.m; $("latS").value = a.s;
  $("lngDir").value = lng < 0 ? "B" : "T"; $("lngD").value = b.d; $("lngM").value = b.m; $("lngS").value = b.s;
}
$("chips").innerHTML = Object.keys(CITIES).map(n => `<button type="button" class="chip">${n}</button>`).join("");
$("chips").onclick = e => {
  if (!e.target.classList.contains("chip")) return;
  const [la, ln] = CITIES[e.target.textContent];
  isiKoordinat(la, ln); hitung();
};
$("geo").onclick = () => {
  if (!navigator.geolocation) { $("err").textContent = "Browser ini tidak mendukung geolokasi."; return; }
  $("geo").textContent = "Mencari lokasi…";
  navigator.geolocation.getCurrentPosition(p => {
    $("geo").textContent = "Pakai lokasi saya";
    isiKoordinat(r5(p.coords.latitude), r5(p.coords.longitude));
    hitung();
  }, () => {
    $("geo").textContent = "Pakai lokasi saya";
    $("err").textContent = "Lokasi tidak bisa diakses. Izinkan akses lokasi atau isi koordinat manual.";
  }, {timeout: 10000});
};
$("themeBtn").onclick = () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  $("themeBtn").textContent = dark ? "Mode gelap" : "Mode terang";
};
$("go").onclick = hitung;
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT") hitung(); });

function bacaInput(){
  let lat, lng, info = {};
  if (mode === "DMS") {
    const v = id => parseFloat($(id).value);
    const d1 = v("latD"), m1 = v("latM"), s1 = v("latS"), d2 = v("lngD"), m2 = v("lngM"), s2 = v("lngS");
    if ([d1,m1,s1,d2,m2,s2].some(isNaN)) throw "Lengkapi semua kolom derajat, menit, dan detik.";
    if (m1 >= 60 || m2 >= 60 || s1 >= 60 || s2 >= 60 || [d1,m1,s1,d2,m2,s2].some(x => x < 0)) throw "Menit dan detik harus 0–59,99 dan tidak boleh negatif.";
    lat = r5(d1 + m1/60 + s1/3600); lng = r5(d2 + m2/60 + s2/3600);
    const aL = $("latDir").value, aB = $("lngDir").value;
    if (aL === "S") lat = -lat;
    if (aB === "B") lng = -lng;
    info = {dms:true, aL, aB, d1, m1, s1, d2, m2, s2};
  } else {
    lat = parseFloat($("latX").value); lng = parseFloat($("lngX").value);
    if (isNaN(lat) || isNaN(lng)) throw "Isi lintang dan bujur dalam angka desimal.";
    info = {dms:false, aL: lat < 0 ? "S" : "U", aB: lng < 0 ? "B" : "T"};
  }
  if (Math.abs(lat) > 90) throw "Lintang harus antara −90° dan 90°.";
  if (Math.abs(lng) > 180) throw "Bujur harus antara −180° dan 180°.";
  return {lat, lng, info};
}

function hitung(){
  $("err").textContent = "";
  let inp;
  try { inp = bacaInput(); } catch (e) { $("err").textContent = e; return; }
  const {lat, lng, info} = inp;
  const k = hitungKiblat(lat, lng);
  const {az, B, special} = k;
  const azD = toDMS(az), BD = toDMS(B);
  const n = notasiArah(B, k.timur);
  const rel = special ? "Lurus" : k.timur ? "Barat (U-B)" : "Timur (U-T)";

  $("readout").innerHTML = `
    <div class="stat main"><small>Azimuth kiblat (dari Utara sejati, searah jarum jam)</small><b>${az.toFixed(4)}°</b><small>${fmtDMS(azD)}</small></div>
    <div class="stat"><small>Sudut B</small><b>${B.toFixed(4)}°</b><small>${fmtDMS(BD)}</small></div>
    <div class="stat"><small>Arah dari Utara</small><b>${rel}</b><small>${special ? "satu bujur dengan Ka'bah" : n.dariUtara + "<br>" + n.alt}</small></div>`;

  const needle = $("needle");
  needle.style.transform = "rotate(0deg)";
  requestAnimationFrame(() => requestAnimationFrame(() => needle.style.transform = `rotate(${az}deg)`));
  const R = 168, x = 200 + R * Math.sin(rad(az)), y = 200 - R * Math.cos(rad(az));
  $("arc").setAttribute("d", az === 0 ? "" : `M200 200 L200 ${200-R} A${R} ${R} 0 ${az > 180 ? 1 : 0} 1 ${x} ${y} Z`);

  /* langkah perhitungan */
  const L = [], h = t => L.push(`<span class="h">${t}</span>`);
  h("Data diketahui");
  L.push(`Lintang Ka'bah (φk) = 21° 25' 21.03" LU = ${KAABA.lat}°`);
  L.push(`Bujur Ka'bah (λk)   = 39° 49' 34.33" BT = ${KAABA.lng}°`);
  if (info.dms) {
    L.push(`Lintang tempat (φt) = ${info.d1}° ${info.m1}' ${info.s1}" L${info.aL}`);
    L.push(`                    = ${info.d1} + (${info.m1}/60) + (${info.s1}/3600) = ${lat}°`);
    L.push(`Bujur tempat (λt)   = ${info.d2}° ${info.m2}' ${info.s2}" B${info.aB}`);
    L.push(`                    = ${info.d2} + (${info.m2}/60) + (${info.s2}/3600) = ${lng}°`);
  } else {
    L.push(`Lintang tempat (φt) = ${lat}° = ${fmtDMS(toDMS(lat), "L" + info.aL)}`);
    L.push(`Bujur tempat (λt)   = ${lng}° = ${fmtDMS(toDMS(lng), "B" + info.aB)}`);
  }
  h("Sudut segitiga bola");
  L.push(`a = 90° - φt = 90° - (${lat}°) = ${r5(k.a)}°`);
  L.push(`b = 90° - φk = 90° - (${KAABA.lat}°) = ${r5(k.b)}°`);
  L.push(`C = |λt - λk| = |(${lng}°) - (${KAABA.lng}°)| = ${k.C}°`);
  if (k.bujurRaw > 180) L.push(`(selisih bujur ${k.bujurRaw}° melebihi 180°, dinormalisasi lewat sisi terpendek: 360° - ${k.bujurRaw}° = ${k.C}°)`);
  if (special) {
    h("Kasus khusus");
    L.push("Tempat berada pada bujur yang sama atau berseberangan dengan Ka'bah, atau di kutub, sehingga arah kiblat lurus ke utara atau selatan.");
    L.push(`Azimuth = ${k.rumus} = <span class="res">${az}° (${fmtDMS(azD)})</span>`);
  } else {
    h("Nilai trigonometri");
    L.push(`sin(a) = sin(${r5(k.a)}°) = ${k.sinA}`);
    L.push(`cos(a) = cos(${r5(k.a)}°) = ${k.cosA}`);
    L.push(`cot(b) = cot(${r5(k.b)}°) = ${k.cotb}`);
    L.push(`sin(C) = sin(${k.C}°) = ${k.sinC}`);
    L.push(`cot(C) = cot(${k.C}°) = ${k.cotC}`);
    h("Cotangen sudut B");
    L.push(`cot(B) = ((cot b × sin a) / sin C) - (cos a × cot C)`);
    L.push(`       = ((${k.cotb} × ${k.sinA}) / ${k.sinC}) - (${k.cosA} × ${k.cotC})`);
    L.push(`       = (${r5(k.cotb*k.sinA)} / ${k.sinC}) - (${r5(k.cosA*k.cotC)})`);
    L.push(`       = ${r5(k.cotb*k.sinA/k.sinC)} - (${r5(k.cosA*k.cotC)})`);
    L.push(`       = <span class="res">${k.cotB}</span>`);
    h("Sudut B");
    L.push(`B = arccot(${k.cotB}) = <span class="res">${B}° (${fmtDMS(BD)})</span>`);
    h("Azimuth");
    L.push(`Tempat berada di ${k.timur ? "timur" : "barat"} Ka'bah, maka Azimuth = ${k.rumus}`);
    if (k.timur) L.push(`        = 360° - ${B}°`);
    L.push(`        = <span class="res">${az}° (${fmtDMS(azD)})</span>`);
  }
  $("steps").innerHTML = L.join("\n");
  $("stepsPanel").hidden = false;
}

hitung();
