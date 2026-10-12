const DB_NAME = "haja-on-db";
const DB_VERSION = 1;
const STATE_KEY = "state";
const initialState = {
  defects: [],
  vendors: ["우미창호", "대한방수", "한빛타일", "푸른도장", "정우설비"],
  settings: { siteName: "우미건설 시범현장", siteCode: "WMI-001", drawing: "" }
};
let state = structuredClone(initialState);
let draftPhotos = [];
let recognition;
let currentFiltered = [];

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
const formatDate = value => new Intl.DateTimeFormat("ko-KR", {month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value));
const makeId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const getSeason = value => {
  const month = new Date(value).getMonth() + 1;
  return month >= 3 && month <= 5 ? "봄" : month >= 6 && month <= 8 ? "여름" : month >= 9 && month <= 11 ? "가을" : "겨울";
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore("app");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadState() {
  const db = await openDb();
  const saved = await new Promise((resolve, reject) => {
    const request = db.transaction("app").objectStore("app").get(STATE_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (saved) state = {...structuredClone(initialState), ...saved, settings: {...initialState.settings, ...saved.settings}};
  db.close();
}

async function saveState() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const request = db.transaction("app", "readwrite").objectStore("app").put(state, STATE_KEY);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  db.close();
}

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 2400);
}

function showView(id) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === id));
  document.querySelectorAll(".bottom-nav button").forEach(button => button.classList.toggle("active", button.dataset.view === id));
  if (id === "dashboardView") renderDashboard();
  if (id === "listView") renderList();
  if (id === "analyticsView") renderAnalytics();
  if (id === "settingsView") renderSettings();
  window.scrollTo({top:0, behavior:"smooth"});
}

function updateNetwork() {
  const online = navigator.onLine;
  $("networkState").classList.toggle("offline", !online);
  $("networkState").querySelector("span").textContent = online ? "온라인" : "오프라인 저장";
  $("syncNote").textContent = online ? "이 기기에 저장되며 오프라인에서도 계속 사용할 수 있습니다." : "통신이 없습니다. 등록 내용은 이 기기에 임시 저장됩니다.";
}

function renderDashboard() {
  const counts = Object.fromEntries(["등록","진행중","확인대기","완료"].map(status => [status, state.defects.filter(d => d.status === status).length]));
  $("countRegistered").textContent = counts["등록"];
  $("countProgress").textContent = counts["진행중"];
  $("countReview").textContent = counts["확인대기"];
  $("countDone").textContent = counts["완료"];
  const open = state.defects.filter(d => d.status !== "완료");
  $("openTotal").textContent = `${open.length}건`;
  const groups = open.reduce((acc, d) => (acc[d.trade || "기타"] = (acc[d.trade || "기타"] || 0) + 1, acc), {});
  const max = Math.max(1, ...Object.values(groups));
  $("tradeChart").innerHTML = Object.keys(groups).length ? Object.entries(groups).sort((a,b) => b[1]-a[1]).map(([trade,count]) => `
    <div class="bar-row"><span>${escapeHtml(trade)}</span><div class="bar-track"><div class="bar-fill" style="width:${count/max*100}%"></div></div><b>${count}</b></div>`).join("") : '<p class="empty-inline">하자를 등록하면 공종별 현황이 표시됩니다.</p>';
}

function parseVoice(text) {
  const cleaned = text.replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
  const result = {};
  const patterns = {
    building: /(\d{1,4})\s*동/,
    floor: /(지하\s*\d{1,2}|\d{1,2})\s*층/,
    unit: /(\d{1,4})\s*호/
  };
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = cleaned.match(pattern);
    if (match) result[key] = `${match[1].replace(/\s/g, "")}${key === "building" ? "동" : key === "floor" ? "층" : "호"}`;
  }
  const rooms = ["지하주차장","기계실","전기실","안방","거실","주방","욕실","화장실","현관","발코니","침실","복도","계단실"];
  result.room = rooms.find(room => cleaned.includes(room)) || "";
  const rules = [
    {words:["코킹","실리콘"], defectType:"코킹 누락", trade:"창호"},
    {words:["누수","물 샘","물샘"], defectType:"누수", trade:"방수"},
    {words:["타일","도기"], defectType:"타일 파손", trade:"타일"},
    {words:["도배","벽지"], defectType:"도배 들뜸", trade:"도배"},
    {words:["도장","페인트"], defectType:"도장 불량", trade:"도장"},
    {words:["창틀","창호","샷시","문짝","문틀"], defectType:"문·창호 불량", trade:"창호"},
    {words:["배관","수전","변기","설비"], defectType:"설비 불량", trade:"설비"}
  ];
  const rule = rules.find(item => item.words.some(word => cleaned.includes(word)));
  if (rule) Object.assign(result, rule);
  const temperature = cleaned.match(/(-?\d{1,2}(?:\.\d+)?)\s*도/);
  if (temperature) result.temperature = temperature[1];
  result.weather = ["고온다습","맑음","흐림","비","눈","한파","실내"].find(value => cleaned.includes(value)) || "";
  result.description = cleaned;
  return result;
}

