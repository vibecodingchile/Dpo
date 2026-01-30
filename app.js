/* DPO Check-Wizard (Chile) — VibecodingChile (MVP estático)
   - Router hash (#/ , #/wizard , #/result/:id , #/history , #/about)
   - Guardado: localStorage
   - Reglas externas: rules/decision.rules.json
   - Demo: data/evaluation.sample.json
   - Reporte PDF: impresión del navegador (Guardar como PDF)
*/

const $app = document.getElementById("app");

const STEPS = [
  { key: "A", name: "Identificación" },
  { key: "B", name: "Riesgo" },
  { key: "C", name: "Independencia" },
  { key: "D", name: "Competencias" },
  { key: "E", name: "Funciones" },
  { key: "F", name: "Recursos" },
  { key: "G", name: "Confidencialidad" },
  { key: "H", name: "Revisión" },
];

const CONFLICT_ROLES = [
  { id: "ceo", label: "CEO / Gerente General" },
  { id: "cto", label: "CTO / Jefe TI" },
  { id: "product", label: "Head of Product" },
  { id: "hr", label: "RRHH" },
  { id: "growth", label: "Marketing / Growth" },
  { id: "sales", label: "Comercial / Ventas" },
  { id: "security", label: "Líder de Seguridad" },
];

const FUNCTIONS = [
  { id: "advise", label: "Asesorar cumplimiento" },
  { id: "policies", label: "Supervisar políticas" },
  { id: "dsr", label: "Gestionar derechos titulares" },
  { id: "incidents", label: "Gestionar incidentes/brechas" },
  { id: "authority", label: "Contacto con autoridad" },
  { id: "privacyByDesign", label: "Privacy by Design en producto" },
];

const RESOURCES = [
  { id: "time", label: "Tiempo asignado" },
  { id: "budget", label: "Presupuesto" },
  { id: "access", label: "Acceso a información/procesos" },
  { id: "tools", label: "Herramientas" },
];

const STORAGE_KEY = "vc_dpo_wizard_evaluations_v2";
const RULES_URL = "./rules/decision.rules.json";
const DEMO_EVAL_URL = "./data/evaluation.sample.json";

let RULES = {
  rules: {
    functions_minimum: { required_percentage: 0.8 },
    resources_minimum: { required_count: 3 },
    confidentiality_required: { nda_signed: true, confidentiality_clause: true },
    independence_gate: {}
  }
};

