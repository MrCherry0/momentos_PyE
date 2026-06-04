/* =========================================================
   Simulador de momentos muestrales — puesto de tortas
   =========================================================
   Secciones:
   4. Configuración del experimento
   5. Resumen de la población de referencia
   6. Resultados por muestra
   7. Gráficas de momentos muestrales
   8. Resumen del experimento
   9. Preguntas resueltas con datos reales del JSON
   ========================================================= */

let datosOriginales = [];   // array plano [{dia, ventas, semana, etiqueta}]
let jsonResumen = null;     // resumen precalculado del JSON

const $ = (id) => document.getElementById(id);

/* ─────────────────────────────────────────
   CARGA DEL JSON
───────────────────────────────────────── */
async function cargarPoblacion() {
  try {
    const res = await fetch("poblacion_tortas.json");
    const data = await res.json();

    jsonResumen = data.resumen;

    datosOriginales = data.poblacion_por_semanas.flat().map(d => ({
      dia: d.dia_semana,
      ventas: d.ventas,
      semana: d.semana,
      etiqueta: `S${d.semana}-D${d.dia_global}`
    }));

    mostrarResumenPoblacion(datosOriginales);
    construirRespuestas(datosOriginales, datosOriginales, null, "with_replacement");
    $("statusBox").textContent =
      `✓ Población cargada: ${datosOriginales.length} registros (52 semanas × 7 días). Configura el experimento y pulsa «Generar muestras».`;
  } catch (err) {
    $("statusBox").textContent =
      "⚠ Error cargando poblacion_tortas.json — asegúrate de que esté en la misma carpeta que este HTML.";
    console.error(err);
  }
}

/* ─────────────────────────────────────────
   UTILIDADES ESTADÍSTICAS
───────────────────────────────────────── */
const sum    = arr => arr.reduce((a, b) => a + b, 0);
const mean   = arr => sum(arr) / arr.length;
const momento = (arr, k) => mean(arr.map(v => Math.pow(v, k)));
const varianza = arr => { const m = mean(arr); return mean(arr.map(v => (v - m) ** 2)); };
const desviacion = arr => Math.sqrt(varianza(arr));
const rango = arr => ({ min: Math.min(...arr), max: Math.max(...arr) });

function randomInt(max) { return Math.floor(Math.random() * max); }

/* ─────────────────────────────────────────
   FILTRO DE SUBPOBLACIÓN
───────────────────────────────────────── */
function obtenerSubpoblacion() {
  const filtro = $("dayFilter").value;
  return filtro === "todos"
    ? [...datosOriginales]
    : datosOriginales.filter(d => d.dia === filtro);
}

/* ─────────────────────────────────────────
   5. RESUMEN DE LA POBLACIÓN DE REFERENCIA
───────────────────────────────────────── */
function mostrarResumenPoblacion(data) {
  const ventas = data.map(d => d.ventas);
  const m1  = momento(ventas, 1);
  const m2  = momento(ventas, 2);
  const m3  = momento(ventas, 3);
  const std = desviacion(ventas);
  const r   = rango(ventas);

  $("populationSummary").innerHTML = `
    <div class="summary-item">
      <span class="summary-item__label">Tamaño N</span>
      <span class="summary-item__value">${data.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-item__label">Mínimo / Máximo</span>
      <span class="summary-item__value">${r.min} / ${r.max}</span>
    </div>
    <div class="summary-item">
      <span class="summary-item__label">Desv. estándar (σ)</span>
      <span class="summary-item__value">${std.toFixed(3)}</span>
    </div>
    <div class="summary-item pop-m1">
      <span class="summary-item__label">μ₁ (media pob.)</span>
      <span class="summary-item__value">${m1.toFixed(4)}</span>
    </div>
    <div class="summary-item pop-m2">
      <span class="summary-item__label">μ₂ (2° momento pob.)</span>
      <span class="summary-item__value">${m2.toFixed(4)}</span>
    </div>
    <div class="summary-item pop-m3">
      <span class="summary-item__label">μ₃ (3° momento pob.)</span>
      <span class="summary-item__value">${m3.toFixed(4)}</span>
    </div>
  `;

  // Tabla de promedios por día si estamos en modo "todos"
  const filtro = $("dayFilter") ? $("dayFilter").value : "todos";
  if (filtro === "todos" && jsonResumen) {
    const dias = ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"];
    let filas = dias.map(dia => {
      const vd = datosOriginales.filter(d => d.dia === dia).map(d => d.ventas);
      const m1d = momento(vd, 1);
      const m2d = momento(vd, 2);
      return `<tr>
        <td>${dia.charAt(0).toUpperCase() + dia.slice(1)}</td>
        <td>${vd.length}</td>
        <td>${m1d.toFixed(2)}</td>
        <td>${m2d.toFixed(2)}</td>
        <td>${momento(vd, 3).toFixed(1)}</td>
        <td>${desviacion(vd).toFixed(2)}</td>
      </tr>`;
    }).join("");

    $("popTableWrap").innerHTML = `
      <h3 style="margin-bottom:8px;font-size:1rem">Momentos poblacionales por día de la semana</h3>
      <div class="table-wrap">
        <table style="min-width:600px">
          <thead>
            <tr><th>Día</th><th>N</th><th>μ₁</th><th>μ₂</th><th>μ₃</th><th>σ</th></tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`;
  } else {
    $("popTableWrap").innerHTML = "";
  }
}

