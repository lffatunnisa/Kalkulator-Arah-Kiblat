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

/* Desimal -> DMS. Dihitung dalam bilangan bulat per 1/100 detik supaya
   galat floating point (mis. 140.7 -> 140.69999...) tidak menghasilkan detik 60 atau menit 41 yang keliru. */
const toDMS = v => {
  const cs = Math.round(Math.abs(v) * 360000);          // 1/100 detik busur
  const d = Math.floor(cs / 360000), sisa = cs - d * 360000;
  const m = Math.floor(sisa / 6000);
  return {d, m, s: (sisa - m * 6000) / 100};
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
let qiblaAz = null;   // azimuth kiblat hasil hitung terakhir

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
/* ---------- contoh kota, urungkan, dan lokasi saya ---------- */
const FIELD_IDS = ["latDir", "latD", "latM", "latS", "lngDir", "lngD", "lngM", "lngS", "latX", "lngX"];
let undoInfo = null, toastTimer = null;
const ambilIsian = () => ({mode, v: FIELD_IDS.map(id => $(id).value)});
function pulihkanIsian(s){ FIELD_IDS.forEach((id, i) => { $(id).value = s.v[i]; }); setMode(s.mode); }
function tampilToast(pesan, undo){
  undoInfo = undo; $("toastMsg").textContent = pesan; $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("toast").hidden = true; undoInfo = null; }, 9000);
}
$("undoBtn").onclick = () => {
  if (!undoInfo) return;
  pulihkanIsian(undoInfo.sebelum); $("err").textContent = "";
  if (undoInfo.hitungUlang) hitung();
  else { $("readout").classList.remove("usang"); $("svg").classList.remove("usang"); }
  $("toast").hidden = true; undoInfo = null;
};
$("citySel").innerHTML = '<option value="">Isi dengan contoh kota…</option>' + Object.keys(CITIES).map(n => `<option>${n}</option>`).join("");
$("citySel").onchange = e => {
  const nama = e.target.value;
  if (!nama) return;
  const sebelum = ambilIsian(), [la, ln] = CITIES[nama];
  isiKoordinat(la, ln); e.target.value = ""; $("err").textContent = "";
  if (qiblaAz !== null) { $("readout").classList.add("usang"); $("svg").classList.add("usang"); }   // hasil lama belum diperbarui
  tampilToast(`Koordinat ${nama} terisi. Tekan "Hitung arah kiblat" untuk melihat hasilnya.`, {sebelum, hitungUlang: false});
};
$("geo").onclick = () => {
  if (!navigator.geolocation) { $("err").textContent = "Browser ini tidak mendukung geolokasi."; return; }
  $("geo").textContent = "Mencari lokasi…";
  navigator.geolocation.getCurrentPosition(p => {
    $("geo").textContent = "Pakai lokasi saya";
    const sebelum = ambilIsian();
    isiKoordinat(r5(p.coords.latitude), r5(p.coords.longitude));
    hitung();
    tampilToast("Koordinat diisi dari lokasi perangkat.", {sebelum, hitungUlang: true});
  }, () => {
    $("geo").textContent = "Pakai lokasi saya";
    $("err").textContent = "Lokasi tidak bisa diakses. Izinkan akses lokasi atau isi koordinat manual.";
  }, {timeout: 10000});
};
/* ---------- tema warna dan mode terang/gelap (disimpan di perangkat ini saja) ---------- */
const TEMA = ["hijau", "biru", "ungu", "terakota", "grafit"];
const simpanPref = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* penyimpanan tidak tersedia */ } };
const bacaPref = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
function terapkanMode(mode){
  document.documentElement.dataset.theme = mode;
  $("themeBtn").textContent = mode === "dark" ? "Mode terang" : "Mode gelap";
}
function terapkanTema(tema){
  if (!TEMA.includes(tema)) tema = "hijau";
  document.documentElement.dataset.tema = tema;
  document.querySelectorAll(".swatch").forEach(b => b.setAttribute("aria-checked", String(b.dataset.tema === tema)));
}
$("themeBtn").onclick = () => {
  const mode = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  terapkanMode(mode); simpanPref("qiblad.mode", mode);
};
document.querySelector(".swatches").onclick = e => {
  const b = e.target.closest(".swatch");
  if (!b) return;
  terapkanTema(b.dataset.tema); simpanPref("qiblad.tema", b.dataset.tema);
};
terapkanMode(bacaPref("qiblad.mode") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
terapkanTema(bacaPref("qiblad.tema"));
$("go").onclick = hitung;
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT") hitung(); });

/* ---------- pembangun persamaan MathML ---------- */
const MX = {
  n: x => { const v = String(x); return v.startsWith("-") ? `<mo>−</mo><mn>${v.slice(1)}</mn>` : `<mn>${v}</mn>`; },
  i: x => `<mi>${x}</mi>`, f: x => `<mi mathvariant="normal">${x}</mi>`, o: x => `<mo>${x}</mo>`, t: x => `<mtext>${x}</mtext>`,
  r: (...a) => `<mrow>${a.join("")}</mrow>`,
  sub: (b, s) => `<msub>${b}${s}</msub>`, frac: (a, b) => `<mfrac>${a}${b}</mfrac>`,
  p: x => `<mo lspace="0" rspace="0">(</mo>${x}<mo lspace="0" rspace="0">)</mo>`,
  res: x => `<mstyle class="res">${x}</mstyle>`
};
MX.g = x => MX.n(x) + `<mo lspace="0" rspace="0">°</mo>`;                                  // angka dengan tanda derajat
MX.fn = (nama, arg) => MX.f(nama) + "<mo>&#x2061;</mo>" + MX.p(arg);                       // fungsi, mis. sin(a)
MX.dms = o => MX.n(o.d) + `<mo lspace="0" rspace="0">°</mo>` + MX.n(o.m) + `<mo lspace="0" rspace="0">′</mo>` + MX.n(o.s) + `<mo lspace="0" rspace="0">″</mo>`;
const eq = (kiri, kanan) => `<mtr class="mulai"><mtd>${kiri}</mtd><mtd><mo>=</mo>${kanan}</mtd></mtr>`;      // baris persamaan
const lanjut = kanan => `<mtr><mtd></mtd><mtd><mo>=</mo>${kanan}</mtd></mtr>`;                // baris lanjutan, tanda = sejajar
const tabel = baris => `<div class="eqwrap"><math><mtable>${baris.join("")}</mtable></math></div>`;
const cotBNegatif = k => k.cotB < 0;   // arkus kotangen negatif -> B ditambah 180°

function bacaInput(){
  let lat, lng, info = {};
  if (mode === "DMS") {
    const v = id => parseFloat($(id).value), z = id => $(id).value.trim() === "" ? 0 : parseFloat($(id).value);   // menit/detik kosong dianggap 0
    const d1 = v("latD"), m1 = z("latM"), s1 = z("latS"), d2 = v("lngD"), m2 = z("lngM"), s2 = z("lngS");
    if (isNaN(d1) || isNaN(d2)) throw "Isi derajat lintang dan bujur terlebih dahulu.";
    if ([m1,s1,m2,s2].some(isNaN)) throw "Menit dan detik harus berupa angka.";
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
  $("readout").classList.remove("usang"); $("svg").classList.remove("usang");
  if (undoInfo && !undoInfo.hitungUlang) { $("toast").hidden = true; undoInfo = null; }   // pesan "tekan Hitung" sudah tidak relevan
  let inp;
  try { inp = bacaInput(); } catch (e) { $("err").textContent = e; return; }
  const {lat, lng, info} = inp;
  const k = hitungKiblat(lat, lng);
  const {az, B, special} = k;
  qiblaAz = az; $("svg").classList.remove("kosong");
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

  /* langkah perhitungan (persamaan MathML) */
  const S = [], bagian = (judul, isi) => S.push(`<section><div class="h">${judul}</div>${isi}</section>`);
  const catatan = t => `<p class="catatan">${t}</p>`;
  const nilaiPhi = ph => MX.sub(MX.i("φ"), MX.i(ph)), nilaiLam = ph => MX.sub(MX.i("λ"), MX.i(ph));
  const pecahan = (d, m, sd) => MX.n(d) + MX.o("+") + MX.frac(MX.n(m), MX.n(60)) + MX.o("+") + MX.frac(MX.n(sd), MX.n(3600));

  const data = [
    eq(nilaiPhi("k"), MX.dms({d: 21, m: 25, s: 21.03}) + MX.t("&#160;LU")),
    lanjut(pecahan(21, 25, 21.03)), lanjut(MX.g(KAABA.lat)),
    eq(nilaiLam("k"), MX.dms({d: 39, m: 49, s: 34.33}) + MX.t("&#160;BT")),
    lanjut(pecahan(39, 49, 34.33)), lanjut(MX.g(KAABA.lng))
  ];
  if (info.dms) {
    data.push(eq(nilaiPhi("t"), MX.dms({d: info.d1, m: info.m1, s: info.s1}) + MX.t("&#160;L" + info.aL)),
      lanjut(pecahan(info.d1, info.m1, info.s1)), lanjut(MX.g(lat)),
      eq(nilaiLam("t"), MX.dms({d: info.d2, m: info.m2, s: info.s2}) + MX.t("&#160;B" + info.aB)),
      lanjut(pecahan(info.d2, info.m2, info.s2)), lanjut(MX.g(lng)));
  } else {
    data.push(eq(nilaiPhi("t"), MX.g(lat)), lanjut(MX.dms(toDMS(lat)) + MX.t("&#160;L" + info.aL)),
      eq(nilaiLam("t"), MX.g(lng)), lanjut(MX.dms(toDMS(lng)) + MX.t("&#160;B" + info.aB)));
  }
  bagian("Data diketahui", tabel(data));

  const bar = x => `<mo lspace="0" rspace="0" stretchy="false">|</mo>${x}<mo lspace="0" rspace="0" stretchy="false">|</mo>`;
  bagian("Sudut segitiga bola", tabel([
    eq(MX.i("a"), MX.g(90) + MX.o("−") + nilaiPhi("t")), lanjut(MX.g(90) + MX.o("−") + MX.p(MX.g(lat))), lanjut(MX.g(r5(k.a))),
    eq(MX.i("b"), MX.g(90) + MX.o("−") + nilaiPhi("k")), lanjut(MX.g(90) + MX.o("−") + MX.p(MX.g(KAABA.lat))), lanjut(MX.g(r5(k.b))),
    eq(MX.i("C"), bar(nilaiLam("t") + MX.o("−") + nilaiLam("k"))),
    lanjut(bar(MX.p(MX.g(lng)) + MX.o("−") + MX.p(MX.g(KAABA.lng)))), lanjut(MX.g(k.C))
  ]) + (k.bujurRaw > 180 ? catatan(`Selisih bujur ${k.bujurRaw}° melebihi 180°, sehingga dinormalisasi lewat sisi terpendek: 360° − ${k.bujurRaw}° = ${k.C}°.`) : ""));

  if (special) {
    bagian("Kasus khusus", catatan("Tempat berada pada bujur yang sama atau berseberangan dengan Ka'bah, atau di kutub, sehingga arah kiblat lurus ke utara atau selatan.")
      + tabel([eq(MX.t("Azimuth"), MX.t(k.rumus)), lanjut(MX.res(MX.g(az))), lanjut(MX.dms(azD))]));
  } else {
    const tri = (nama, v, sudut, hasil) => eq(MX.fn(nama, MX.i(v)), MX.fn(nama, MX.g(sudut)) + MX.o("=") + MX.n(hasil));
    bagian("Nilai trigonometri", tabel([
      tri("sin", "a", r5(k.a), k.sinA), tri("cos", "a", r5(k.a), k.cosA), tri("cot", "b", r5(k.b), k.cotb),
      tri("sin", "C", k.C, k.sinC), tri("cot", "C", k.C, k.cotC)
    ]));
    const cot = v => MX.fn("cot", MX.i(v)), simb = (f, v) => MX.fn(f, MX.i(v));   // notasi seragam: sin(a), cot(B), dst.
    const kali = (x, y) => x + MX.o("×") + y;
    const suku1 = r5(k.cotb * k.sinA), suku2 = r5(k.cosA * k.cotC);
    bagian("Cotangen sudut B", tabel([
      eq(cot("B"), MX.frac(MX.r(kali(cot("b"), simb("sin", "a"))), MX.r(simb("sin", "C"))) + MX.o("−") + MX.r(kali(simb("cos", "a"), cot("C")))),
      lanjut(MX.frac(MX.r(kali(MX.n(k.cotb), MX.n(k.sinA))), MX.n(k.sinC)) + MX.o("−") + MX.p(kali(MX.n(k.cosA), MX.n(k.cotC)))),
      lanjut(MX.frac(MX.n(suku1), MX.n(k.sinC)) + MX.o("−") + MX.p(MX.n(suku2))),
      lanjut(MX.n(r5(suku1 / k.sinC)) + MX.o("−") + MX.p(MX.n(suku2))),
      lanjut(MX.res(MX.n(k.cotB)))
    ]));
    bagian("Sudut B", tabel([
      eq(MX.i("B"), MX.f("arccot") + "<mo>&#x2061;</mo>" + MX.p(MX.n(k.cotB))), lanjut(MX.res(MX.g(B))), lanjut(MX.dms(BD))
    ]) + (cotBNegatif(k) ? catatan("Sudut B hasil arkus kotangen bernilai negatif, sehingga ditambah 180°.") : ""));
    bagian("Azimuth", catatan(`Tempat berada di ${k.timur ? "timur" : "barat"} Ka'bah, sehingga rumus Azimuth yang dipakai adalah ${k.rumus}.`)
      + tabel(k.timur
        ? [eq(MX.t("Azimuth"), MX.g(360) + MX.o("−") + MX.i("B")), lanjut(MX.g(360) + MX.o("−") + MX.g(B)), lanjut(MX.res(MX.g(az))), lanjut(MX.dms(azD))]
        : [eq(MX.t("Azimuth"), MX.i("B")), lanjut(MX.res(MX.g(az))), lanjut(MX.dms(azD))]));
  }
  $("steps").innerHTML = S.join("");
  $("stepsPanel").hidden = false;
  perbaruiLive();
}

/* ---------- kompas langsung (sensor arah perangkat) ---------- */
let live = {aktif: false, arah: null};
let liveHalus = 0, liveGulung = 0, liveAdaData = false, liveTimer = null, adaAbsolut = false;
const deklinasi = () => parseFloat($("decl").value) || 0;

/* Arah bagian atas layar HP, derajat dari utara magnetik searah jarum jam. null jika sensor tidak mutlak. */
function arahDariSensor(e){
  if (typeof e.webkitCompassHeading === "number") return e.webkitCompassHeading;       // iOS (sudah dikompensasi kemiringan)
  if (e.alpha === null || e.alpha === undefined) return null;
  if (!(e.absolute || e.type === "deviceorientationabsolute")) return null;            // sensor relatif tidak tahu arah utara
  const a = rad(e.alpha), b = rad(e.beta || 0), g = rad(e.gamma || 0);
  if (Math.abs(Math.cos(b)) > 0.35)                                                    // HP mendatar atau agak miring: tepi atas HP
    return norm360(deg(Math.atan2(-Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b))));
  const vx = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);     // HP hampir tegak: arah belakang HP
  const vy = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  return norm360(deg(Math.atan2(vx, vy)));
}