function applyVoiceText() {
  const text = $("voiceText").value.trim();
  if (!text) return toast("먼저 내용을 말하거나 입력해주세요.");
  const parsed = parseVoice(text);
  ["building","floor","unit","room","defectType","trade","description","temperature","weather"].forEach(key => {
    if (parsed[key]) $(key).value = parsed[key];
  });
  if (parsed.trade) {
    const vendor = state.vendors.find(name => name.includes(parsed.trade));
    if (vendor) $("vendor").value = vendor;
  }
  const missing = ["building","floor","room","defectType","trade"].filter(key => !parsed[key]);
  $("voiceStatus").textContent = missing.length ? `입력했습니다. 찾지 못한 항목은 직접 확인해주세요: ${missing.join(", ")}` : "위치와 하자 내용을 입력했습니다. 등록 전 확인해주세요.";
  toast("음성 내용을 입력란에 반영했습니다.");
}

function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    $("voiceStatus").textContent = "이 브라우저는 음성인식을 지원하지 않습니다. 말한 내용을 직접 입력할 수 있습니다.";
    $("voiceButton").disabled = true;
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => { $("voiceButton").classList.add("listening"); $("voiceButton").setAttribute("aria-pressed", "true"); $("voiceStatus").textContent = "듣고 있습니다. 자유롭게 말씀하세요."; };
  recognition.onresult = event => {
    const transcript = Array.from(event.results).map(result => result[0].transcript).join(" ");
    $("voiceText").value = transcript;
    if (event.results[event.results.length - 1].isFinal) applyVoiceText();
  };
  recognition.onerror = event => { $("voiceStatus").textContent = event.error === "not-allowed" ? "마이크 권한이 필요합니다." : "음성을 인식하지 못했습니다. 다시 시도해주세요."; };
  recognition.onend = () => { $("voiceButton").classList.remove("listening"); $("voiceButton").setAttribute("aria-pressed", "false"); };
}

function compressImage(file, maxSize = 1920, quality = .82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderPhotoPreview() {
  $("photoPreview").innerHTML = draftPhotos.map((src, index) => `<div class="photo-thumb"><img src="${src}" alt="하자 사진 ${index+1}"><button type="button" data-remove-photo="${index}" aria-label="사진 삭제">×</button></div>`).join("");
}

async function addPhotos(files) {
  const images = Array.from(files).filter(file => file.type.startsWith("image/"));
  if (!images.length) return;
  toast("사진을 최적화하고 있습니다.");
  for (const file of images.slice(0, 6 - draftPhotos.length)) draftPhotos.push(await compressImage(file));
  renderPhotoPreview();
  toast(`${images.length}장의 사진을 준비했습니다.`);
}

function setPin(event) {
  const rect = $("drawingBoard").getBoundingClientRect();
  const x = Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100));
  const y = Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100));
  $("pinX").value = x.toFixed(2); $("pinY").value = y.toFixed(2);
  Object.assign($("drawingPin").style, {left:`${x}%`, top:`${y}%`});
  $("drawingPin").hidden = false;
  $("pinStatus").textContent = `위치 지정 완료 (${Math.round(x)}%, ${Math.round(y)}%)`;
}

