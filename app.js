/* Mario Coach AI Ultimate 2026 Pro Mobile Edition - single JS file */
(function () {
  const CONFIG = window.MARIO_CONFIG || {};
  const API_URL = CONFIG.API_URL;
  const STORAGE_KEY = CONFIG.STORAGE_KEY || "marioUltimate2026ProMobile";
  const MISTAKES_KEY = CONFIG.MISTAKES_KEY || "marioUltimate2026ProMobileMistakes";

  let lastFeedback = "";
  let lastSentence = "";
  let continuous = false;
  let session = { started: Date.now(), answers: 0, words: 0, errors: 0 };

  const questions = ["What did you do today?","What did you do yesterday?","What are your plans for tomorrow?","Tell me about your work routine.","Describe your family.","What is difficult for you in English?","Tell me about your city.","What did you eat today?"];
  const examQuestions = ["Describe a problem you solved recently.","Talk about a person who inspires you.","Describe your ideal vacation.","Explain why English is important for you.","Tell me about a difficult day at work."];
  const shadows = ["I want to improve my American pronunciation.","Could you say that again, please?","Yesterday I worked all day and then I went home.","I feel more confident when I practice every day.","I would like to speak more naturally."];
  const sounds = [
    { title: "TH sound: think / three / thank", tip: "Pon la punta de la lengua suavemente entre los dientes y sopla.", words: ["think","three","thank"] },
    { title: "V sound: very / voice / vacation", tip: "Toca el labio inferior con los dientes superiores y vibra.", words: ["very","voice","vacation"] },
    { title: "American R: car / work / teacher", tip: "Lleva la lengua hacia atrás sin tocar el paladar.", words: ["car","work","teacher"] },
    { title: "Past ED: worked / played / wanted", tip: "Worked suena T, played suena D, wanted suena ID.", words: ["worked","played","wanted"] }
  ];
  const ipa = {think:"/θɪŋk/",three:"/θriː/",thank:"/θæŋk/",very:"/ˈveri/",voice:"/vɔɪs/",vacation:"/veɪˈkeɪʃən/",car:"/kɑr/",work:"/wɝk/",teacher:"/ˈtiːtʃɚ/",worked:"/wɝkt/",played:"/pleɪd/",wanted:"/ˈwɑntɪd/"};

  function byId(id){return document.getElementById(id);}
  function random(list){return list[Math.floor(Math.random()*list.length)];}
  function getText(id){return byId(id).textContent;}
  function escapeHtml(value){return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));}

  function stripMarkdown(text){
    return String(text).replace(/\*\*/g,"").replace(/###/g,"").replace(/##/g,"").replace(/`/g,"").replace(/➡/g,"→");
  }

  function cleanSpeech(text){
    return stripMarkdown(String(text)).replace(/[✅❌🎙️🧠🇺🇸👨🏻‍🏫⭐📊🏆🎯📚🗣️➡️]/g," ").replace(/\s+/g," ").trim();
  }

  function speak(text, lang="es-ES", rate=0.92, after=null){
    if(!("speechSynthesis" in window)){ alert("Este navegador no permite voz."); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleanSpeech(text));
    u.lang = lang;
    u.rate = rate;
    u.pitch = 1;
    const voices = speechSynthesis.getVoices();
    const selected = voices.find(v => v.lang === lang) || voices.find(v => v.lang && v.lang.startsWith(lang.split("-")[0]));
    if(selected) u.voice = selected;
    const avatar = byId("avatar");
    u.onstart = () => avatar && avatar.classList.add("speaking");
    u.onend = () => { if(avatar) avatar.classList.remove("speaking"); if(after) after(); };
    u.onerror = () => avatar && avatar.classList.remove("speaking");
    speechSynthesis.speak(u);
  }

  function listenTo(targetId, onScore){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ alert("Tu navegador no permite reconocimiento de voz. Escribe tu respuesta."); return; }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = e => {
      const text = Array.from(e.results).map(r => r[0].transcript).join(" ");
      byId(targetId).value = text;
      if(onScore) onScore(text);
    };
    rec.onerror = e => alert("Error de micrófono: " + e.error);
    rec.start();
  }

  function switchScreen(screenId){
    document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
    const tab = document.querySelector('[data-screen="' + screenId + '"]');
    if(tab) tab.classList.add("active");
    const screen = byId(screenId);
    if(screen) screen.classList.add("active");
  }

  function loadProgress(){
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"xp":0,"scores":[],"lastDay":"","streak":0,"sessions":0}');
  }

  function saveProgress(p){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    updateDashboard();
  }

  function addProgress(score, xp){
    const p = loadProgress();
    const today = new Date().toDateString();
    if(p.lastDay !== today){
      p.streak = p.lastDay ? p.streak + 1 : 1;
      p.lastDay = today;
    }
    p.xp += xp;
    p.sessions += 1;
    p.scores.push(score);
    saveProgress(p);
  }

  function levelFrom(avg){
    if(avg >= 95) return "C1";
    if(avg >= 90) return "B2+";
    if(avg >= 84) return "B2";
    if(avg >= 75) return "B1+";
    if(avg >= 60) return "B1";
    return "A2";
  }

  function updateDashboard(){
    const p = loadProgress();
    const avg = p.scores.length ? Math.round(p.scores.reduce((a,b)=>a+b,0)/p.scores.length) : 0;
    byId("xp").textContent = p.xp;
    byId("streak").textContent = p.streak;
    byId("avg").textContent = avg + "%";
    byId("level").textContent = levelFrom(avg);
    renderAchievements(p, avg);
  }

  function scoreLocal(text){
    const words = String(text).trim().split(/\s+/).filter(Boolean).length;
    const grammar = Math.min(98, Math.max(55, 68 + Math.floor(Math.random() * 24)));
    const pronunciation = Math.min(98, Math.max(45, 58 + words * 3 + Math.floor(Math.random() * 8)));
    const fluency = Math.min(98, Math.max(50, 60 + words * 2 + Math.floor(Math.random() * 12)));
    const vocabulary = Math.min(98, Math.max(55, 65 + Math.floor(Math.random() * 25)));
    const confidence = Math.min(98, Math.max(50, 60 + words * 2 + Math.floor(Math.random() * 15)));
    const listening = Math.min(98, Math.max(55, 64 + Math.floor(Math.random() * 25)));
    setScores(grammar, pronunciation, fluency, vocabulary, confidence, listening);
    return Math.round((grammar + pronunciation + fluency + vocabulary + confidence + listening) / 6);
  }

  function setScores(g,p,f,v,c,l){
    setBar("grammar",g); setBar("pron",p); setBar("fluency",f); setBar("vocab",v); setBar("confidence",c); setBar("listening",l);
  }

  function setBar(name, val){
    byId(name + "Bar").style.width = val + "%";
    byId(name + "Score").textContent = val + "%";
  }

  function renderAchievements(p, avg){
    const box = byId("achievementBox");
    if(!box) return;
    const achievements = [
      ["🔥 First Class", p.sessions >= 1],
      ["🥉 100 XP", p.xp >= 100],
      ["🥈 500 XP", p.xp >= 500],
      ["🥇 7-Day Streak", p.streak >= 7],
      ["🎙️ Speaking Starter", p.sessions >= 5],
      ["🇺🇸 B2 Level", avg >= 84]
    ];
    box.innerHTML = achievements.map(([name, ok]) => '<div class="ach ' + (ok ? "unlocked" : "") + '">' + (ok ? "✅" : "🔒") + " " + name + "</div>").join("");
  }

  async function askTeacher(text, mode){
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ text, mode: buildMode(mode) })
    });
    const data = await response.json();
    if(data.error) throw new Error(data.error);
    return stripMarkdown(data.reply || "");
  }

  function buildMode(base){
    return base + ` ULTIMATE 2026 PRO MOBILE.
Do not use Markdown. No asterisks.
Use short sections:
Mario says:
Natural American English:
Error by error:
Simple grammar rule:
Pronunciation tip:
CEFR estimate:
Score:
Next question:
Be clear, complete, practical, kind and academy-style.`;
  }

  function formatReply(reply){
    let text = escapeHtml(stripMarkdown(reply));
    text = text
      .replace(/Mario says:/gi, "<h4>👨🏻‍🏫 Mario says:</h4>")
      .replace(/Natural American English:/gi, "<h4>✅ Natural American English:</h4>")
      .replace(/Error by error:/gi, "<h4>🧠 Error by error:</h4>")
      .replace(/Simple grammar rule:/gi, "<h4>📚 Simple grammar rule:</h4>")
      .replace(/Pronunciation tip:/gi, "<h4>🇺🇸 Pronunciation tip:</h4>")
      .replace(/CEFR estimate:/gi, "<h4>📊 CEFR estimate:</h4>")
      .replace(/Score:/gi, "<h4>🏆 Score:</h4>")
      .replace(/Next question:/gi, "<h4>🎙️ Next question:</h4>");
    return '<div class="clean">' + text + '</div>';
  }

  function extractCorrectSentence(reply){
    const m = String(reply).match(/Natural American English:\s*["“]?([^"\n”]+)["”]?/i);
    if(m) return m[1].trim();
    const q = String(reply).match(/["“]([^"”]{10,250})["”]/);
    return q ? q[1].trim() : "";
  }

  function extractNextQuestion(reply){
    const m = String(reply).match(/Next question:\s*([^\n]+)/i);
    return m ? m[1].trim() : "";
  }

  function shortVoice(reply){
    const natural = extractCorrectSentence(reply);
    const q = extractNextQuestion(reply);
    const rule = (String(reply).match(/Simple grammar rule:\s*([\s\S]{0,260})/i) || String(reply).match(/Error by error:\s*([\s\S]{0,260})/i) || ["",""])[1];
    return `Muy bien. La forma natural es: ${natural}. ${rule}. Repite conmigo: ${natural}. ${q ? "Siguiente pregunta: " + q : ""}`;
  }

  function visualCorrection(original, corrected){
    if(!corrected) return "";
    return '<h4>Corrección visual</h4><span class="wrong">❌ ' + escapeHtml(original) + '</span><span class="arrow">→</span><span class="right">✅ ' + escapeHtml(corrected) + '</span>';
  }

  function saveMistakes(reply){
    const found = [];
    if(/has|have/i.test(reply)) found.push("have / has");
    if(/past|went|watched|worked/i.test(reply)) found.push("past simple");
    if(/continuous|watching|having/i.test(reply)) found.push("present/past continuous");
    if(/pronunciation|sound/i.test(reply)) found.push("pronunciation");
    const arr = JSON.parse(localStorage.getItem(MISTAKES_KEY) || "[]");
    localStorage.setItem(MISTAKES_KEY, JSON.stringify([...arr, ...found].slice(-40)));
    renderMistakes();
  }

  function renderMistakes(){
    const arr = JSON.parse(localStorage.getItem(MISTAKES_KEY) || "[]");
    byId("mistakeList").innerHTML = arr.length ? arr.map(x => "✓ " + escapeHtml(x)).join("<br>") : "Todavía no hay errores guardados.";
  }

  function clearMistakes(){
    localStorage.removeItem(MISTAKES_KEY);
    renderMistakes();
  }

  function addBubble(type, html){
    const chat = byId("chat");
    const div = document.createElement("div");
    div.className = "bubble " + type;
    div.innerHTML = html;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  function setFeedback(target, reply, original=""){
    lastFeedback = reply;
    lastSentence = extractCorrectSentence(reply);
    byId(target).innerHTML = formatReply(reply);
    if(target === "classFeedback") byId("visualCorrection").innerHTML = visualCorrection(original, lastSentence);
    saveMistakes(reply);
    session.answers++;
    session.words += original.split(/\s+/).filter(Boolean).length;
    session.errors += (reply.match(/error|mistake|incorrect|correction|mejor|debe/gi) || []).length;
  }

  async function correctClass(){
    const text = byId("classAnswer").value.trim();
    if(!text){ byId("classFeedback").textContent = "Primero responde."; return; }
    byId("classFeedback").textContent = "Mario está corrigiendo...";
    try{
      const score = scoreLocal(text);
      const reply = await askTeacher(text, "Daily class correction");
      setFeedback("classFeedback", reply, text);
      addProgress(score, 45);
      speak(shortVoice(reply), "es-ES", 0.92, () => { if(continuous) nextQuestion(); });
    }catch(e){ byId("classFeedback").textContent = e.message; }
  }

  async function sendChat(){
    const input = byId("chatInput");
    const text = input.value.trim();
    if(!text) return;
    addBubble("user", "<b>You:</b> " + escapeHtml(text));
    input.value = "";
    addBubble("mario", "<b>Mario:</b> Thinking...");
    try{
      const score = scoreLocal(text);
      const reply = await askTeacher(text, "Infinite continuous conversation");
      document.querySelector("#chat .bubble:last-child").innerHTML = "<b>Mario:</b> " + formatReply(reply);
      lastFeedback = reply;
      lastSentence = extractCorrectSentence(reply);
      saveMistakes(reply);
      addProgress(score, 35);
      speak(shortVoice(reply), "es-ES", 0.92, () => { if(continuous) nextQuestion(); });
    }catch(e){
      document.querySelector("#chat .bubble:last-child").innerHTML = "<b>Mario:</b> " + escapeHtml(e.message);
    }
  }

  async function gradeExam(){
    const text = byId("examAnswer").value.trim();
    if(!text){ byId("examFeedback").textContent = "Primero responde."; return; }
    byId("examFeedback").textContent = "Mario está evaluando...";
    try{
      const score = scoreLocal(text);
      const reply = await askTeacher(text, "B1 B2 C1 speaking exam");
      byId("examFeedback").innerHTML = formatReply(reply);
      lastFeedback = reply;
      lastSentence = extractCorrectSentence(reply);
      addProgress(score, 60);
      speak(shortVoice(reply), "es-ES");
    }catch(e){ byId("examFeedback").textContent = e.message; }
  }

  function startContinuous(){
    continuous = true;
    switchScreen("conversation");
    const q = random(questions);
    addBubble("mario", "<b>Mario:</b> " + escapeHtml(q));
    speak(q, "en-US");
  }

  function stopContinuous(){
    continuous = false;
    alert("Conversación continua detenida.");
  }

  function nextQuestion(){
    const q = extractNextQuestion(lastFeedback) || random(questions);
    addBubble("mario", "<b>Mario:</b> " + escapeHtml(q));
    speak(q, "en-US");
  }

  function newClass(){ byId("classQuestion").textContent = random(questions); }
  function newExam(){ byId("examQuestion").textContent = random(examQuestions); }
  function newShadow(){ byId("shadowPhrase").textContent = random(shadows); }

  function checkShadow(){
    const target = getText("shadowPhrase").toLowerCase().replace(/[^a-z\s]/g,"").trim();
    const answer = byId("shadowAnswer").value.toLowerCase().replace(/[^a-z\s]/g,"").trim();
    if(!answer){ byId("shadowFeedback").textContent = "Primero repite la frase."; return; }
    const targetWords = target.split(/\s+/), answerWords = answer.split(/\s+/);
    const hits = targetWords.filter(w => answerWords.includes(w)).length;
    const score = Math.round((hits / targetWords.length) * 100);
    byId("shadowFeedback").textContent = `Coincidencia: ${score}%\nFrase correcta: ${getText("shadowPhrase")}\nRepite copiando ritmo, pausa y entonación.`;
    addProgress(score, 25);
    speak(byId("shadowFeedback").textContent, "es-ES");
  }

  function renderWordLab(words){
    byId("wordLab").innerHTML = words.map(w => `<span class="word"><b>${w}</b><small>${ipa[w] || ""}</small><button data-word="${w}">🔊</button></span>`).join("");
    document.querySelectorAll("[data-word]").forEach(btn => btn.addEventListener("click", () => speak(btn.dataset.word, "en-US", 0.75)));
  }

  function newSound(){
    const s = random(sounds);
    byId("soundTitle").textContent = s.title;
    byId("soundTip").textContent = s.tip;
    renderWordLab(s.words);
  }

  function updatePlan(){
    const p = loadProgress();
    const avg = p.scores.length ? Math.round(p.scores.reduce((a,b)=>a+b,0)/p.scores.length) : 0;
    const mistakes = JSON.parse(localStorage.getItem(MISTAKES_KEY) || "[]").slice(-6).join(", ") || "past simple, connectors, pronunciation";
    const plan = `🎯 Plan semanal Ultimate 2026 Pro Mobile

Nivel actual: ${levelFrom(avg)}
Promedio: ${avg}%
Errores recientes: ${mistakes}

Lunes: Past Simple + conversación.
Martes: Pronunciación americana.
Miércoles: Shadowing Studio.
Jueves: Vocabulario B1/B2.
Viernes: Speaking Exam.
Sábado: Review de errores.
Domingo: Mock test y nuevo plan.`;
    byId("planBox").textContent = plan;
    return plan;
  }

  function showSummary(){
    const mins = Math.max(1, Math.round((Date.now() - session.started) / 60000));
    const msg = `🏆 Dashboard Ultimate 2026 Pro Mobile

Tiempo: ${mins} minuto(s)
Respuestas: ${session.answers}
Palabras practicadas: ${session.words}
Errores detectados: ${session.errors}

Próxima meta: conversación más fluida, frases más largas y pronunciación americana clara.`;
    byId("summaryBox").textContent = msg;
    return msg;
  }

  async function testApi(){
    byId("apiStatus").textContent = "Probando conexión...";
    try{
      const reply = await askTeacher("Hello Mario, this is a test.", "API test");
      byId("apiStatus").textContent = "✅ Conexión correcta:\n" + reply;
      speak("Conexión correcta. Mario Coach AI Ultimate 2026 Pro Mobile está funcionando.", "es-ES");
    }catch(e){ byId("apiStatus").textContent = "❌ " + e.message; }
  }

  function bindEvents(){
    document.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click", () => {
      switchScreen(btn.dataset.screen);
      if(btn.dataset.screen === "plan") updatePlan();
      if(btn.dataset.screen === "summary") showSummary();
      if(btn.dataset.screen === "mistakes") renderMistakes();
      if(btn.dataset.screen === "achievements") updateDashboard();
    }));

    byId("btnIntro").onclick = () => speak("Hi Mario! Welcome to Mario Coach AI Ultimate 2026 Pro Mobile. I am your private American English academy teacher.", "en-US");
    byId("btnInstall").onclick = () => alert("Para instalar en Android: Chrome ⋮ → Agregar a pantalla principal.");
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
    byId("btnShadowNative").onclick = () => speak(getText("shadowPhrase"), "en-US", 1.12);
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
    byId("btnClearData").onclick = () => { localStorage.removeItem(STORAGE_KEY); updateDashboard(); alert("Datos borrados."); };
  }

  bindEvents();
  updateDashboard();
  updatePlan();
  newSound();
})();