function putarKompas(h){            // h: arah sejati HP
  if (!liveAdaData) { liveAdaData = true; liveHalus = h; liveGulung = h; }
  else { const d = normDiff(h - liveHalus) * 0.25; liveHalus = norm360(liveHalus + d); liveGulung += d; }  // peredam getaran sensor
  live.arah = liveHalus;
  $("dial").style.transform = `rotate(${-liveGulung}deg)`;
  perbaruiLive();
}

function perbaruiLive(){
  if (!live.aktif || live.arah === null || qiblaAz === null) return;
  const sel = normDiff(qiblaAz - live.arah), ok = Math.abs(sel) <= 3, st = $("liveStatus");
  st.hidden = false; st.classList.toggle("ok", ok); $("svg").classList.toggle("hadap", ok);
  st.innerHTML = ok ? `<b>Menghadap kiblat</b> (selisih ${Math.abs(sel).toFixed(1)}°)`
    : `Arah HP <b>${Math.round(live.arah)}°</b>. Putar badan ${Math.abs(Math.round(sel))}° ke ${sel > 0 ? "kanan" : "kiri"} sampai jarum hijau berada di atas.`;
}

function onSensor(e){
  if (e.type === "deviceorientationabsolute") {
    if (e.alpha === null || e.alpha === undefined) return;   // beberapa browser mengirim event kosong saat listener dipasang
    adaAbsolut = true;
  } else if (adaAbsolut) return;                              // sudah ada sensor mutlak, abaikan yang relatif
  const h = arahDariSensor(e);
  if (h === null) return;
  if (!liveAdaData) { clearTimeout(liveTimer); $("liveMsg").textContent = ""; }
  putarKompas(norm360(h + deklinasi()));
}