async function loadRules() {
  try {
    const res = await fetch(RULES_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudieron cargar reglas");
    RULES = await res.json();
  } catch (e) {
    // fallback: keep defaults
    console.warn("Rules fallback:", e);
  }
}

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function getById(id) {
  return loadAll().find(x => x.id === id);
}

function uid() {
  return "EV-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setActiveNav() {
  const hash = location.hash || "#/";
  document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
  const map = {
    "#/": "navHome",
    "#/wizard": "navWizard",
    "#/history": "navHistory",
    "#/about": "navAbout",
  };
  const key = Object.keys(map).find(k => hash.startsWith(k));
  const id = map[key || "#/"];
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

async function router() {
  setActiveNav();
  const hash = location.hash || "#/";
  const [path, param] = hash.replace("#", "").split("/").filter(Boolean);

  if (!path) return renderHome();
  if (path === "wizard") return renderWizard();
  if (path === "result") return renderResult(param);
  if (path === "history") return renderHistory();
  if (path === "about") return renderAbout();

  renderNotFound();
}

window.addEventListener("hashchange", router);
window.addEventListener("load", async () => {
  await loadRules();
  router();
});

/* ---------------- Wizard State ---------------- */
const wizardState = {
  stepIndex: 0,
  data: {
    orgName: "",
    evaluatorEmail: "",
    date: todayISO(),
    modality: "Interno",

    risk_largeScale: "No",
    risk_sensitive: "No",
    risk_highVolume: "No",
    risk_aiProfiling: "No",
    risk_internationalTransfers: "No",

    conflicts: {},
    independence_autonomy: "Sí",
    independence_reportsTop: "Sí",

    competence_law: "Medio",
    competence_experience: "1-3",
    competence_gdpr: "Parcial",
    competence_training: "Sí",

    functions: {},
    resources: {},

    conf_nda: "Sí",
    conf_clause: "Sí",
  }
};

function resetWizard() {
  wizardState.stepIndex = 0;
  wizardState.data = {
    orgName: "",
    evaluatorEmail: "",
    date: todayISO(),
    modality: "Interno",

    risk_largeScale: "No",
    risk_sensitive: "No",
    risk_highVolume: "No",
    risk_aiProfiling: "No",
    risk_internationalTransfers: "No",

    conflicts: {},
    independence_autonomy: "Sí",
    independence_reportsTop: "Sí",

    competence_law: "Medio",
    competence_experience: "1-3",
    competence_gdpr: "Parcial",
    competence_training: "Sí",

    functions: {},
    resources: {},

    conf_nda: "Sí",
    conf_clause: "Sí",
  };
}

function htmlesc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}

function renderStepper() {
  const steps = STEPS.map((s, i) => {
    const cls = i === wizardState.stepIndex ? "step active" : "step";
    return `<div class="${cls}">${s.key} · ${s.name}</div>`;
  }).join("");
  return `<div class="stepper">${steps}</div>`;
}

function checkboxList(items, stateObj, prefix) {
  return `
    <div class="chips">
      ${items.map(it => {
        const checked = stateObj[it.id] ? "checked" : "";
        return `
          <label class="chip">
            <input type="checkbox" data-prefix="${prefix}" data-id="${it.id}" ${checked}/>
            <span>${htmlesc(it.label)}</span>
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function yesNoSelect(name, value) {
  return `
    <select data-bind="${name}">
      <option ${value==="Sí" ? "selected" : ""}>Sí</option>
      <option ${value==="No" ? "selected" : ""}>No</option>
    </select>
  `;
}
function selectBind(name, value, options) {
  return `
    <select data-bind="${name}">
      ${options.map(o => `<option ${o===value?"selected":""}>${htmlesc(o)}</option>`).join("")}
    </select>
  `;
}

function bindEvents(container) {
  container.querySelectorAll("[data-bind]").forEach(el => {
    el.addEventListener("input", () => {
      const k = el.getAttribute("data-bind");
      wizardState.data[k] = el.value;
    });
    el.addEventListener("change", () => {
      const k = el.getAttribute("data-bind");
      wizardState.data[k] = el.value;
    });
  });

  container.querySelectorAll("input[type=checkbox][data-prefix]").forEach(el => {
    el.addEventListener("change", () => {
      const prefix = el.getAttribute("data-prefix");
      const id = el.getAttribute("data-id");
      const target = wizardState.data[prefix];
      target[id] = el.checked ? true : false;
    });
  });

  const prev = container.querySelector("#btnPrev");
  const next = container.querySelector("#btnNext");
  const submit = container.querySelector("#btnSubmit");
  const reset = container.querySelector("#btnReset");
  const loadDemo = container.querySelector("#btnLoadDemo");
  const exportJson = container.querySelector("#btnExportJson");
  const importJson = container.querySelector("#btnImportJson");
  const fileInput = container.querySelector("#fileJson");

  if (prev) prev.addEventListener("click", () => { wizardState.stepIndex = Math.max(0, wizardState.stepIndex - 1); renderWizard(); });
  if (next) next.addEventListener("click", () => { wizardState.stepIndex = Math.min(STEPS.length - 1, wizardState.stepIndex + 1); renderWizard(); });
  if (reset) reset.addEventListener("click", () => { resetWizard(); renderWizard(); });

  if (submit) submit.addEventListener("click", () => {
    const validation = validateWizard(wizardState.data);
    if (!validation.ok) {
      alert("Faltan datos:\n- " + validation.errors.join("\n- "));
      return;
    }
    const computed = computeResult(wizardState.data);
    const record = { id: uid(), created_at: new Date().toISOString(), ...wizardState.data, computed };
    const all = loadAll();
    all.unshift(record);
    saveAll(all);
    location.hash = `#/result/${record.id}`;
  });

  // Demo loader
  if (loadDemo) loadDemo.addEventListener("click", async () => {
    try {
      const res = await fetch(DEMO_EVAL_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo cargar demo");
      const demo = await res.json();
      applyEvaluationJsonToWizard(demo);
      location.hash = "#/wizard";
    } catch (e) {
      alert("No pude cargar el demo JSON. Revisa que exista /data/evaluation.sample.json");
    }
  });

  // Export current wizard state to JSON
  if (exportJson) exportJson.addEventListener("click", () => {
    const json = wizardToCanonicalJson(wizardState.data);
    downloadJson(json, `evaluation-${todayISO()}.json`);
  });

  // Import JSON file
  if (importJson && fileInput) {
    importJson.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      const text = await f.text();
      try {
        const obj = JSON.parse(text);
        applyEvaluationJsonToWizard(obj);
        location.hash = "#/wizard";
      } catch {
        alert("JSON inválido.");
      } finally {
        fileInput.value = "";
      }
    });
  }
}

function validateWizard(d) {
  const errors = [];
  if (!d.orgName.trim()) errors.push("Nombre de la organización");
  if (!d.evaluatorEmail.trim()) errors.push("Email del evaluador");
  if (!/^\S+@\S+\.\S+$/.test(d.evaluatorEmail.trim())) errors.push("Email del evaluador (formato inválido)");
  return { ok: errors.length === 0, errors };
}

/* ---------------- JSON ↔ Wizard mapping ---------------- */
function wizardToCanonicalJson(d) {
  // Convert wizard internal model -> canonical JSON (similar to sample)
  return {
    evaluation_id: "EV-TEMP",
    created_at: new Date().toISOString(),
    organization: { name: d.orgName, sector: "N/A" },
    evaluator: { email: d.evaluatorEmail },
    dpo: { modality: d.modality },
    risk_assessment: {
      large_scale_processing: d.risk_largeScale === "Sí",
      sensitive_data: d.risk_sensitive === "Sí",
      high_volume_subjects: d.risk_highVolume === "Sí",
      ai_profiling: d.risk_aiProfiling === "Sí",
      international_transfers: d.risk_internationalTransfers === "Sí"
    },
    independence: {
      conflict_roles: {
        ceo: !!d.conflicts.ceo,
        cto: !!d.conflicts.cto,
        head_of_product: !!d.conflicts.product,
        hr: !!d.conflicts.hr,
        marketing_growth: !!d.conflicts.growth,
        sales: !!d.conflicts.sales,
        security_lead: !!d.conflicts.security
      },
      autonomy: d.independence_autonomy === "Sí",
      reports_to_top_management: d.independence_reportsTop === "Sí"
    },
    competencies: {
      law_21719: (d.competence_law || "Medio").toUpperCase(),
      experience_years: d.competence_experience === "+3" ? "3_PLUS" : d.competence_experience === "1-3" ? "1_3" : "LT_1",
      gdpr_standards: d.competence_gdpr === "Sí" ? "SI" : d.competence_gdpr === "Parcial" ? "PARCIAL" : "NO",
      privacy_security_training: d.competence_training === "Sí"
    },
    functions: {
      advise_compliance: !!d.functions.advise,
      oversee_policies: !!d.functions.policies,
      manage_data_subject_requests: !!d.functions.dsr,
      incident_breach_management: !!d.functions.incidents,
      contact_authority: !!d.functions.authority,
      privacy_by_design: !!d.functions.privacyByDesign
    },
    resources: {
      time_allocated: !!d.resources.time,
      budget: !!d.resources.budget,
      access_to_information: !!d.resources.access,
      tools: !!d.resources.tools
    },
    confidentiality: {
      nda_signed: d.conf_nda === "Sí",
      confidentiality_clause: d.conf_clause === "Sí"
    }
  };
}

function applyEvaluationJsonToWizard(obj) {
  // Convert canonical JSON -> wizard internal model
  // Defensive parsing:
  const orgName = obj?.organization?.name || "";
  const email = obj?.evaluator?.email || "";
  const modality = obj?.dpo?.modality || "Interno";
  const risk = obj?.risk_assessment || {};
  const indep = obj?.independence || {};
  const comp = obj?.competencies || {};
  const funcs = obj?.functions || {};
  const res = obj?.resources || {};
  const conf = obj?.confidentiality || {};

  wizardState.data.orgName = orgName;
  wizardState.data.evaluatorEmail = email;
  wizardState.data.date = todayISO();
  wizardState.data.modality = (modality === "Externo" || modality === "Interno") ? modality : "Interno";

  wizardState.data.risk_largeScale = risk.large_scale_processing ? "Sí" : "No";
  wizardState.data.risk_sensitive = risk.sensitive_data ? "Sí" : "No";
  wizardState.data.risk_highVolume = risk.high_volume_subjects ? "Sí" : "No";
  wizardState.data.risk_aiProfiling = risk.ai_profiling ? "Sí" : "No";
  wizardState.data.risk_internationalTransfers = risk.international_transfers ? "Sí" : "No";

  // conflicts mapping
  wizardState.data.conflicts = {};
  const cr = indep.conflict_roles || {};
  wizardState.data.conflicts.ceo = !!cr.ceo;
  wizardState.data.conflicts.cto = !!cr.cto;
  wizardState.data.conflicts.product = !!cr.head_of_product;
  wizardState.data.conflicts.hr = !!cr.hr;
  wizardState.data.conflicts.growth = !!cr.marketing_growth;
  wizardState.data.conflicts.sales = !!cr.sales;
  wizardState.data.conflicts.security = !!cr.security_lead;

  wizardState.data.independence_autonomy = indep.autonomy === false ? "No" : "Sí";
  wizardState.data.independence_reportsTop = indep.reports_to_top_management === false ? "No" : "Sí";

  // competencies (accept Spanish/English variants)
  const law = (comp.law_21719 || "MEDIO").toString().toUpperCase();
  wizardState.data.competence_law = law === "ALTO" ? "Alto" : law === "BAJO" ? "Bajo" : "Medio";

  const exp = (comp.experience_years || "1_3").toString().toUpperCase();
  wizardState.data.competence_experience = exp.includes("3") && exp.includes("PLUS") ? "+3" : exp.includes("LT") ? "<1" : "1-3";

  const gdpr = (comp.gdpr_standards || "PARCIAL").toString().toUpperCase();
  wizardState.data.competence_gdpr = gdpr === "SI" ? "Sí" : gdpr === "NO" ? "No" : "Parcial";

  wizardState.data.competence_training = comp.privacy_security_training ? "Sí" : "No";

  // functions
  wizardState.data.functions = {};
  wizardState.data.functions.advise = !!funcs.advise_compliance;
  wizardState.data.functions.policies = !!funcs.oversee_policies;
  wizardState.data.functions.dsr = !!funcs.manage_data_subject_requests;
  wizardState.data.functions.incidents = !!funcs.incident_breach_management;
  wizardState.data.functions.authority = !!funcs.contact_authority;
  wizardState.data.functions.privacyByDesign = !!funcs.privacy_by_design;

  // resources
  wizardState.data.resources = {};
  wizardState.data.resources.time = !!res.time_allocated;
  wizardState.data.resources.budget = !!res.budget;
  wizardState.data.resources.access = !!res.access_to_information;
  wizardState.data.resources.tools = !!res.tools;

  // confidentiality
  wizardState.data.conf_nda = conf.nda_signed ? "Sí" : "No";
  wizardState.data.conf_clause = conf.confidentiality_clause ? "Sí" : "No";

  wizardState.stepIndex = 0;
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- Logic (Rules-driven) ---------------- */
function computeResult(d) {
  const R = RULES?.rules || {};

  const fnMin = R.functions_minimum?.required_percentage ?? 0.8;
  const resMin = R.resources_minimum?.required_count ?? 3;
  const confNeedNda = R.confidentiality_required?.nda_signed ?? true;
  const confNeedClause = R.confidentiality_required?.confidentiality_clause ?? true;

  // Independence gate (fixed gate, but still described by rules json)
  const hasConflict = Object.values(d.conflicts || {}).some(Boolean);
  const autonomyNo = d.independence_autonomy === "No";
  const reportsNo = d.independence_reportsTop === "No";
  const independenceGateFail = hasConflict || autonomyNo || reportsNo;

  const riskFlag = [
    d.risk_largeScale, d.risk_sensitive, d.risk_highVolume, d.risk_aiProfiling, d.risk_internationalTransfers
  ].some(v => v === "Sí");

  // competence points
  const lawPts = d.competence_law === "Alto" ? 2 : d.competence_law === "Medio" ? 1 : 0;
  const expPts = d.competence_experience === "+3" ? 2 : d.competence_experience === "1-3" ? 1 : 0;
  const gdprPts = d.competence_gdpr === "Sí" ? 2 : d.competence_gdpr === "Parcial" ? 1 : 0;
  const trainPts = d.competence_training === "Sí" ? 1 : 0;
  const competenceScore = lawPts + expPts + gdprPts + trainPts;

  const resourcesScore = Object.values(d.resources || {}).filter(Boolean).length;

  const confidentialityOk =
    (!confNeedNda || d.conf_nda === "Sí") &&
    (!confNeedClause || d.conf_clause === "Sí");

  const fnChecked = Object.values(d.functions || {}).filter(Boolean).length;
  const fnTotal = FUNCTIONS.length;
  const functionsPct = fnTotal ? (fnChecked / fnTotal) : 0;

  let result = "APTO";
  const triggers = [];

  if (independenceGateFail) {
    result = "NO APTO";
    if (hasConflict) triggers.push("Falla gate de independencia: conflicto de interés detectado.");
    if (autonomyNo) triggers.push("Falla gate de independencia: sin autonomía funcional.");
    if (reportsNo) triggers.push("Falla gate de independencia: no reporta a alta dirección.");
  } else {
    if (functionsPct < fnMin) triggers.push(`Cobertura de funciones insuficiente (${Math.round(functionsPct*100)}%). Recomendado ≥${Math.round(fnMin*100)}%.`);
    if (!confidentialityOk) triggers.push("Faltan condiciones de confidencialidad (NDA y/o cláusula).");
    if (resourcesScore < resMin) triggers.push(`Recursos asignados bajos (${resourcesScore}/4). Recomendado ≥${resMin}.`);
    if (competenceScore < 5) triggers.push(`Competencias mejorables (score ${competenceScore}/7).`);

    if (triggers.length > 0) result = "APTO CON OBSERVACIONES";
  }

  const recommendations = [];
  if (riskFlag) recommendations.push("Riesgo alto: formalizar DPO con mandato, métricas y revisiones periódicas.");
  if (!confidentialityOk) recommendations.push("Regularizar NDA y cláusulas de confidencialidad/ secreto profesional.");
  if (resourcesScore < resMin) recommendations.push("Asignar recursos mínimos (tiempo, acceso, herramientas y/o presupuesto).");
  if (functionsPct < fnMin) recommendations.push("Definir responsabilidades y flujos (derechos titulares, incidentes, privacy by design).");
  if (competenceScore < 5) recommendations.push("Plan de capacitación: Ley 21.719, gobierno de datos, vendors, incidentes.");

  return {
    result,
    triggers,
    recommendations,
    riskFlag,
    competenceScore,
    resourcesScore,
    functionsPct,
    fnChecked,
    fnTotal,
    appliedThresholds: { fnMin, resMin, confNeedNda, confNeedClause }
  };
}

function badgeFor(result) {
  if (result === "APTO") return `<span class="badge good">APTO</span>`;
  if (result === "APTO CON OBSERVACIONES") return `<span class="badge warn">APTO CON OBS</span>`;
  return `<span class="badge bad">NO APTO</span>`;
}

/* ---------------- Pages ---------------- */
function renderHome() {
  $app.innerHTML = `
    <section class="card">
      <h1 class="h1">MVP · DPO Check-Wizard (Chile)</h1>
      <p class="p">
        Demo funcional del wizard con reglas externas (JSON),
