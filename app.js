import { speak, listenTo } from "./modules/voice.js";
import { addProgress, updateDashboard, clearProgress, scoreLocal, loadProgress, levelFrom } from "./modules/progress.js";
import { switchScreen, formatReply, visualCorrection, addBubble, escapeHtml } from "./modules/ui.js";
import { askTeacher, extractCorrectSentence, extractNextQuestion, shortVoice } from "./modules/teacher.js";

let lastFeedback = "";
let lastSentence = "";
let continuous = false;
let session = { started: Date.now(), answers: 0, words: 0, errors: 0 };

const questions = [
  "What did you do today?",
  "What did you do yesterday?",
  "What are your plans for tomorrow?",
  "Tell me about your work routine.",
  "Describe your family.",
  "What is difficult for you in English?",
  "Tell me about your city.",
  "What did you eat today?"
];

const examQuestions = [
  "Describe a problem you solved recently.",
  "Talk about a person who inspires you.",
  "Describe your ideal vacation.",
  "Explain why English is important for you.",
  "Tell me about a difficult day at work."
];

const shadows = [
  "I want to improve my American pronunciation.",
  "Could you say that again, please?",
  "Yesterday I worked all day and then I went home.",
  "I feel more confident when I practice every day.",
  "I would like to speak more naturally."
];

const sounds = [
  { title: "TH sound: think / three / thank", tip: "Pon la punta de la lengua suavemente entre los dientes y sopla.", words: ["think", "three", "thank"] },
  { title: "V sound: very / voice / vacation", tip: "Toca el labio inferior con los dientes superiores y vibra.", words: ["very", "voice", "vacation"] },
  { title: "American R: car / work / teacher", tip: "Lleva la lengua hacia atrás sin tocar el paladar.", words: ["car", "work", "teacher"] },
  { title: "Past ED: worked / played / wanted", tip: "Worked suena T, played suena D, wanted suena ID.", words: ["worked", "played", "wanted"] }
];

const ipa = {
  think: "/θɪŋk/",
  three: "/θriː/",
  thank: "/θæŋk/",
  very: "/ˈveri/",
  voice: "/vɔɪs/",
  vacation: "/veɪˈkeɪʃən/",
  car: "/kɑr/",
  work: "/wɝk/",
  teacher: "/ˈtiːtʃɚ/",
  worked: "/wɝkt/",
  played: "/pleɪd/",
  wanted: "/ˈwɑntɪd/"
};

function byId(id) { return document.getElementById(id); }
function random(list) { return list[Math.floor(Math.random() * list.length)]; }
function getText(id) { return byId(id).textContent; }

function saveMistakes(reply) {
  const found = [];
  if (/has|have/i.test(reply)) found.push("have / has");
  if (/past|went|watched|worked/i.test(reply)) found.push("past simple");
  if (/continuous|watching|having/i.test(reply)) found.push("present/past continuous");
  if (/pronunciation|sound/i.test(reply)) found.push("pronunciation");

  const arr = JSON.parse(localStorage.getItem("ultimateMistakes") || "[]");
  localStorage.setItem("ultimateMistakes", JSON.stringify([...arr, ...found].slice(-30)));
  renderMistakes();
}

function renderMistakes() {
  const arr = JSON.parse(localStorage.getItem("ultimateMistakes") || "[]");
  byId("mistakeList").innerHTML = arr.length ? arr.map(x => "✓ " + escapeHtml(x)).join("<br>") : "Todavía no hay errores guardados.";
}

function clearMistakes() {
  localStorage.removeItem("ultimateMistakes");
  renderMistakes();
}

function setFeedback(target, reply, original = "") {
  lastFeedback = reply;
  lastSentence = extractCorrectSentence(reply);
  byId(target).innerHTML = formatReply(reply);
  if (target === "classFeedback") byId("visualCorrection").innerHTML = visualCorrection(original, lastSentence);
  saveMistakes(reply);
  session.answers++;
  session.words += original.split(/\s+/).filter(Boolean).length;
  session.errors += (reply.match(/error|mistake|incorrect|correction|mejor|debe/gi) || []).length;
}

async function correctClass() {
  const text = byId("classAnswer").value.trim();
  if (!text) return byId("classFeedback").textContent = "Primero responde.";
  byId("classFeedback").textContent = "Mario está corrigiendo...";
  try {
    const score = scoreLocal(text);
    const reply = await askTeacher(text, "Daily class correction");
    setFeedback("classFeedback", reply, text);
    addProgress(score, 35);
    speak(shortVoice(reply), "es-ES", 0.92, () => { if (continuous) nextQuestion(); });
  } catch (error) {
    byId("classFeedback").textContent = error.message;
  }
}