async function submitDefect(event) {
  event.preventDefault();
  const defect = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reporter: "현장 사용자",
    status: "등록",
    siteName: state.settings.siteName,
    building: $("building").value.trim(), floor: $("floor").value.trim(), unit: $("unit").value.trim(), room: $("room").value.trim(),
    pinX: $("pinX").value, pinY: $("pinY").value,
    defectType: $("defectType").value, trade: $("trade").value, description: $("description").value.trim(), vendor: $("vendor").value.trim(),
    temperature: $("temperature").value === "" ? null : Number($("temperature").value), weather: $("weather").value, season: $("season").value,
    photos: [...draftPhotos], completionPhotos: [], opinions: [], voiceText: $("voiceText").value.trim()
  };
  state.defects.unshift(defect);
  if (defect.vendor) defect.status = "진행중";
  await saveState();
  const keep = $("keepLocation").checked ? {building:defect.building,floor:defect.floor,unit:defect.unit,room:defect.room} : {};
  clearForm();
  Object.entries(keep).forEach(([key,value]) => $(key).value = value);
  toast(navigator.onLine ? "하자를 등록했습니다." : "오프라인으로 임시 저장했습니다.");
  showView("listView");
}

function clearForm() {
  $("defectForm").reset();
  $("keepLocation").checked = true;
  $("season").value = getSeason(new Date());
  draftPhotos = [];
  renderPhotoPreview();
  $("voiceStatus").textContent = "";
  $("pinX").value = ""; $("pinY").value = ""; $("drawingPin").hidden = true;
  $("pinStatus").textContent = "도면에서 위치를 누르세요.";
}

function statusClass(status) {
  return status === "진행중" ? "progress" : status === "확인대기" ? "review" : status === "완료" ? "done" : status === "반려" ? "reject" : "";
}

function renderList() {
  const query = $("searchInput").value.trim().toLowerCase();
  const status = $("statusFilter").value;
  const trade = $("tradeFilter").value;
  currentFiltered = state.defects.filter(d => {
    const haystack = [d.building,d.floor,d.unit,d.room,d.description,d.defectType,d.vendor].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (!status || d.status === status) && (!trade || d.trade === trade);
  });
  $("resultCount").textContent = `${currentFiltered.length}건`;
  $("defectList").innerHTML = "";
  if (!currentFiltered.length) {
    $("defectList").innerHTML = '<div class="empty-state"><b>표시할 하자가 없습니다.</b><p>현장에서 발견한 하자를 사진과 음성으로 등록해보세요.</p></div>';
    return;
  }
  const template = $("defectCardTemplate");
  currentFiltered.forEach(defect => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector("article");
    card.dataset.id = defect.id;
    node.querySelector(".row-check").dataset.id = defect.id;
    const photo = node.querySelector(".card-photo");
    const src = defect.completionPhotos?.[0] || defect.photos?.[0];
    if (src) photo.innerHTML = `<img src="${src}" alt="${escapeHtml(defect.description)}">`;
    const badge = node.querySelector(".status-badge"); badge.textContent = defect.status; badge.classList.add(statusClass(defect.status));
    node.querySelector(".card-time").textContent = formatDate(defect.createdAt);
    node.querySelector(".card-location").textContent = [defect.building,defect.floor,defect.unit,defect.room].filter(Boolean).join(" ");
    node.querySelector(".card-description").textContent = defect.description;
    node.querySelector(".card-meta").innerHTML = [defect.defectType,defect.trade,defect.vendor || "업체 미지정",defect.season || getSeason(defect.createdAt),Number.isFinite(defect.temperature) ? `${defect.temperature}°C` : "",defect.weather || ""].filter(Boolean).map(value => `<span>${escapeHtml(value)}</span>`).join("");
    const actions = [];
    actions.push(`<button data-action="vendor">업체 변경</button>`);
    actions.push(`<button data-action="opinion">의견 ${defect.opinions?.length || 0}</button>`);
    if (["등록","반려"].includes(defect.status)) actions.push('<button class="primary" data-action="start">보수 시작</button>');
    if (defect.status === "진행중") actions.push('<button class="primary" data-action="request">보수 완료 요청</button>');
    if (defect.status === "확인대기") actions.push('<button data-action="reject">반려</button><button class="primary" data-action="approve">완료 확인</button>');
    actions.push('<button data-action="delete">삭제</button>');
    node.querySelector(".card-actions").innerHTML = actions.join("");
    $("defectList").appendChild(node);
  });
}