/* ─────────────────────────────────────────
   4. GENERAR MUESTRAS (sección 4 → dispara 6, 7, 8)
───────────────────────────────────────── */
function generarMuestras() {
  const nMuestras = parseInt($("sampleCount").value);
  const modo = $("samplingMode").value;
  const subpoblacion = obtenerSubpoblacion();

  mostrarResumenPoblacion(subpoblacion);

  if (subpoblacion.length < 7) {
    $("statusBox").textContent = "⚠ Subpoblación demasiado pequeña (necesita al menos 7 registros).";
    return;
  }

  let disponibles = [...subpoblacion];
  const resultados = [];

  for (let i = 0; i < nMuestras; i++) {
    const muestra = [];
    for (let j = 0; j < 7; j++) {
      if (modo === "with_replacement") {
        muestra.push(subpoblacion[randomInt(subpoblacion.length)]);
      } else {
        if (disponibles.length === 0) disponibles = [...subpoblacion];
        const idx = randomInt(disponibles.length);
        muestra.push(disponibles.splice(idx, 1)[0]);
      }
    }
    const v = muestra.map(x => x.ventas);
    resultados.push({
      num: i + 1,
      dias: muestra.map(x => x.dia),
      semanas: muestra.map(x => x.semana),
      ventas: v,
      m1: momento(v, 1),
      m2: momento(v, 2),
      m3: momento(v, 3)
    });
  }

  mostrarTabla(resultados, subpoblacion);
  dibujarGraficas(resultados, subpoblacion);
  mostrarResumenExperimento(resultados, subpoblacion);
  construirRespuestas(datosOriginales, subpoblacion, resultados, modo);

  const modoLabel = modo === "with_replacement" ? "con reemplazo" : "sin reemplazo";
  const filtro = $("dayFilter").value;
  $("statusBox").textContent =
    `✓ ${nMuestras} muestras generadas (n=7, ${modoLabel}, subpob.: ${filtro}, N=${subpoblacion.length}).`;
}