async function sendChat() {
  const input = byId("chatInput");
  const text = input.value.trim();
  if (!text) return;
  addBubble("user", "<b>You:</b> " + escapeHtml(text));
  input.value = "";
  addBubble("mario", "<b>Mario:</b> Thinking...");
  try {
    const score = scoreLocal(text);
    const reply = await askTeacher(text, "Continuous conversation");
    document.querySelector("#chat .bubble:last-child").innerHTML = "<b>Mario:</b> " + formatReply(reply);
    lastFeedback = reply;
    lastSentence = extractCorrectSentence(reply);
    saveMistakes(reply);
    addProgress(score, 25);
    speak(shortVoice(reply), "es-ES", 0.92, () => { if (continuous) nextQuestion(); });
  } catch (error) {
    document.querySelector("#chat .bubble:last-child").innerHTML = "<b>Mario:</b> " + escapeHtml(error.message);
  }
}

async function gradeExam() {
  const text = byId("examAnswer").value.trim();
  if (!text) return byId("examFeedback").textContent = "Primero responde.";
  byId("examFeedback").textContent = "Mario está evaluando...";
  try {
    const score = scoreLocal(text);
    const reply = await askTeacher(text, "B1/B2 speaking exam");
    byId("examFeedback").innerHTML = formatReply(reply);
    lastFeedback = reply;
    lastSentence = extractCorrectSentence(reply);
    addProgress(score, 50);
    speak(shortVoice(reply), "es-ES");
  } catch (error) {
    byId("examFeedback").textContent = error.message;
  }
}

function startContinuous() {
  continuous = true;
  switchScreen("conversation");
  const q = random(questions);
  addBubble("mario", "<b>Mario:</b> " + escapeHtml(q));
  speak(q, "en-US");
}

function stopContinuous() {
  continuous = false;
  alert("Conversación continua detenida.");
}

function nextQuestion() {
  const q = extractNextQuestion(lastFeedback) || random(questions);
  addBubble("mario", "<b>Mario:</b> " + escapeHtml(q));
  speak(q, "en-US");
}

function newClass() {
  byId("classQuestion").textContent = random(questions);
}

function newExam() {
  byId("examQuestion").textContent = random(examQuestions);
}

function newShadow() {
  byId("shadowPhrase").textContent = random(shadows);
}

function checkShadow() {
  const target = getText("shadowPhrase").toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const answer = byId("shadowAnswer").value.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  if (!answer) return byId("shadowFeedback").textContent = "Primero repite la frase.";
  const targetWords = target.split(/\s+/);
  const answerWords = answer.split(/\s+/);
  const hits = targetWords.filter(w => answerWords.includes(w)).length;
  const score = Math.round((hits / targetWords.length) * 100);
  byId("shadowFeedback").textContent = `Coincidencia: ${score}%\nFrase correcta: ${getText("shadowPhrase")}\nRepite copiando ritmo, pausa y entonación.`;
  addProgress(score, 15);
  speak(byId("shadowFeedback").textContent, "es-ES");
}

function renderWordLab(words) {
  byId("wordLab").innerHTML = words.map(w =>
    `<span class="word"><b>${w}</b><small>${ipa[w] || ""}</small><button data-word="${w}">🔊</button></span>`
  ).join("");
  document.querySelectorAll("[data-word]").forEach(btn => {
    btn.addEventListener("click", () => speak(btn.dataset.word, "en-US", 0.75));
  });
}

function newSound() {
  const s = random(sounds);
  byId("soundTitle").textContent = s.title;
  byId("soundTip").textContent = s.tip;
  renderWordLab(s.words);
}

function updatePlan() {
  const p = loadProgress();
  const avg = p.scores.length ? Math.round(p.scores.reduce((a,b)=>a+b,0) / p.scores.length) : 0;
  const mistakes = JSON.parse(localStorage.getItem("ultimateMistakes") || "[]").slice(-5).join(", ") || "past simple, connectors, pronunciation";
  const plan = `🎯 Plan personalizado Ultimate 2026

Nivel actual: ${levelFrom(avg)}
Promedio: ${avg}%
Errores recientes: ${mistakes}

Esta semana:
1. Practica 5 respuestas largas.
2. Repite cada frase correcta 3 veces.
3. Haz shadowing 5 minutos.
4. Usa conectores: then, after that, because.
5. Repasa tus errores recientes.`;
  byId("planBox").textContent = plan;
  return plan;
}