async function updateDefectAction(id, action) {
  const defect = state.defects.find(item => item.id === id);
  if (!defect) return;
  if (action === "vendor") {
    const value = prompt("보수업체명을 입력하세요.", defect.vendor || "");
    if (value === null) return;
    defect.vendor = value.trim();
    if (defect.vendor && defect.status === "등록") defect.status = "진행중";
  }
  if (action === "start") {
    if (!defect.vendor) {
      const vendor = prompt("보수업체를 먼저 지정하세요.", "");
      if (!vendor?.trim()) return;
      defect.vendor = vendor.trim();
    }
    defect.status = "진행중";
  }
  if (action === "request") {
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.capture = "environment";
    const file = await new Promise(resolve => { input.onchange = () => resolve(input.files[0]); input.click(); });
    if (!file) return toast("완료 확인을 요청하려면 보수 완료 사진이 필요합니다.");
    defect.completionPhotos = [await compressImage(file)];
    defect.status = "확인대기";
  }
  if (action === "approve") defect.status = "완료";
  if (action === "reject") {
    const reason = prompt("반려 사유를 입력하세요.", "보수 상태 재확인 필요");
    if (reason === null) return;
    defect.status = "반려";
    defect.opinions.push({text:`반려: ${reason}`, at:new Date().toISOString()});
  }
  if (action === "opinion") {
    const history = defect.opinions?.map(item => `• ${item.text}`).join("\n") || "등록된 의견 없음";
    const text = prompt(`현재 의견\n${history}\n\n새 의견을 입력하세요.`, "");
    if (!text?.trim()) return;
    defect.opinions.push({text:text.trim(), at:new Date().toISOString()});
  }
  if (action === "delete") {
    if (!confirm("이 하자와 사진을 삭제할까요? 삭제 후 복구할 수 없습니다.")) return;
    state.defects = state.defects.filter(item => item.id !== id);
  } else defect.updatedAt = new Date().toISOString();
  await saveState();
  renderList(); renderDashboard();
  toast("변경사항을 저장했습니다.");
}