/* ─────────────────────────────────────────
   6. TABLA DE RESULTADOS
───────────────────────────────────────── */
function mostrarTabla(resultados, subpoblacion) {
  const ventasPob = subpoblacion.map(d => d.ventas);
  const m1pop = momento(ventasPob, 1);

  const tbody = $("resultsTable").querySelector("tbody");
  tbody.innerHTML = "";

  resultados.forEach(r => {
    const diff = r.m1 - m1pop;
    const diffStr = (diff >= 0 ? "+" : "") + diff.toFixed(2);
    const diffColor = Math.abs(diff) < 3 ? "#16a34a" : Math.abs(diff) < 6 ? "#d97706" : "#dc2626";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align:center;font-weight:700">${r.num}</td>
      <td style="font-size:0.85rem">${r.dias.map(d => d.slice(0,3)).join(", ")}</td>
      <td style="font-size:0.85rem">${r.ventas.join(", ")}</td>
      <td><strong>${r.m1.toFixed(2)}</strong></td>
      <td>${r.m2.toFixed(2)}</td>
      <td>${r.m3.toFixed(1)}</td>
      <td style="color:${diffColor};font-weight:700">${diffStr}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ─────────────────────────────────────────
   7. GRÁFICAS
───────────────────────────────────────── */
function dibujarGrafica(canvasId, legendId, valores, poblacional, promMuestral, etiqueta, color) {
  const canvas = $(canvasId);
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const PAD = { l: 80, r: 24, t: 24, b: 44 };
  const gW = W - PAD.l - PAD.r;
  const gH = H - PAD.t - PAD.b;
  const n = valores.length;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const todos = [...valores, poblacional, promMuestral];
  const rawMin = Math.min(...todos), rawMax = Math.max(...todos);
  const mg = (rawMax - rawMin) * 0.14 || 5;
  const minV = rawMin - mg, maxV = rawMax + mg;

  const toX = i => PAD.l + (n <= 1 ? gW / 2 : (i / (n - 1)) * gW);
  const toY = v => PAD.t + gH - ((v - minV) / (maxV - minV)) * gH;

  // Cuadrícula y eje Y
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  for (let k = 0; k <= 5; k++) {
    const v = minV + (k / 5) * (maxV - minV);
    const y = toY(v);
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + gW, y); ctx.stroke();
    ctx.fillStyle = "#6b7280"; ctx.font = "11px Arial"; ctx.textAlign = "right";
    ctx.fillText(v.toFixed(etiqueta === "μ₃" ? 0 : 1), PAD.l - 6, y + 4);
  }

  // Eje X
  ctx.fillStyle = "#9ca3af"; ctx.font = "11px Arial"; ctx.textAlign = "center";
  const step = Math.max(1, Math.ceil(n / 20));
  for (let i = 0; i < n; i += step) {
    ctx.fillText(i + 1, toX(i), PAD.t + gH + 18);
  }
  ctx.fillStyle = "#6b7280";
  ctx.fillText("Número de muestra", PAD.l + gW / 2, PAD.t + gH + 36);

  // Línea de valores muestrales
  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round";
  valores.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); });
  ctx.stroke();

  // Puntos
  ctx.fillStyle = color;
  valores.forEach((v, i) => {
    ctx.beginPath(); ctx.arc(toX(i), toY(v), n <= 20 ? 5 : 3, 0, Math.PI * 2); ctx.fill();
  });

  // Línea poblacional (rojo)
  ctx.setLineDash([10, 5]); ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2.5;
  const yP = toY(poblacional);
  ctx.beginPath(); ctx.moveTo(PAD.l, yP); ctx.lineTo(PAD.l + gW, yP); ctx.stroke();
  ctx.fillStyle = "#dc2626"; ctx.font = "bold 11px Arial"; ctx.textAlign = "left";
  ctx.fillText(`μ=${poblacional.toFixed(2)}`, PAD.l + 4, yP - 5);

  // Línea promedio muestral (verde)
  ctx.setLineDash([6, 4]); ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 2;
  const yM = toY(promMuestral);
  ctx.beginPath(); ctx.moveTo(PAD.l, yM); ctx.lineTo(PAD.l + gW, yM); ctx.stroke();
  ctx.fillStyle = "#16a34a"; ctx.font = "bold 11px Arial"; ctx.textAlign = "right";
  ctx.fillText(`x̄=${promMuestral.toFixed(2)}`, PAD.l + gW - 4, yM - 5);

  ctx.setLineDash([]);

  // Leyenda
  const diff = ((promMuestral - poblacional) / poblacional * 100);
  $(legendId).innerHTML = `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${color}"></span>
      Momentos muestrales
    </span>
    <span class="legend-item">
      <span class="legend-swatch" style="background:#dc2626"></span>
      <strong>Momento poblacional (${etiqueta}): ${poblacional.toFixed(4)}</strong>
    </span>
    <span class="legend-item">
      <span class="legend-swatch" style="background:#16a34a"></span>
      Promedio muestral: ${promMuestral.toFixed(4)}
      <em style="margin-left:4px;color:${Math.abs(diff)<2?'#16a34a':'#d97706'}">(${diff>=0?"+":""}${diff.toFixed(2)}%)</em>
    </span>
  `;
}