async function aktifkanLive(){
  const msg = $("liveMsg"); msg.textContent = "";
  if (qiblaAz === null) { msg.textContent = "Hitung arah kiblat dulu (isi koordinat lalu tekan Hitung), baru aktifkan kompas langsung."; return; }
  if (!("DeviceOrientationEvent" in window)) { msg.textContent = "Browser atau perangkat ini tidak mendukung sensor arah. Kompas langsung umumnya hanya tersedia di HP."; return; }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {              // iOS meminta izin lewat tombol
      if (await DeviceOrientationEvent.requestPermission() !== "granted") { msg.textContent = "Izin sensor ditolak. Izinkan akses gerakan dan orientasi pada pengaturan browser, lalu coba lagi."; return; }
    }
  } catch (err) { msg.textContent = "Izin sensor tidak dapat diminta. Pastikan halaman dibuka lewat HTTPS."; return; }
  live = {aktif: true, arah: null}; liveAdaData = false; adaAbsolut = false;
  window.addEventListener("deviceorientationabsolute", onSensor);
  window.addEventListener("deviceorientation", onSensor);
  $("liveBtn").textContent = "Matikan kompas langsung"; $("liveOpts").hidden = false; $("svg").classList.add("live");
  msg.textContent = "Menunggu data sensor…";
  liveTimer = setTimeout(() => { if (!liveAdaData) msg.textContent = "Tidak ada data sensor arah. Kompas langsung hanya berfungsi di HP, lewat HTTPS, dengan izin sensor aktif."; }, 3000);
}
function matikanLive(){
  window.removeEventListener("deviceorientationabsolute", onSensor);
  window.removeEventListener("deviceorientation", onSensor);
  clearTimeout(liveTimer); live = {aktif: false, arah: null};
  $("dial").style.transform = ""; $("svg").classList.remove("live", "hadap");
  $("liveStatus").hidden = true; $("liveOpts").hidden = true; $("liveMsg").textContent = "";
  $("liveBtn").textContent = "Aktifkan kompas langsung";
}
$("liveBtn").onclick = () => live.aktif ? matikanLive() : aktifkanLive();