function exportExcel(defects, filename = "하자사진대지") {
  if (!defects.length) return toast("출력할 하자를 선택해주세요.");
  const rows = defects.map((d, index) => `<tr><td>${index+1}</td><td>${escapeHtml([d.building,d.floor,d.unit,d.room].filter(Boolean).join(" "))}</td><td>${escapeHtml(d.defectType)}</td><td>${escapeHtml(d.description)}</td><td>${escapeHtml(d.trade)}</td><td>${escapeHtml(d.vendor || "")}</td><td>${escapeHtml(d.status)}</td><td>${escapeHtml(d.season || getSeason(d.createdAt))}</td><td>${Number.isFinite(d.temperature) ? d.temperature : ""}</td><td>${escapeHtml(d.weather || "")}</td><td>${d.photos?.[0] ? `<img src="${d.photos[0]}" width="180">` : ""}</td><td>${d.completionPhotos?.[0] ? `<img src="${d.completionPhotos[0]}" width="180">` : ""}</td><td>${escapeHtml(formatDate(d.createdAt))}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>table{border-collapse:collapse;font-family:Arial,sans-serif}th,td{border:1px solid #999;padding:8px;vertical-align:middle}th{background:#dce6f1}img{max-width:180px;max-height:140px}</style></head><body><table><tr><th>No</th><th>위치</th><th>하자유형</th><th>지적내용</th><th>공종</th><th>업체</th><th>상태</th><th>계절</th><th>기온 °C</th><th>날씨</th><th>보수 전</th><th>보수 후</th><th>등록일</th></tr>${rows}</table></body></html>`;
  downloadBlob(new Blob(["\ufeff", html], {type:"application/vnd.ms-excel"}), `${filename}_${new Date().toISOString().slice(0,10)}.xls`);
  toast(`${defects.length}건을 엑셀 파일로 만들었습니다.`);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function countBy(items, keyFn) {
  return items.reduce((acc, item) => { const key = keyFn(item); if (key) acc[key] = (acc[key] || 0) + 1; return acc; }, {});
}

function renderAnalysisBars(targetId, groups, emptyText) {
  const entries = Object.entries(groups).sort((a,b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([,count]) => count));
  $(targetId).innerHTML = entries.length ? entries.map(([label,count]) => `<div class="bar-row"><span>${escapeHtml(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${count/max*100}%"></div></div><b>${count}</b></div>`).join("") : `<p class="empty-inline">${escapeHtml(emptyText)}</p>`;
}

function renderAnalytics() {
  const selected = $("analyticsTypeFilter").value;
  const types = [...new Set(state.defects.map(d => d.defectType).filter(Boolean))].sort();
  $("analyticsTypeFilter").innerHTML = '<option value="">전체 하자</option>' + types.map(type => `<option ${type === selected ? "selected" : ""}>${escapeHtml(type)}</option>`).join("");
  const defects = selected ? state.defects.filter(d => d.defectType === selected) : state.defects;
  const environmentCount = defects.filter(d => Number.isFinite(d.temperature) || d.weather).length;
  const typeCounts = countBy(defects, d => d.defectType || "기타");
  const top = Object.entries(typeCounts).sort((a,b) => b[1]-a[1])[0];
  $("analysisTotal").textContent = defects.length;
  $("analysisCoverage").textContent = defects.length ? `${Math.round(environmentCount / defects.length * 100)}%` : "0%";
  $("analysisTopType").textContent = top?.[0] || "-";
  $("analysisTopTypeCount").textContent = top ? `${top[1]}건` : "표본 없음";
  renderAnalysisBars("typeFrequencyChart", typeCounts, "등록된 하자가 없습니다.");
  renderAnalysisBars("seasonChart", countBy(defects, d => d.season || getSeason(d.createdAt)), "계절 데이터가 없습니다.");
  renderAnalysisBars("weatherChart", countBy(defects, d => d.weather), "날씨 정보가 없습니다.");
  const temperatureGroups = countBy(defects.filter(d => Number.isFinite(d.temperature)), d => d.temperature < 0 ? "영하" : d.temperature < 10 ? "0~9°C" : d.temperature < 20 ? "10~19°C" : d.temperature < 30 ? "20~29°C" : "30°C 이상");
  renderAnalysisBars("temperatureChart", temperatureGroups, "기온 정보가 없습니다.");

  const insights = [];
  const byType = Object.groupBy ? Object.groupBy(defects, d => d.defectType || "기타") : defects.reduce((acc,d) => ((acc[d.defectType || "기타"] ||= []).push(d),acc),{});
  Object.entries(byType).forEach(([type, rows]) => {
    if (rows.length < 3) return;
    const seasons = countBy(rows, d => d.season || getSeason(d.createdAt));
    const [season, seasonCount] = Object.entries(seasons).sort((a,b) => b[1]-a[1])[0] || [];
    if (season && seasonCount / rows.length >= .5) insights.push(`<div class="insight-item"><b>${escapeHtml(type)}</b> ${rows.length}건 중 ${seasonCount}건(${Math.round(seasonCount/rows.length*100)}%)이 ${season}에 등록됐습니다.</div>`);
    const weathers = countBy(rows, d => d.weather);
    const [weather, weatherCount] = Object.entries(weathers).sort((a,b) => b[1]-a[1])[0] || [];
    if (weather && weatherCount >= 2) insights.push(`<div class="insight-item"><b>${escapeHtml(type)}</b>은(는) ‘${escapeHtml(weather)}’ 조건에서 ${weatherCount}건 등록됐습니다.</div>`);
    const temperatures = rows.map(d => d.temperature).filter(Number.isFinite);
    if (temperatures.length >= 3) insights.push(`<div class="insight-item"><b>${escapeHtml(type)}</b> 등록 당시 평균기온은 ${(temperatures.reduce((a,b)=>a+b,0)/temperatures.length).toFixed(1)}°C입니다.</div>`);
  });
  $("associationInsights").innerHTML = insights.length ? insights.join("") : '<p class="empty-inline">같은 하자유형 데이터가 3건 이상 쌓이면 계절·날씨·기온의 반복 패턴을 보여줍니다.</p>';

  $("seasonMatrix").innerHTML = types.length ? types.map(type => {
    const rows = state.defects.filter(d => d.defectType === type);
    const seasons = countBy(rows, d => d.season || getSeason(d.createdAt));
    return `<tr><td>${escapeHtml(type)}</td>${["봄","여름","가을","겨울"].map(season => `<td>${seasons[season] || 0}</td>`).join("")}</tr>`;
  }).join("") : '<tr><td colspan="5">분석할 데이터가 없습니다.</td></tr>';
}

function renderSettings() {
  $("siteName").value = state.settings.siteName;
  $("siteCode").value = state.settings.siteCode;
  $("vendorList").innerHTML = state.vendors.map(v => `<option value="${escapeHtml(v)}"></option>`).join("");
  $("vendorChips").innerHTML = state.vendors.map((v,index) => `<span class="chip">${escapeHtml(v)}<button type="button" data-remove-vendor="${index}" aria-label="${escapeHtml(v)} 삭제">×</button></span>`).join("");
}

function bindEvents() {
  document.querySelectorAll(".bottom-nav button").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
  document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => { if (button.dataset.status) $("statusFilter").value = button.dataset.status; showView(button.dataset.go); }));
  document.querySelectorAll(".summary-card").forEach(button => button.addEventListener("click", () => { $("statusFilter").value = button.dataset.filter; showView("listView"); }));
  $("refreshButton").addEventListener("click", () => { renderDashboard(); toast("현황을 새로 계산했습니다."); });
  $("voiceButton").addEventListener("click", () => { if (!recognition) return; recognition.start(); });
  $("parseVoiceButton").addEventListener("click", applyVoiceText);
  $("photoInput").addEventListener("change", event => addPhotos(event.target.files));
  $("photoPreview").addEventListener("click", event => { const index = event.target.dataset.removePhoto; if (index === undefined) return; draftPhotos.splice(Number(index),1); renderPhotoPreview(); });
  $("drawingBoard").addEventListener("click", setPin);
  $("drawingInput").addEventListener("change", async event => {
    const file = event.target.files[0]; if (!file) return;
    if (!file.type.startsWith("image/")) return toast("현재 버전은 이미지 도면을 지원합니다.");
    state.settings.drawing = await compressImage(file, 2400, .86); await saveState();
    $("drawingImage").src = state.settings.drawing; $("drawingImage").hidden = false; document.querySelector(".drawing-placeholder").hidden = true;
    toast("도면을 기기에 저장했습니다.");
  });
  $("defectForm").addEventListener("submit", submitDefect);
  $("clearFormButton").addEventListener("click", clearForm);
  ["searchInput","statusFilter","tradeFilter"].forEach(id => $(id).addEventListener(id === "searchInput" ? "input" : "change", renderList));
  $("analyticsTypeFilter").addEventListener("change", renderAnalytics);
  $("defectList").addEventListener("click", event => { const action = event.target.dataset.action; if (action) updateDefectAction(event.target.closest("article").dataset.id, action); });
  $("selectAll").addEventListener("change", event => document.querySelectorAll(".row-check").forEach(box => box.checked = event.target.checked));
  $("exportSelectedButton").addEventListener("click", () => exportExcel(state.defects.filter(d => document.querySelector(`.row-check[data-id="${d.id}"]`)?.checked), "선택_하자사진대지"));
  $("exportAllButton").addEventListener("click", () => exportExcel(state.defects));
  $("siteName").addEventListener("change", async event => { state.settings.siteName = event.target.value.trim(); await saveState(); });
  $("siteCode").addEventListener("change", async event => { state.settings.siteCode = event.target.value.trim(); await saveState(); });
  $("addVendorButton").addEventListener("click", async () => { const name = $("newVendor").value.trim(); if (!name || state.vendors.includes(name)) return; state.vendors.push(name); $("newVendor").value=""; await saveState(); renderSettings(); });
  $("vendorChips").addEventListener("click", async event => { if (event.target.dataset.removeVendor === undefined) return; state.vendors.splice(Number(event.target.dataset.removeVendor),1); await saveState(); renderSettings(); });
  $("downloadBackupButton").addEventListener("click", () => downloadBlob(new Blob([JSON.stringify(state)], {type:"application/json"}), `하자ON_백업_${new Date().toISOString().slice(0,10)}.json`));
  $("restoreInput").addEventListener("change", async event => { try { const data = JSON.parse(await event.target.files[0].text()); if (!Array.isArray(data.defects)) throw new Error(); state = {...structuredClone(initialState),...data}; await saveState(); renderDashboard(); renderSettings(); toast("백업을 복원했습니다."); } catch { toast("올바른 백업 파일이 아닙니다."); } });
  $("clearDataButton").addEventListener("click", async () => { if (!confirm("이 기기에 저장된 하자와 사진을 모두 삭제할까요?")) return; state.defects=[]; await saveState(); renderDashboard(); toast("하자 데이터를 삭제했습니다."); });
  window.addEventListener("online", updateNetwork); window.addEventListener("offline", updateNetwork);
}

async function init() {
  try { await loadState(); } catch (error) { console.error(error); toast("로컬 저장소를 열 수 없습니다."); }
  bindEvents(); setupVoice(); updateNetwork(); $("season").value = getSeason(new Date()); renderDashboard(); renderSettings();
  if (state.settings.drawing) { $("drawingImage").src = state.settings.drawing; $("drawingImage").hidden = false; document.querySelector(".drawing-placeholder").hidden = true; }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.error);
}

init();