function dibujarGraficas(resultados, subpoblacion) {
  const v = subpoblacion.map(d => d.ventas);
  const pops = [momento(v,1), momento(v,2), momento(v,3)];
  const vals = [resultados.map(r=>r.m1), resultados.map(r=>r.m2), resultados.map(r=>r.m3)];
  const ids = [["chartM1","legendM1"], ["chartM2","legendM2"], ["chartM3","legendM3"]];
  const labels = ["μ₁","μ₂","μ₃"];
  const colors = ["#1d4ed8","#7c3aed","#c2410c"];

  ids.forEach(([cid, lid], i) => {
    dibujarGrafica(cid, lid, vals[i], pops[i], mean(vals[i]), labels[i], colors[i]);
  });
}

/* ─────────────────────────────────────────
   8. RESUMEN DEL EXPERIMENTO
───────────────────────────────────────── */
function mostrarResumenExperimento(resultados, subpoblacion) {
  const vp = subpoblacion.map(d => d.ventas);
  const pops = [momento(vp,1), momento(vp,2), momento(vp,3)];
  const mvals = [resultados.map(r=>r.m1), resultados.map(r=>r.m2), resultados.map(r=>r.m3)];
  const labels = ["m₁'","m₂'","m₃'"];
  const colors = ["#1d4ed8","#7c3aed","#c2410c"];

  let html = `
    <div class="summary-item">
      <span class="summary-item__label">Muestras generadas</span>
      <span class="summary-item__value">${resultados.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-item__label">Tamaño de muestra n</span>
      <span class="summary-item__value">7</span>
    </div>
    <div class="summary-item">
      <span class="summary-item__label">Subpoblación N</span>
      <span class="summary-item__value">${subpoblacion.length}</span>
    </div>
  `;

  mvals.forEach((vals, i) => {
    const prom = mean(vals);
    const std  = desviacion(vals);
    const r    = rango(vals);
    const diff = ((prom - pops[i]) / pops[i] * 100);
    html += `
      <div class="summary-item" style="border-left:3px solid ${colors[i]}">
        <span class="summary-item__label">Promedio ${labels[i]} muestral</span>
        <span class="summary-item__value">${prom.toFixed(3)}</span>
        <span style="font-size:0.82rem;color:#6b7280">
          Pob: ${pops[i].toFixed(3)} &nbsp;|&nbsp;
          Error: <strong style="color:${Math.abs(diff)<2?'#16a34a':'#d97706'}">${diff>=0?"+":""}${diff.toFixed(2)}%</strong>
        </span>
        <span style="font-size:0.82rem;color:#6b7280">σ muestral: ${std.toFixed(3)} &nbsp;|&nbsp; rango: [${r.min.toFixed(1)}, ${r.max.toFixed(1)}]</span>
      </div>
    `;
  });

  $("experimentSummary").innerHTML = html;
}