function showSummary() {
  const mins = Math.max(1, Math.round((Date.now() - session.started) / 60000));
  const msg = `🏆 Resumen Ultimate 2026

Tiempo: ${mins} minuto(s)
Respuestas: ${session.answers}
Palabras practicadas: ${session.words}
Errores detectados: ${session.errors}

Próxima meta: respuestas más largas, mejor uso del pasado y pronunciación más clara.`;
  byId("summaryBox").textContent = msg;
  return msg;
}

async function testApi() {
  byId("apiStatus").textContent = "Probando conexión...";
  try {
    const reply = await askTeacher("Hello Mario, this is a test.", "API test");
    byId("apiStatus").textContent = "✅ Conexión correcta:\n" + reply;
    speak("Conexión correcta. Mario Coach AI Ultimate 2026 está funcionando.", "es-ES");
  } catch (error) {
    byId("apiStatus").textContent = "❌ " + error.message;
  }
}

function installApp() {
  alert("Para instalar en Android: Chrome ⋮ → Agregar a pantalla principal.");
}

function bindEvents() {
  document.querySelectorAll(".tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      switchScreen(btn.dataset.screen);
      if (btn.dataset.screen === "plan") updatePlan();
      if (btn.dataset.screen === "summary") showSummary();
      if (btn.dataset.screen === "mistakes") renderMistakes();
    });
  });

  byId("btnIntro").onclick = () => speak("Hi Mario! Welcome to Mario Coach AI Ultimate 2026. I am your personal American English teacher.", "en-US");
  byId("btnInstall").onclick = installApp;
  byId("btnStartClass").onclick = () => { switchScreen("class"); newClass(); speak(getText("classQuestion"), "en-US"); };
  byId("btnContinuous").onclick = startContinuous;
  byId("btnListenQuestion").onclick = () => speak(getText("classQuestion"), "en-US");
  byId("btnSpeakClass").onclick = () => listenTo("classAnswer", scoreLocal);
  byId("btnCorrectClass").onclick = correctClass;
  byId("btnNewClass").onclick = newClass;
  byId("btnSpeakFeedback").onclick = () => lastFeedback ? speak(shortVoice(lastFeedback), "es-ES") : alert("Primero hacé una corrección.");
  byId("btnRepeat").onclick = () => lastSentence ? speak(lastSentence, "en-US", 0.78) : alert("No encontré frase correcta.");
  byId("btnNext").onclick = nextQuestion;
  byId("btnSpeakChat").onclick = () => listenTo("chatInput", scoreLocal);
  byId("btnSendChat").onclick = sendChat;
  byId("btnStopContinuous").onclick = stopContinuous;
  byId("btnNewExam").onclick = newExam;
  byId("btnListenExam").onclick = () => speak(getText("examQuestion"), "en-US");
  byId("btnSpeakExam").onclick = () => listenTo("examAnswer", scoreLocal);
  byId("btnGradeExam").onclick = gradeExam;
  byId("btnNewShadow").onclick = newShadow;
  byId("btnShadowSlow").onclick = () => speak(getText("shadowPhrase"), "en-US", 0.72);
  byId("btnShadowNormal").onclick = () => speak(getText("shadowPhrase"), "en-US", 1);
  byId("btnSpeakShadow").onclick = () => listenTo("shadowAnswer", scoreLocal);
  byId("btnCheckShadow").onclick = checkShadow;
  byId("btnNewSound").onclick = newSound;
  byId("btnSoundExample").onclick = () => speak(getText("soundTitle"), "en-US", 0.75);
  byId("btnSoundExplain").onclick = () => speak(getText("soundTip"), "es-ES");
  byId("btnClearMistakes").onclick = clearMistakes;
  byId("btnUpdatePlan").onclick = updatePlan;
  byId("btnSpeakPlan").onclick = () => speak(updatePlan(), "es-ES");
  byId("btnUpdateSummary").onclick = showSummary;
  byId("btnSpeakSummary").onclick = () => speak(showSummary(), "es-ES");
  byId("btnTestApi").onclick = testApi;
  byId("btnClearData").onclick = () => { clearProgress(); alert("Datos borrados."); };
}

bindEvents();
updateDashboard();
updatePlan();
newSound();