/* ─────────────────────────────────────────
   9. RESPUESTAS A LAS PREGUNTAS
   (calculadas con los datos reales del JSON)
───────────────────────────────────────── */
// datos = población completa (siempre, para comparativas)
// subpob = subpoblación activa (puede ser un día o todos)
// resultados = array de muestras generadas en este experimento
// modo = "with_replacement" | "without_replacement"
function construirRespuestas(datos, subpob, resultados, modo) {
  // Si no hay experimento aún (carga inicial), usar toda la población con simulación interna
  const sinExperimento = !resultados || resultados.length === 0;
  subpob = subpob || datos;
  modo   = modo   || "with_replacement";

  const v    = subpob.map(d => d.ventas);   // ventas de la subpoblación activa
  const vAll = datos.map(d => d.ventas);    // ventas de toda la población
  const N    = v.length;
  const m1p  = momento(v, 1);
  const m2p  = momento(v, 2);
  const m3p  = momento(v, 3);
  const sigP = desviacion(v);

  // Subpoblaciones viernes y lunes para P5 (siempre de la población completa)
  const vVie = datos.filter(d => d.dia === "viernes").map(d => d.ventas);
  const vLun = datos.filter(d => d.dia === "lunes").map(d => d.ventas);
  const m1Vie = momento(vVie, 1), m2Vie = momento(vVie, 2), m3Vie = momento(vVie, 3);
  const m1Lun = momento(vLun, 1);

  // Función auxiliar para extraer estadísticos de un array de resultados muestrales
  function statsDeResultados(res) {
    const m1s = res.map(r => r.m1);
    const m2s = res.map(r => r.m2);
    const m3s = res.map(r => r.m3);
    return {
      m1s, m2s, m3s,
      pm1: mean(m1s), pm2: mean(m2s), pm3: mean(m3s),
      sm1: desviacion(m1s), sm2: desviacion(m2s), sm3: desviacion(m3s),
      rm1: rango(m1s), rm2: rango(m2s), rm3: rango(m3s)
    };
  }

  // Simulación interna (solo para comparativa con reemplazo / sin reemplazo en P6, y para carga inicial)
  function simMuestras(pool, nsim) {
    const res = [];
    for (let i = 0; i < nsim; i++) {
      const mst = Array.from({length: 7}, () => pool[randomInt(pool.length)]);
      res.push({ m1: momento(mst, 1), m2: momento(mst, 2), m3: momento(mst, 3) });
    }
    return statsDeResultados(res);
  }

  function simSinReemplazo(pool, nsim) {
    const res = [];
    let disp = [...pool];
    for (let i = 0; i < nsim; i++) {
      const mst = [];
      for (let j = 0; j < 7; j++) {
        if (disp.length === 0) disp = [...pool];
        const idx = randomInt(disp.length);
        mst.push(disp.splice(idx, 1)[0]);
      }
      res.push({ m1: momento(mst, 1), m2: momento(mst, 2), m3: momento(mst, 3) });
    }
    return statsDeResultados(res);
  }

  // Estadísticos del experimento actual (o simulación interna si no hay experimento)
  const simActual = sinExperimento
    ? simMuestras(v, 50)
    : statsDeResultados(resultados);

  // Para P6 siempre simulamos ambos tipos con la subpoblación activa
  const simCR = modo === "with_replacement" && !sinExperimento
    ? simActual
    : simMuestras(v, Math.max(resultados ? resultados.length : 50, 50));
  const simSR = simSinReemplazo(v, Math.max(resultados ? resultados.length : 50, 50));

  // Para P5: simulaciones de viernes y lunes
  const sim50V = simMuestras(vVie, 50);
  const sim50L = simMuestras(vLun, 50);

  const nExp     = sinExperimento ? 50 : resultados.length;
  const modoLabel = modo === "with_replacement" ? "con reemplazo" : "sin reemplazo";
  const subLabel  = $("dayFilter") ? $("dayFilter").value : "todos";

  const nLabel = sinExperimento ? "50 (simulación interna)" : nExp.toString();

  const preguntas = [
    {
      q: "1. ¿Los valores de m₁′ son todos iguales? ¿Por qué cambian de una muestra a otra?",
      a: `No, los valores de m₁' varían de muestra en muestra. En el experimento actual (${nLabel} muestras
        de n = 7 sobre la subpoblación "${subLabel}", N = ${N}), se obtuvo un rango de
        [${simActual.rm1.min.toFixed(2)}, ${simActual.rm1.max.toFixed(2)}] y una desviación estándar
        de σ(m₁') ≈ ${simActual.sm1.toFixed(3)}.

        Esto ocurre porque cada muestra de tamaño 7 capta solo una pequeña fracción de la
        subpoblación (7/${N} ≈ ${(7/N*100).toFixed(1)} %). Al extraer distintos días —con distintas ventas—,
        la media calculada fluctúa. Esta fluctuación es la <strong>variabilidad muestral</strong> (también llamada
        <em>error de muestreo</em>) y es completamente esperada: no indica un error metodológico,
        sino la naturaleza aleatoria del proceso de selección.`
    },
    {
      q: "2. Compara el promedio de los m₁′ con el primer momento poblacional. ¿Qué sugiere esto sobre la media muestral como estimador puntual?",
      a: `En el experimento actual (${nLabel} muestras, ${modoLabel}, subpob.: "${subLabel}") se obtuvo
        un promedio de m₁' ≈ <strong>${simActual.pm1.toFixed(4)}</strong>, mientras que el primer
        momento de la subpoblación es μ₁ = <strong>${m1p.toFixed(4)}</strong>
        (diferencia: ${((simActual.pm1-m1p)/m1p*100).toFixed(2)} %).

        El hecho de que el promedio de los momentos muestrales se acerque tanto al momento
        poblacional confirma que m₁' es un <strong>estimador insesgado</strong> de μ₁:
        E[m₁'] = μ₁. En otras palabras, aunque cada muestra individual da un valor distinto,
        el "centro" de esos valores apunta exactamente al parámetro que se quiere estimar.
        Esta propiedad es la razón por la que la media muestral es el estimador puntual
        más usado en estadística.`
    },
    {
      q: "3. Compara m₂′ con m₁′. ¿Cuál varía más entre muestras? ¿Por qué el segundo momento da más peso a los valores grandes?",
      a: `Con ${nLabel} muestras sobre la subpoblación "${subLabel}":
        <ul style="margin:8px 0">
          <li>σ(m₁') ≈ <strong>${simActual.sm1.toFixed(3)}</strong> &nbsp;|&nbsp; rango: [${simActual.rm1.min.toFixed(2)}, ${simActual.rm1.max.toFixed(2)}]</li>
          <li>σ(m₂') ≈ <strong>${simActual.sm2.toFixed(3)}</strong> &nbsp;|&nbsp; rango: [${simActual.rm2.min.toFixed(2)}, ${simActual.rm2.max.toFixed(2)}]</li>
        </ul>
        m₂' varía mucho más en términos absolutos. La razón es matemática: al elevar al cuadrado
        se amplifica la influencia de los valores extremos. Por eso, cuando por azar
        la muestra capta días de alta demanda, m₂' sube drásticamente.
        En términos relativos (CV = σ/media), la variabilidad relativa de m₂' supera a la de m₁'.`
    },
    {
      q: "4. Observa m₃′. ¿Los valores grandes influyen todavía más? ¿Por qué elevar al cubo amplifica los extremos?",
      a: `Sí. Con las mismas ${nLabel} muestras:
        <ul style="margin:8px 0">
          <li>σ(m₃') ≈ <strong>${simActual.sm3.toFixed(0)}</strong> &nbsp;|&nbsp; rango: [${simActual.rm3.min.toFixed(0)}, ${simActual.rm3.max.toFixed(0)}]</li>
          <li>El valor máximo de m₃' (${simActual.rm3.max.toFixed(0)}) es
          ${((simActual.rm3.max - simActual.rm3.min)/simActual.rm3.min*100).toFixed(1)} % mayor que el mínimo (${simActual.rm3.min.toFixed(0)}).</li>
        </ul>
        Al elevar al cubo, un valor de 60 contribuye con 60³ = <strong>216 000</strong>,
        mientras que un valor de 30 contribuye solo con 30³ = <strong>27 000</strong>
        (razón 8:1 versus la razón 4:1 del cuadrado y la razón 2:1 de la primera potencia).
        La función potencia cúbica crece superlinealmente y hace que los valores altos
        dominen la suma. Esto explica la enorme dispersión visible en la gráfica de m₃'.`
    },
    {
      q: "5. Repite con una subpoblación (ej. solo viernes o solo lunes). ¿Cómo cambia el valor de referencia?",
      a: `Al filtrar <strong>solo viernes</strong> (N = ${vVie.length} registros):
        <ul style="margin:8px 0">
          <li>μ₁(viernes) = <strong>${m1Vie.toFixed(4)}</strong> vs μ₁(todos) = ${momento(vAll,1).toFixed(4)}</li>
          <li>μ₂(viernes) = <strong>${m2Vie.toFixed(4)}</strong> vs μ₂(todos) = ${momento(vAll,2).toFixed(4)}</li>
          <li>μ₃(viernes) = <strong>${m3Vie.toFixed(1)}</strong> vs μ₃(todos) = ${momento(vAll,3).toFixed(1)}</li>
        </ul>
        Los momentos de viernes son notablemente más altos porque el puesto vende más en ese día
        (media ≈ ${m1Vie.toFixed(2)} vs ${momento(vAll,1).toFixed(2)} para toda la semana).

        Al filtrar <strong>solo lunes</strong> (N = ${vLun.length}):
        μ₁(lunes) = <strong>${m1Lun.toFixed(4)}</strong> — considerablemente más bajo.

        Con 50 muestras de viernes: promedio m₁' ≈ ${sim50V.pm1.toFixed(3)} (error: ${((sim50V.pm1-m1Vie)/m1Vie*100).toFixed(2)} %).
        Con 50 muestras de lunes: promedio m₁' ≈ ${sim50L.pm1.toFixed(3)} (error: ${((sim50L.pm1-m1Lun)/m1Lun*100).toFixed(2)} %).

        <strong>Subpoblación actual en el experimento:</strong> "${subLabel}" (N=${N}, μ₁=${m1p.toFixed(4)}).

        <strong>Conclusión:</strong> los estimadores siguen siendo insesgados para cada subpoblación,
        pero los valores de referencia son distintos. Esto subraya la importancia de
        definir claramente <em>qué población</em> se desea estudiar antes de tomar la muestra.`
    },
    {
      q: "6. Repite con y sin reemplazo. ¿Qué cambios observas en la dispersión?",
      a: `Comparativa para la subpoblación "${subLabel}" (N=${N}):
        <table style="margin:10px 0;border-collapse:collapse;width:100%;font-size:0.93rem">
          <thead>
            <tr style="background:#f8fafc">
              <th style="border:1px solid #dce4ee;padding:8px">Tipo de muestreo</th>
              <th style="border:1px solid #dce4ee;padding:8px">σ(m₁')</th>
              <th style="border:1px solid #dce4ee;padding:8px">σ(m₂')</th>
              <th style="border:1px solid #dce4ee;padding:8px">σ(m₃')</th>
              <th style="border:1px solid #dce4ee;padding:8px">E[m₁']</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid #dce4ee;padding:8px">Con reemplazo${modo==="with_replacement"&&!sinExperimento?" ★":""}</td>
              <td style="border:1px solid #dce4ee;padding:8px">${simCR.sm1.toFixed(3)}</td>
              <td style="border:1px solid #dce4ee;padding:8px">${simCR.sm2.toFixed(2)}</td>
              <td style="border:1px solid #dce4ee;padding:8px">${simCR.sm3.toFixed(0)}</td>
              <td style="border:1px solid #dce4ee;padding:8px">${simCR.pm1.toFixed(3)}</td>
            </tr>
            <tr style="background:#f8fafc">
              <td style="border:1px solid #dce4ee;padding:8px">Sin reemplazo${modo==="without_replacement"&&!sinExperimento?" ★":""}</td>
              <td style="border:1px solid #dce4ee;padding:8px">${simSR.sm1.toFixed(3)}</td>
              <td style="border:1px solid #dce4ee;padding:8px">${simSR.sm2.toFixed(2)}</td>
              <td style="border:1px solid #dce4ee;padding:8px">${simSR.sm3.toFixed(0)}</td>
              <td style="border:1px solid #dce4ee;padding:8px">${simSR.pm1.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
        <em style="font-size:0.88rem;color:#6b7280">★ = modo usado en el experimento actual</em><br><br>
        El muestreo <strong>sin reemplazo</strong> tiende a producir menor variabilidad.
        Esto se explica por el <em>factor de corrección para poblaciones finitas</em>:
        <code>FPC = √((N−n)/(N−1))</code>. Para N=${N} y n=7, FPC ≈ ${Math.sqrt((N-7)/(N-1)).toFixed(4)}${N<=60?" — efecto pronunciado por el tamaño pequeño de la subpoblación":""}.`
    },
    {
      q: "7. Conclusión: relación entre población, muestra, momentos muestrales y estimación puntual.",
      a: `<strong>Síntesis con los datos del experimento actual (subpob.: "${subLabel}", N=${N}, ${nLabel} muestras, ${modoLabel}):</strong>

        <ol style="margin:10px 0">
          <li><strong>Variabilidad muestral es inevitable:</strong> con n=7 y σ subpoblacional ≈ ${sigP.toFixed(3)},
          la desviación estándar teórica del primer momento muestral es σ/√n = ${(sigP/Math.sqrt(7)).toFixed(3)},
          lo que confirma que m₁' fluctuará ≈ ±${(sigP/Math.sqrt(7)).toFixed(2)} unidades alrededor de μ₁.
          La σ empírica obtenida fue ${simActual.sm1.toFixed(3)}.</li>

          <li><strong>Los momentos muestrales son estimadores insesgados:</strong>
          promedio m₁' ≈ ${simActual.pm1.toFixed(4)} vs μ₁ = ${m1p.toFixed(4)}
          (error: ${((simActual.pm1-m1p)/m1p*100).toFixed(2)} %).</li>

          <li><strong>La amplificación crece con la potencia:</strong>
          la razón de dispersión σ(m₃')/σ(m₁') ≈ ${simActual.sm1>0?(simActual.sm3/simActual.sm1).toFixed(0):"—"}x,
          lo que ilustra por qué los momentos de orden alto son más sensibles a valores atípicos.</li>

          <li><strong>La subpoblación define el parámetro:</strong> muestrear "${subLabel}"
          estima μ₁ = ${m1p.toFixed(2)}, que puede diferir de μ₁ global = ${momento(vAll,1).toFixed(2)}.
          Ambos estimadores son correctos, pero responden preguntas distintas.</li>

          <li><strong>Más muestras → mejor estimación:</strong> la ley de los grandes números
          garantiza que, al aumentar el número de muestras, el promedio de los momentos
          muestrales converge al momento poblacional.</li>
        </ol>`
    }
  ];

  const html = preguntas.map((p, i) => `
    <div class="qa-block">
      <div class="qa-question">${p.q}</div>
      <div class="qa-answer">${p.a}</div>
    </div>
  `).join("");

  $("answersContainer").innerHTML = html;
}

/* ─────────────────────────────────────────
   RESET
───────────────────────────────────────── */
function resetear() {
  $("resultsTable").querySelector("tbody").innerHTML =
    `<tr><td colspan="7" style="color:#9ca3af;text-align:center">Genera muestras para ver los resultados</td></tr>`;
  $("experimentSummary").innerHTML = `<p style="color:#9ca3af">Genera muestras para ver el resumen.</p>`;
  ["legendM1","legendM2","legendM3"].forEach(id => $(id).innerHTML = "");
  ["chartM1","chartM2","chartM3"].forEach(id => {
    const c = $(id); c.getContext("2d").clearRect(0, 0, c.width, c.height);
  });
  $("dayFilter").value = "todos";
  mostrarResumenPoblacion(datosOriginales);
  construirRespuestas(datosOriginales, datosOriginales, null, "with_replacement");
  $("statusBox").textContent = "Restablecido. Configura el experimento y pulsa «Generar muestras».";
}

/* ─────────────────────────────────────────
   EVENTOS
───────────────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  cargarPoblacion();

  $("dayFilter").addEventListener("change", () => {
    const sub = obtenerSubpoblacion();
    mostrarResumenPoblacion(sub);
    $("statusBox").textContent =
      `Subpoblación seleccionada: "${$("dayFilter").value}" — N = ${sub.length} registros. Pulsa «Generar muestras».`;
  });

  $("runBtn").addEventListener("click", generarMuestras);
  $("resetBtn").addEventListener("click", resetear);
});
