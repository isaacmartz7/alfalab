const UI = (() => {
  const MODES = {
    lineal: {
      dimension: "length",
      preferred: "m",
      symbol: "L",
      delta: "ΔL",
      coef: "α",
      which: "alpha",
      label: "Longitud inicial, L₀",
      formula: "ΔL = L₀ · α · ΔT",
      kind: "lineal",
    },
    superficial: {
      dimension: "area",
      preferred: "m2",
      symbol: "A",
      delta: "ΔA",
      coef: "2α",
      which: "gamma",
      label: "Área inicial, A₀",
      formula: "ΔA = A₀ · 2α · ΔT",
      kind: "superficial",
    },
    volumetrica: {
      dimension: "volume",
      preferred: "L",
      symbol: "V",
      delta: "ΔV",
      coef: "β",
      which: "beta",
      label: "Volumen inicial, V₀",
      formula: "ΔV = V₀ · β · ΔT",
      kind: "volumetrica",
    },
  };

  const $ = (id) => document.getElementById(id);
  let keepCalcNote = false;

  function init() {
    bindTheme();
    bindTabs();
    $("panel-calcular").addEventListener("input", renderCalc);
    $("panel-calcular").addEventListener("change", renderCalc);
    $("panel-aparente").addEventListener("input", renderApparent);
    $("panel-aparente").addEventListener("change", renderApparent);
    $("panel-comparar").addEventListener("input", renderCompare);
    $("panel-comparar").addEventListener("change", renderCompare);
    $("calc-ejemplo").addEventListener("click", () => loadCalcExample());
    $("ap-ejemplo").addEventListener("click", () => loadApparentExample());
    $("cmp-ejemplo").addEventListener("click", () => loadCompareExample());
    bindSlider("calc-slider", "calc-tf");
    bindSlider("ap-slider", "ap-tf");
    bindSlider("cmp-slider", "cmp-tf");
    bindNudge("calc-minus", "calc-tf", -1);
    bindNudge("calc-plus", "calc-tf", 1);
    bindNudge("ap-minus", "ap-tf", -1);
    bindNudge("ap-plus", "ap-tf", 1);
    bindNudge("cmp-minus", "cmp-tf", -1);
    bindNudge("cmp-plus", "cmp-tf", 1);
    loadCalcExample(false);
    loadApparentExample(false);
    loadCompareExample(false);
    showPanel("calcular");
  }

  function bindTheme() {
    const saved = localStorage.getItem("alfalab-theme");
    applyTheme(saved === "dark" ? "dark" : "light");
    $("theme-toggle").addEventListener("click", () => {
      applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
  }

  function applyTheme(theme) {
    const dark = theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("alfalab-theme", dark ? "dark" : "light"); } catch (e) {}
    const button = $("theme-toggle");
    button.setAttribute("aria-pressed", dark ? "true" : "false");
    button.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  }

  function bindTabs() {
    document.querySelectorAll(".tabs button").forEach((button) => {
      button.addEventListener("click", () => showPanel(button.dataset.panel));
    });
  }

  function showPanel(id) {
    document.querySelectorAll(".tabs button").forEach((button) => {
      button.setAttribute("aria-selected", button.dataset.panel === id ? "true" : "false");
    });
    document.querySelectorAll("[data-panel-body]").forEach((panel) => {
      panel.hidden = panel.dataset.panelBody !== id;
    });
  }

  function bindSlider(sliderId, fieldId) {
    $(sliderId).addEventListener("input", () => {
      $(fieldId).value = $(sliderId).value;
    });
  }

  function bindNudge(buttonId, fieldId, delta) {
    $(buttonId).addEventListener("click", () => {
      const current = Physics.parseNumber($(fieldId).value);
      const base = Number.isFinite(current) ? current : 20;
      const next = Math.round((base + delta) * 10) / 10;
      $(fieldId).value = String(next);
      $(fieldId).dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function mirrorTemp(sliderId, readoutId, value) {
    if (!Number.isFinite(value)) return;
    const slider = $(sliderId);
    const min = Number(slider.min);
    const max = Number(slider.max);
    slider.value = String(Math.min(max, Math.max(min, value)));
    $(readoutId).textContent = `${Physics.formatPlain(value)} °C`;
  }

  function setMaterials(select, filter, fallback, allowEmpty) {
    const key = `${filter}:${allowEmpty ? "empty" : "full"}`;
    if (select.dataset.filter === key && select.options.length) return;
    const current = select.value;
    select.replaceChildren();
    if (allowEmpty) {
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Sin tercer material";
      select.appendChild(empty);
    }
    const groups = filter === "all"
      ? [["Sólidos", Materials.solids], ["Líquidos", Materials.liquids]]
      : filter === "liquid"
        ? [["", Materials.liquids]]
        : [["", Materials.solids]];
    groups.forEach(([label, list]) => {
      const parent = label ? document.createElement("optgroup") : select;
      if (label) {
        parent.label = label;
        select.appendChild(parent);
      }
      list.forEach((material) => {
        const option = document.createElement("option");
        option.value = material.id;
        option.textContent = material.name;
        parent.appendChild(option);
      });
    });
    select.dataset.filter = key;
    const values = [...select.options].map((option) => option.value);
    if (values.includes(current)) select.value = current;
    else select.value = values.includes(fallback) ? fallback : values[0];
  }

  function setUnits(select, dimension, preferred) {
    if (select.dataset.dimension === dimension) return;
    const current = select.value;
    select.replaceChildren();
    Physics.unitsFor(dimension).forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.label;
      select.appendChild(option);
    });
    select.dataset.dimension = dimension;
    const values = [...select.options].map((option) => option.value);
    select.value = values.includes(current) ? current : preferred;
  }

  function paintRange(box, which) {
    const material = Materials.byId("vidrio");
    box.querySelectorAll("[data-preset]").forEach((label) => {
      const preset = label.dataset.preset;
      const name = preset === "min" ? "Menor" : preset === "max" ? "Mayor" : "Medio";
      label.querySelector("span").textContent = `${name} · ${Materials.formatValue(material, which, preset)}`;
    });
  }

  function preset(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : "mid";
  }

  function modeFrom(name) {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : "lineal";
  }

  function inUnit(si, unitId) {
    return `${Physics.formatPlain(Physics.fromSI(si, unitId))} ${Physics.unit(unitId).label}`;
  }

  function phrase(si, unitId, dimension) {
    const selected = inUnit(si, unitId);
    if (si === 0) return selected;
    const friendly = Physics.bestUnit(Math.abs(si), dimension);
    if (friendly === unitId) return selected;
    return `${selected} = ${inUnit(si, friendly)}`;
  }

  function headlineAmount(si, unitId, dimension) {
    if (si === 0) return "";
    const selectedAbs = Math.abs(Physics.fromSI(si, unitId));
    const awkward = selectedAbs < 0.1 || selectedAbs >= 10000;
    const chosen = awkward ? Physics.bestUnit(Math.abs(si), dimension) : unitId;
    return `${Physics.formatPlain(Math.abs(Physics.fromSI(si, chosen)))} ${Physics.unit(chosen).label}`;
  }

  function temp(value) {
    return `${Physics.formatPlain(value)} °C`;
  }

  function coefText(material, which, rangePreset) {
    return `${Materials.formatValue(material, which, rangePreset)} °C⁻¹`;
  }

  function coefInFormula(material, which, rangePreset) {
    if (which === "gamma") return `2 · ${coefText(material, "alpha", rangePreset)}`;
    return coefText(material, which, rangePreset);
  }

  function fillList(list, items) {
    list.replaceChildren();
    items.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      list.appendChild(li);
    });
  }

  function showError(errorId, list, extraIds, message) {
    const error = $(errorId);
    error.hidden = !message;
    error.textContent = message;
    if (message) {
      list.replaceChildren();
      extraIds.forEach((id) => {
        const node = $(id);
        if (node) node.textContent = "";
      });
    }
  }

  function verb(kind, change) {
    if (change === 0) return { sentence: "no cambia de medida", short: "no cambia" };
    const grow = change > 0;
    if (kind === "lineal") return grow
      ? { sentence: "se alarga", short: "se alarga" }
      : { sentence: "se contrae", short: "se contrae" };
    if (kind === "superficial") return grow
      ? { sentence: "aumenta su área en", short: "aumenta" }
      : { sentence: "disminuye su área en", short: "disminuye" };
    return grow
      ? { sentence: "aumenta su volumen en", short: "aumenta" }
      : { sentence: "disminuye su volumen en", short: "disminuye" };
  }

  function loadCalcExample() {
    const kind = modeFrom("modo");
    const examples = {
      lineal: ["acero", "10", "m", "15", "40", "Riel de acero de 10 m, de 15 °C a 40 °C."],
      superficial: ["aluminio", "2", "m2", "20", "70", "Chapa de aluminio de 2 m² y 1 m de diámetro, de 20 °C a 70 °C."],
      volumetrica: ["etanol", "1", "L", "20", "40", "Un litro de etanol, de 20 °C a 40 °C."],
    };
    const [material, value, unit, ti, tf, text] = examples[kind];
    const spec = MODES[kind];
    setMaterials($("calc-material"), kind === "volumetrica" ? "all" : "solid", material);
    setUnits($("calc-unidad"), spec.dimension, spec.preferred);
    $("calc-material").value = material;
    $("calc-valor").value = value;
    $("calc-unidad").value = unit;
    $("calc-ti").value = ti;
    $("calc-tf").value = tf;
    $("calc-diametro").value = kind === "superficial" ? "1" : "";
    if (kind === "superficial") {
      setUnits($("calc-d-unidad"), "length", "m");
      $("calc-d-unidad").value = "m";
    }
    keepCalcNote = true;
    $("calc-ejemplo-nota").textContent = text;
    renderCalc();
  }

  function renderCalc() {
    if (keepCalcNote) keepCalcNote = false;
    else $("calc-ejemplo-nota").textContent = "";
    const kind = modeFrom("modo");
    const spec = MODES[kind];
    setMaterials($("calc-material"), kind === "volumetrica" ? "all" : "solid", "acero");
    setUnits($("calc-unidad"), spec.dimension, spec.preferred);
    const material = Materials.byId($("calc-material").value);
    $("calc-medida-label").textContent = spec.label;
    $("calc-vidrio").hidden = material.id !== "vidrio";
    paintRange($("calc-vidrio"), spec.which);

    const rangePreset = preset("calc-rango");
    const initial = Physics.parseNumber($("calc-valor").value);
    const ti = Physics.parseNumber($("calc-ti").value);
    const tf = Physics.parseNumber($("calc-tf").value);
    const unitId = $("calc-unidad").value;
    mirrorTemp("calc-slider", "calc-tf-read", tf);
    const problem = Physics.validateMeasure(initial, ti, tf);

    const diameter = readDiameter(kind);
    $("calc-kicker").textContent = problem || diameter.error ? "Revisá los datos" : `${labelKind(kind)} · ${material.name}`;
    if (problem || diameter.error) {
      $("calc-headline").textContent = "Falta un dato para calcular.";
      $("calc-formula").textContent = spec.formula;
      $("calc-sub").textContent = "";
      clearDiameterResult();
      clearGraph();
      showError("calc-error", $("calc-steps"), ["calc-insight", "calc-degree"], problem || diameter.error);
      setFigure($("calc-figure"), emptyFigure(), "Cuando los datos estén completos, acá aparece la figura.");
      return;
    }
    showError("calc-error", $("calc-steps"), [], "");

    const dT = Physics.deltaT(ti, tf);
    if (diameter.value) {
      diameter.expansion = Physics.expansion(diameter.si, Materials.value(material, "alpha", rangePreset), dT);
    }
    const coefficient = Materials.value(material, spec.which, rangePreset);
    const result = Physics.expansion(Physics.toSI(initial, unitId), coefficient, dT);
    const amount = headlineAmount(result.change, unitId, spec.dimension);
    const action = verb(kind, result.change);
    let headline = result.change === 0
      ? `${material.article} ${material.short} no cambia.`
      : kind === "lineal"
        ? `${material.article} ${material.short} ${action.sentence} ${amount}.`
        : `${material.article} ${material.short} ${action.sentence} ${amount}.`;

    if (diameter.value) {
      const diameterAction = verb("lineal", diameter.expansion.change);
      const diameterAmount = headlineAmount(diameter.expansion.change, diameter.unitId, "length");
      if (diameter.expansion.change !== 0) {
        headline += ` El diámetro ${diameterAction.sentence} ${diameterAmount}.`;
      }
    }

    $("calc-headline").textContent = headline;
    $("calc-formula").textContent = spec.formula;
    $("calc-sub").textContent = `${spec.delta} = ${Physics.formatPlain(initial)} ${Physics.unit(unitId).label} · ${coefInFormula(material, spec.which, rangePreset)} · ${Physics.formatPlain(dT)} °C = ${phrase(result.change, unitId, spec.dimension)}`;
    writeDiameterResult(material, rangePreset, dT, diameter);

    const steps = [
      `Cambio de temperatura: ΔT = ${temp(tf)} − ${temp(ti)} = ${Physics.formatPlain(dT)} °C. Ese intervalo es el mismo en kelvin.`,
    ];
    if (spec.which === "gamma") {
      steps.push(`La tabla da α = ${coefText(material, "alpha", rangePreset)}. Como crece igual en las dos direcciones, γ = 2α = ${coefText(material, "gamma", rangePreset)}.`);
    } else if (spec.which === "beta" && material.kind === "solid") {
      steps.push(`En los sólidos de la tabla, β = 3α. Para este material, β = ${coefText(material, "beta", rangePreset)}.`);
    } else if (spec.which === "beta") {
      steps.push(`Los líquidos traen β directo: ${coefText(material, "beta", rangePreset)}.`);
    } else {
      steps.push(`Coeficiente lineal del ${material.short}: α = ${coefText(material, "alpha", rangePreset)}.`);
    }
    steps.push(`${spec.delta} = ${spec.symbol}₀ · ${spec.coef} · ΔT = ${phrase(result.change, unitId, spec.dimension)}.`);
    const finalName = kind === "lineal" ? "Longitud final" : kind === "superficial" ? "Área final" : "Volumen final";
    steps.push(`${finalName}: ${spec.symbol} = ${spec.symbol}₀ + ${spec.delta} = ${inUnit(result.final, unitId)}.`);
    if (diameter.value) {
      steps.push(`El diámetro usa el coeficiente lineal, no el doble: α = ${coefText(material, "alpha", rangePreset)}.`);
      steps.push(`ΔD = D₀ · α · ΔT = ${phrase(diameter.expansion.change, diameter.unitId, "length")}.`);
      steps.push(`Diámetro final: D = D₀ + ΔD = ${inUnit(diameter.expansion.final, diameter.unitId)}.`);
    }
    fillList($("calc-steps"), steps);

    const si = Physics.toSI(initial, unitId);
    const motion = picturePixels(dT, coefficient);
    const figure = kind === "lineal"
      ? barFigure(pictureSize(si, "length"), motion)
      : kind === "superficial"
        ? plateFigure(
          diameter.value
            ? pictureSize(si, "area") * 0.35 + pictureSize(diameter.si, "length") * 0.65
            : pictureSize(si, "area"),
          motion,
          Boolean(diameter.value),
        )
        : vesselFigure(pictureSize(si, "volume"), motion);
    const figureCaption = kind === "lineal"
      ? "El largo del riel sigue la longitud que escribís. La junta se mueve con cada grado: se cierra al calentar y se abre al enfriar. El dibujo exagera ese movimiento; los números de arriba son el cálculo real."
      : kind === "superficial" && diameter.value
        ? "El disco sigue el área y el diámetro que escribís, y crece o se achica con cada grado. El círculo punteado es el tamaño inicial. El dibujo exagera el cambio; los números son el cálculo real."
        : kind === "superficial"
          ? "La placa sigue el área que escribís y crece o se achica con cada grado. El borde punteado es el tamaño inicial. El dibujo exagera el cambio; los números son el cálculo real."
          : "El tanque sigue el volumen que escribís y crece o se achica con cada grado, en las tres direcciones. El contorno punteado es el tamaño inicial. El dibujo exagera el cambio; los números son el cálculo real.";
    setFigure($("calc-figure"), figure, figureCaption);
    $("calc-insight").textContent = insightCalc(material, kind, result.fraction, dT);
    const oneDegree = Physics.expansion(Physics.toSI(initial, unitId), coefficient, 1);
    drawChangeGraph(spec, oneDegree.change, dT, ti);
    let degreeText = `Por cada grado, con esta medida: ${phrase(oneDegree.change, unitId, spec.dimension)}. El resultado de arriba es ese cambio multiplicado por ΔT.`;
    if (diameter.value) {
      const oneDiameter = Physics.expansion(diameter.si, Materials.value(material, "alpha", rangePreset), 1);
      degreeText += ` El diámetro, por cada grado: ${phrase(oneDiameter.change, diameter.unitId, "length")}.`;
    }
    $("calc-degree").textContent = degreeText;
  }

  function readDiameter(kind) {
    const field = $("calc-diametro-field");
    if (kind !== "superficial") {
      field.hidden = true;
      clearDiameterResult();
      return { value: null, error: "" };
    }
    field.hidden = false;
    setUnits($("calc-d-unidad"), "length", "m");
    const raw = $("calc-diametro").value.trim();
    if (!raw) return { value: null, error: "" };
    const value = Physics.parseNumber(raw);
    if (!Number.isFinite(value) || value <= 0) {
      return { value: null, error: "El diámetro tiene que ser un número mayor que cero. Si no lo tenés, dejá el casillero vacío." };
    }
    const unitId = $("calc-d-unidad").value;
    const si = Physics.toSI(value, unitId);
    return { value, unitId, si, error: "" };
  }

  function clearDiameterResult() {
    $("calc-formula-d").hidden = true;
    $("calc-sub-d").textContent = "";
  }

  function writeDiameterResult(material, rangePreset, dT, diameter) {
    if (!diameter.value) {
      clearDiameterResult();
      return;
    }
    $("calc-formula-d").hidden = false;
    $("calc-formula-d").textContent = "ΔD = D₀ · α · ΔT";
    $("calc-sub-d").textContent = `ΔD = ${Physics.formatPlain(diameter.value)} ${Physics.unit(diameter.unitId).label} · ${coefText(material, "alpha", rangePreset)} · ${Physics.formatPlain(dT)} °C = ${phrase(diameter.expansion.change, diameter.unitId, "length")}`;
  }

  function insightCalc(material, kind, fraction, dT) {
    if (dT === 0) {
      return "Sin cambio de temperatura no hay dilatación ni contracción. El coeficiente dice cuánto cambiaría por cada grado, pero acá el intervalo es cero.";
    }
    const percent = Physics.formatSig(Math.abs(fraction * 100), 3);
    const parts = [`Es el ${percent} % de la medida inicial.`];
    if (material.id === "invar") {
      parts.push("Es de los materiales que menos se dilatan. Se usa en reglas y piezas de precisión, donde un cambio con el clima sería un error de medida.");
    } else if (material.id === "cuarzo") {
      parts.push("El cuarzo fundido casi no cambia de tamaño. Por eso se usa cuando la medida tiene que mantenerse.");
    } else if (material.kind === "liquid") {
      parts.push("Los líquidos de la tabla se dilatan mucho más que los sólidos. En un termómetro ese aumento se ve porque el líquido sube por un tubo fino.");
    } else if (kind === "lineal") {
      parts.push("En una pieza corta casi no se nota. En un riel, un puente o una cañería larga, esos milímetros importan y hay que dejar espacio.");
    } else if (kind === "superficial") {
      parts.push("El área cambia el doble de rápido que cada lado, porque el material crece en las dos direcciones a la vez.");
    } else {
      parts.push("El volumen de un sólido cambia el triple de rápido que su longitud, porque crece en las tres direcciones.");
    }
    if (Math.abs(dT) > 200) {
      parts.push("Con un salto de temperatura tan grande, el coeficiente ya no es tan constante: tomá el resultado como una estimación.");
    }
    return parts.join(" ");
  }

  function loadApparentExample() {
    setMaterials($("ap-liquido"), "liquid", "mercurio");
    setMaterials($("ap-recipiente"), "solid", "vidrio");
    setUnits($("ap-unidad"), "volume", "mL");
    $("ap-liquido").value = "mercurio";
    $("ap-recipiente").value = "vidrio";
    $("ap-valor").value = "100";
    $("ap-unidad").value = "mL";
    $("ap-ti").value = "20";
    $("ap-tf").value = "50";
    const mid = document.querySelector('input[name="ap-rango"][value="mid"]');
    if (mid) mid.checked = true;
    renderApparent();
  }

  function renderApparent() {
    setMaterials($("ap-liquido"), "liquid", "mercurio");
    setMaterials($("ap-recipiente"), "solid", "vidrio");
    setUnits($("ap-unidad"), "volume", "mL");
    const liquid = Materials.byId($("ap-liquido").value);
    const container = Materials.byId($("ap-recipiente").value);
    $("ap-vidrio").hidden = container.id !== "vidrio";
    paintRange($("ap-vidrio"), "beta");

    const rangePreset = preset("ap-rango");
    const initial = Physics.parseNumber($("ap-valor").value);
    const ti = Physics.parseNumber($("ap-ti").value);
    const tf = Physics.parseNumber($("ap-tf").value);
    const unitId = $("ap-unidad").value;
    mirrorTemp("ap-slider", "ap-tf-read", tf);
    const problem = Physics.validateMeasure(initial, ti, tf);
    $("ap-kicker").textContent = problem ? "Revisá los datos" : `${liquid.name} en ${container.short}`;
    if (problem) {
      $("ap-headline").textContent = "Falta un dato para calcular.";
      $("ap-formula").textContent = "β aparente = β líquido − β recipiente";
      $("ap-sub").textContent = "";
      showError("ap-error", $("ap-steps"), ["ap-insight", "ap-degree"], problem);
      $("ap-metrics").replaceChildren();
      setFigure($("ap-figure"), beakerFigure(1, 0), "Cuando los datos estén completos, acá aparece el recipiente.");
      return;
    }
    showError("ap-error", $("ap-steps"), [], "");

    const dT = Physics.deltaT(ti, tf);
    const betaLiquid = Materials.value(liquid, "beta", "mid");
    const betaContainer = Materials.value(container, "beta", rangePreset);
    const result = Physics.apparent(Physics.toSI(initial, unitId), betaLiquid, betaContainer, dT);
    const amount = headlineAmount(result.apparent, unitId, "volume");
    $("ap-formula").textContent = "β aparente = β líquido − β recipiente";
    const betaText = `${Materials.formatFromMantissa(Materials.mantissa(liquid, "beta") - Materials.mantissa(container, "beta", rangePreset))} °C⁻¹`;
    $("ap-sub").textContent = `β aparente = ${coefText(liquid, "beta", "mid")} − ${coefText(container, "beta", rangePreset)} = ${betaText}`;

    if (result.apparent === 0) {
      $("ap-headline").textContent = "El nivel no cambia.";
    } else if (result.apparent > 0) {
      $("ap-headline").textContent = `El líquido le gana al recipiente: sobran ${amount}.`;
    } else {
      $("ap-headline").textContent = `El líquido se achica más que el recipiente: el nivel baja ${amount}.`;
    }

    metricCards($("ap-metrics"), [
      ["Líquido", phrase(result.liquid, unitId, "volume"), false],
      ["Recipiente", phrase(result.container, unitId, "volume"), false],
      ["Aparente", phrase(result.apparent, unitId, "volume"), true],
    ]);

    const spill = result.apparent > 0 && dT > 0
      ? " Si el recipiente estaba lleno hasta el borde, ese volumen se derrama."
      : result.apparent < 0 && dT < 0
        ? " Al enfriar, el nivel baja en esa cantidad aparente."
        : "";
    fillList($("ap-steps"), [
      `Cambio de temperatura: ΔT = ${temp(tf)} − ${temp(ti)} = ${Physics.formatPlain(dT)} °C.`,
      `β del ${liquid.short} = ${coefText(liquid, "beta", "mid")}. β del ${container.short} = ${coefText(container, "beta", rangePreset)}.`,
      `β aparente = ${betaText}.`,
      `El líquido cambia ${phrase(result.liquid, unitId, "volume")}.`,
      `La capacidad del recipiente cambia ${phrase(result.container, unitId, "volume")}.`,
      `El cambio que se ve es ΔV aparente = V₀ · β aparente · ΔT = ${phrase(result.apparent, unitId, "volume")}.${spill}`,
    ]);

    const apparentSi = Physics.toSI(initial, unitId);
    setFigure(
      $("ap-figure"),
      beakerFigure(pictureSize(apparentSi, "volume"), picturePixels(dT, Math.abs(betaLiquid - betaContainer))),
      "El termómetro sigue el volumen que escribís. La columna sube o baja con cada grado, por la diferencia entre el líquido y el recipiente. La marca punteada es el nivel inicial. El dibujo exagera ese movimiento; los números son el cálculo real.",
    );
    $("ap-insight").textContent = `${liquid.article} ${liquid.short} se dilata más que el ${container.short}. Por eso un termómetro de mercurio en vidrio puede marcar la temperatura: la columna sube por la diferencia, no por todo el cambio del líquido.`;
    const oneApparent = Physics.apparent(Physics.toSI(initial, unitId), betaLiquid, betaContainer, 1);
    $("ap-degree").textContent = `Por cada grado, el nivel cambia ${phrase(oneApparent.apparent, unitId, "volume")}. Arrastrá la temperatura para ver cómo se acumula.`;
  }

  function metricCards(host, cards) {
    host.replaceChildren();
    cards.forEach(([label, value, highlight]) => {
      const card = document.createElement("div");
      card.className = highlight ? "metric highlight" : "metric";
      const span = document.createElement("span");
      span.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      card.append(span, strong);
      host.appendChild(card);
    });
  }

  function loadCompareExample() {
    const kind = modeFrom("cmp-modo");
    if (kind === "volumetrica") {
      setMaterials($("cmp-a"), "all", "etanol");
      setMaterials($("cmp-b"), "all", "glicerina");
      setMaterials($("cmp-c"), "all", "mercurio", true);
      setUnits($("cmp-unidad"), "volume", "L");
      $("cmp-a").value = "etanol";
      $("cmp-b").value = "glicerina";
      $("cmp-c").value = "mercurio";
      $("cmp-valor").value = "1";
      $("cmp-unidad").value = "L";
      $("cmp-ti").value = "20";
      $("cmp-tf").value = "40";
    } else {
      setMaterials($("cmp-a"), "solid", "aluminio");
      setMaterials($("cmp-b"), "solid", "acero");
      setMaterials($("cmp-c"), "solid", "invar", true);
      setUnits($("cmp-unidad"), "length", "m");
      $("cmp-a").value = "aluminio";
      $("cmp-b").value = "acero";
      $("cmp-c").value = "invar";
      $("cmp-valor").value = "1";
      $("cmp-unidad").value = "m";
      $("cmp-ti").value = "20";
      $("cmp-tf").value = "120";
    }
    renderCompare();
  }

  function renderCompare() {
    const kind = modeFrom("cmp-modo");
    const spec = MODES[kind];
    const filter = kind === "volumetrica" ? "all" : "solid";
    setMaterials($("cmp-a"), filter, kind === "volumetrica" ? "etanol" : "aluminio");
    setMaterials($("cmp-b"), filter, kind === "volumetrica" ? "glicerina" : "acero");
    setMaterials($("cmp-c"), filter, kind === "volumetrica" ? "mercurio" : "invar", true);
    setUnits($("cmp-unidad"), spec.dimension, spec.preferred);
    $("cmp-medida-label").textContent = spec.label;

    const ids = [$("cmp-a").value, $("cmp-b").value, $("cmp-c").value].filter(Boolean);
    $("cmp-vidrio").hidden = !ids.includes("vidrio");
    paintRange($("cmp-vidrio"), spec.which);

    const initial = Physics.parseNumber($("cmp-valor").value);
    const ti = Physics.parseNumber($("cmp-ti").value);
    const tf = Physics.parseNumber($("cmp-tf").value);
    const unitId = $("cmp-unidad").value;
    mirrorTemp("cmp-slider", "cmp-tf-read", tf);
    const problem = Physics.validateMeasure(initial, ti, tf);
    if (problem) {
      $("cmp-kicker").textContent = "Revisá los datos";
      $("cmp-headline").textContent = "Falta un dato para comparar.";
      showError("cmp-error", { replaceChildren() {} }, ["cmp-insight"], problem);
      $("cmp-bars").replaceChildren();
      return;
    }
    showError("cmp-error", { replaceChildren() {} }, [], "");

    const dT = Physics.deltaT(ti, tf);
    const rangePreset = preset("cmp-rango");
    const items = ids.map((id) => {
      const material = Materials.byId(id);
      const coefficient = Materials.value(material, spec.which, rangePreset);
      const result = Physics.expansion(Physics.toSI(initial, unitId), coefficient, dT);
      return { material, coefficient, change: result.change };
    });
    const largest = Math.max(...items.map((item) => Math.abs(item.change)), 0);

    $("cmp-kicker").textContent = `${labelKind(kind)} · ΔT = ${Physics.formatPlain(dT)} °C`;
    $("cmp-headline").textContent = dT === 0
      ? "Con este intervalo nadie cambia."
      : dT > 0
        ? "Quién se dilata más con la misma medida y el mismo ΔT."
        : "Quién se contrae más con la misma medida y el mismo ΔT.";

    const bars = $("cmp-bars");
    bars.replaceChildren();
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      const name = document.createElement("div");
      name.className = "bar-name";
      name.textContent = item.material.name;
      const coef = document.createElement("span");
      coef.className = "bar-coef";
      coef.textContent = spec.which === "gamma"
        ? `2α = ${coefText(item.material, spec.which, rangePreset)}`
        : `${spec.coef} = ${coefText(item.material, spec.which, rangePreset)}`;
      name.appendChild(coef);

      const track = document.createElement("div");
      track.className = "bar-track";
      const fill = document.createElement("div");
      fill.className = item.change < 0 ? "bar-fill cold" : "bar-fill";
      const width = largest === 0 ? 0 : (Math.abs(item.change) / largest) * 100;
      fill.style.width = `${width}%`;
      if (item.change === 0) fill.style.minWidth = "0";
      track.appendChild(fill);

      const value = document.createElement("div");
      value.className = "bar-value";
      value.textContent = phrase(item.change, unitId, spec.dimension);

      row.append(name, track, value);
      bars.appendChild(row);
    });

    $("cmp-insight").textContent = compareInsight(items, spec);
  }

  function compareInsight(items, spec) {
    if (items.length < 2) return "Elegí al menos dos materiales para ver la diferencia.";
    const sorted = [...items].sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
    const big = sorted[0];
    const small = sorted[sorted.length - 1];
    if (big.coefficient === small.coefficient) {
      return "Esos materiales tienen el mismo coeficiente, así que cambian igual si parten de la misma medida y del mismo ΔT.";
    }
    const times = Physics.formatSig(big.coefficient / small.coefficient, 3);
    const smallArticle = small.material.article === "La" ? "la" : "el";
    return `${big.material.article} ${big.material.short} cambia ${times} veces más que ${smallArticle} ${small.material.short}. La medida inicial y el ΔT son los mismos: la diferencia sale solo del coeficiente ${spec.coef}.`;
  }

  function labelKind(kind) {
    if (kind === "lineal") return "Lineal";
    if (kind === "superficial") return "Superficial";
    return "Volumétrica";
  }

  function clearGraph() {
    const host = $("calc-graph");
    host.hidden = true;
    host.replaceChildren();
  }

  function drawChangeGraph(spec, slopeSI, dT, ti) {
    setFigure(
      $("calc-graph"),
      changeGraph(spec, slopeSI, dT, ti),
      "La recta es el cambio real. Al mover la temperatura, el punto camina por esa recta: el doble de grados, el doble de cambio.",
    );
    $("calc-graph").hidden = false;
  }

  function axisTicks(min, max) {
    const span = max - min;
    if (!(span > 0)) return [0];
    const rough = span / 4;
    const pow = 10 ** Math.floor(Math.log10(rough));
    const scaled = rough / pow;
    const nice = scaled >= 7.5 ? 10 : scaled >= 3 ? 5 : scaled >= 1.5 ? 2 : 1;
    const step = nice * pow;
    const values = [];
    for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-6 && values.length < 6; value += step) {
      if (value <= min + span * 0.02 || value >= max - span * 0.02) continue;
      values.push(Math.abs(value) < step * 1e-6 ? 0 : value);
    }
    return values.length ? values : [0];
  }

  function changeGraph(spec, slopeSI, dT, ti) {
    const slider = $("calc-slider");
    let xMin = Number(slider.min) - ti;
    let xMax = Number(slider.max) - ti;
    if (xMin > xMax) [xMin, xMax] = [xMax, xMin];
    xMin = Math.min(xMin, 0, dT);
    xMax = Math.max(xMax, 0, dT);
    if (xMax - xMin < 1) {
      xMin -= 1;
      xMax += 1;
    }

    const yAt = (x) => slopeSI * x;
    const yPeak = Math.max(Math.abs(yAt(xMin)), Math.abs(yAt(xMax)), Math.abs(yAt(dT)));
    const currentAbs = Math.abs(yAt(dT));
    let yUnit = Physics.bestUnit(currentAbs || yPeak || 1, spec.dimension);
    const peakInUnit = Math.abs(Physics.fromSI(yPeak || 1, yUnit));
    if (currentAbs === 0 || peakInUnit >= 10000 || (yPeak > 0 && peakInUnit < 0.1)) {
      yUnit = Physics.bestUnit(yPeak || 1, spec.dimension);
    }
    const yLabel = Physics.unit(yUnit).label;
    const toY = (si) => Physics.fromSI(si, yUnit);
    let yMin = Math.min(toY(yAt(xMin)), toY(yAt(xMax)), 0);
    let yMax = Math.max(toY(yAt(xMin)), toY(yAt(xMax)), 0);
    if (yMax - yMin < 1e-9) {
      yMin -= 1;
      yMax += 1;
    }
    const yPad = (yMax - yMin) * 0.12;
    yMin -= yPad;
    yMax += yPad;

    const width = 420;
    const height = 240;
    const left = 62;
    const right = 18;
    const top = 18;
    const bottom = 42;
    const plotW = width - left - right;
    const plotH = height - top - bottom;
    const X = (x) => left + ((x - xMin) / (xMax - xMin)) * plotW;
    const Y = (y) => top + ((yMax - y) / (yMax - yMin)) * plotH;
    const num = (value) => Physics.formatSig(value, 3);

    let marks = "";
    axisTicks(xMin, xMax).forEach((tick) => {
      const x = X(tick);
      marks += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + plotH}" style="stroke:var(--svg-grid)"/>`;
      marks += `<text x="${x}" y="${height - 16}" text-anchor="middle" style="fill:var(--svg-tick)" font-size="12">${num(tick)}</text>`;
    });
    axisTicks(yMin, yMax).forEach((tick) => {
      const y = Y(tick);
      marks += `<line x1="${left}" y1="${y}" x2="${left + plotW}" y2="${y}" style="stroke:var(--svg-grid)"/>`;
      marks += `<text x="${left - 8}" y="${y + 4}" text-anchor="end" style="fill:var(--svg-tick)" font-size="12">${num(tick)}</text>`;
    });

    let axes = "";
    if (xMin < 0 && xMax > 0) {
      axes += `<line x1="${X(0)}" y1="${top}" x2="${X(0)}" y2="${top + plotH}" style="stroke:var(--svg-axis)" stroke-dasharray="4 3"/>`;
    }
    if (yMin < 0 && yMax > 0) {
      axes += `<line x1="${left}" y1="${Y(0)}" x2="${left + plotW}" y2="${Y(0)}" style="stroke:var(--svg-axis)" stroke-dasharray="4 3"/>`;
    }

    const x1 = X(xMin);
    const y1 = Y(toY(yAt(xMin)));
    const x2 = X(xMax);
    const y2 = Y(toY(yAt(xMax)));
    const px = X(dT);
    const py = Y(toY(yAt(dT)));
    const hot = dT >= 0;
    const labelOnLeft = px > left + plotW * 0.62;
    const pointLabel = `${num(dT)} °C · ${num(toY(yAt(dT)))} ${yLabel}`;

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${spec.delta} contra el cambio de temperatura. En este punto, ΔT es ${num(dT)} °C y ${spec.delta} es ${num(toY(yAt(dT)))} ${yLabel}.">
      <rect x="${left}" y="${top}" width="${plotW}" height="${plotH}" style="fill:var(--svg-plot);stroke:var(--svg-plot-line)"/>
      ${marks}
      ${axes}
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--svg-stroke)" stroke-width="2.5"/>
      <circle cx="${px}" cy="${py}" r="6" style="fill:${hot ? "#e7a58c" : "#9ebbd4"};stroke:var(--svg-stroke)" stroke-width="2"/>
      <text x="${labelOnLeft ? px - 10 : px + 10}" y="${Math.max(top + 14, py - 18)}" text-anchor="${labelOnLeft ? "end" : "start"}" style="fill:var(--svg-ink)" font-size="13">${pointLabel}</text>
      <text x="${left + plotW / 2}" y="${height - 2}" text-anchor="middle" style="fill:var(--svg-tick)" font-size="13">ΔT (°C)</text>
      <text transform="rotate(-90 16 ${top + plotH / 2})" x="16" y="${top + plotH / 2}" text-anchor="middle" style="fill:var(--svg-tick)" font-size="13">${spec.delta} (${yLabel})</text>
    </svg>`;
  }

  function setFigure(host, svg, caption) {
    host.replaceChildren();
    const holder = document.createElement("div");
    holder.innerHTML = svg;
    const figcaption = document.createElement("figcaption");
    figcaption.textContent = caption;
    host.append(holder.firstElementChild, figcaption);
  }

  function emptyFigure() {
    return `<svg width="420" height="120" viewBox="0 0 420 120" role="img" aria-label="Figura vacía">
      <rect x="24" y="46" width="250" height="32" rx="6" style="fill:var(--svg-empty);stroke:var(--svg-empty-line)"/>
    </svg>`;
  }

  function pictureSize(si, dimension) {
    const ref = dimension === "volume" ? 0.001 : 1;
    const decades = Math.log10(Math.max(si, 1e-18) / ref);
    return Math.min(1.85, Math.max(0.38, 1 + decades * 0.72));
  }

  function picturePixels(deltaT, coefficient) {
    if (!Number.isFinite(deltaT) || deltaT === 0 || !Number.isFinite(coefficient)) return 0;
    const compared = Math.abs(coefficient) / 1.2e-5;
    const loudness = Math.min(1.8, Math.max(0.35, compared ** 0.33));
    return deltaT * 3.2 * loudness;
  }

  function heatColor(motion, hot, cold) {
    return motion >= 0 ? hot : cold;
  }

  function px(value) {
    return String(Math.round(value * 10) / 10);
  }

  function barFigure(size, pixels) {
    const color = heatColor(pixels, "#d46a45", "#7ea4c4");
    const rail0 = Math.min(150, 78 * size);
    const gap0 = 96;
    const gap = Math.max(4, gap0 - pixels);
    const grown = Math.max(0, pixels - (gap0 - 4));
    const railW = Math.min(188, rail0 + grown * 0.22);
    const left = 28;
    const right = left + railW + gap;
    const right0 = left + rail0 + gap0;
    const y = 72;
    const sleeper = (x) => `<rect x="${px(x)}" y="88" width="18" height="8" rx="2" style="fill:var(--svg-wood)"/>`;
    return `<svg width="420" height="150" viewBox="0 0 420 150" role="img" aria-label="Riel con junta. El largo sigue la longitud y la junta sigue la temperatura.">
      <text x="24" y="24" style="fill:var(--svg-muted)" font-size="14">Riel · la junta se mueve con cada grado</text>
      ${sleeper(left + 12)}
      ${sleeper(left + railW - 32)}
      ${sleeper(right + 10)}
      ${sleeper(right + railW - 30)}
      <rect x="${px(right0)}" y="${y}" width="${px(rail0)}" height="14" rx="2" style="fill:none;stroke:var(--svg-ghost)" stroke-width="2" stroke-dasharray="5 4"/>
      <rect x="${px(left)}" y="${y}" width="${px(railW)}" height="14" rx="2" fill="${color}"/>
      <rect x="${px(right)}" y="${y}" width="${px(railW)}" height="14" rx="2" fill="${color}"/>
      <text x="${px(left + railW + gap / 2)}" y="60" text-anchor="middle" style="fill:var(--svg-stroke)" font-size="13">junta</text>
    </svg>`;
  }

  function plateFigure(size, pixels, asDisk) {
    const color = heatColor(pixels, "#e7a58c", "#9ebbd4");
    if (asDisk) {
      const radius0 = Math.min(70, 28 * size);
      const radius = Math.max(14, Math.min(92, radius0 + pixels * 0.45));
      const cx = 210;
      const cy = 118;
      return `<svg width="420" height="210" viewBox="0 0 420 210" role="img" aria-label="Disco. El tamaño sigue el área y el diámetro; el borde sigue la temperatura.">
        <text x="24" y="24" style="fill:var(--svg-muted)" font-size="14">Disco · se mueve con el área, el diámetro y cada grado</text>
        <circle cx="${cx}" cy="${cy}" r="${px(radius)}" fill="${color}"/>
        <circle cx="${cx}" cy="${cy}" r="${px(radius0)}" style="fill:none;stroke:var(--svg-ghost)" stroke-width="2" stroke-dasharray="5 4"/>
        <line x1="${px(cx - radius)}" y1="${cy}" x2="${px(cx + radius)}" y2="${cy}" style="stroke:var(--svg-stroke)" stroke-width="2"/>
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" fill="#241c16" font-size="14">D</text>
      </svg>`;
    }
    const baseW = Math.min(150, 86 * size);
    const baseH = Math.min(96, 54 * size);
    const nowW = Math.max(24, Math.min(280, baseW + pixels * 0.7));
    const nowH = Math.max(18, Math.min(150, baseH + pixels * 0.45));
    const x = 210 - nowW / 2;
    const y = 124 - nowH / 2;
    const x0 = 210 - baseW / 2;
    const y0 = 124 - baseH / 2;
    return `<svg width="420" height="210" viewBox="0 0 420 210" role="img" aria-label="Placa. El tamaño sigue el área y el borde sigue la temperatura.">
      <text x="24" y="24" style="fill:var(--svg-muted)" font-size="14">Placa · se mueve con el área y con cada grado</text>
      <rect x="${px(x)}" y="${px(y)}" width="${px(nowW)}" height="${px(nowH)}" rx="4" fill="${color}"/>
      <rect x="${px(x0)}" y="${px(y0)}" width="${px(baseW)}" height="${px(baseH)}" rx="4" style="fill:none;stroke:var(--svg-ghost)" stroke-width="2" stroke-dasharray="5 4"/>
    </svg>`;
  }

  function vesselFigure(size, pixels) {
    const body = heatColor(pixels, "#e7a58c", "#9ebbd4");
    const lid = heatColor(pixels, "#f0c2b0", "#c5d7e6");
    const h0 = Math.min(78, 32 * size);
    const w0 = h0 * 1.2;
    const h = Math.max(16, Math.min(146, h0 + pixels * 0.85));
    const w = Math.max(20, Math.min(200, w0 + pixels * 0.7));
    const tank = (tw, th, fillBody, fillLid, stroke, dash) => `
      <rect x="${px(-tw / 2)}" y="${px(-th)}" width="${px(tw)}" height="${px(th)}" rx="6" style="fill:${fillBody};stroke:${stroke}" stroke-width="2" ${dash}/>
      <ellipse cx="0" cy="${px(-th)}" rx="${px(tw / 2)}" ry="${px(Math.max(6, tw * 0.16))}" style="fill:${fillLid};stroke:${stroke}" stroke-width="2" ${dash}/>
      <ellipse cx="0" cy="0" rx="${px(tw / 2)}" ry="${px(Math.max(5, tw * 0.13))}" style="fill:none;stroke:${stroke}" stroke-width="2" ${dash}/>
    `;
    return `<svg width="420" height="210" viewBox="0 0 420 210" role="img" aria-label="Tanque. El tamaño sigue el volumen y el contorno sigue la temperatura.">
      <text x="24" y="24" style="fill:var(--svg-muted)" font-size="14">Tanque · se mueve con el volumen y con cada grado</text>
      <g transform="translate(210 186)">
        ${tank(w0, h0, "none", "none", "var(--svg-ghost)", 'stroke-dasharray="5 4"')}
        ${tank(w, h, body, lid, "none", "")}
      </g>
    </svg>`;
  }

  function beakerFigure(size, pixels) {
    const mercury = heatColor(pixels, "#d4532c", "#7fafc8");
    const tubeH = 146;
    const tubeW = Math.min(54, 18 + 20 * size);
    const bulbR = Math.min(34, 11 + 16 * size);
    const cx = 178;
    const bulbY = 190;
    const tubeTop = bulbY - bulbR * 0.35 - tubeH;
    const rest = tubeTop + tubeH * 0.78;
    const top = Math.max(tubeTop + 4, Math.min(bulbY - 6, rest - pixels * 0.42));
    const tubeX = cx - tubeW / 2;
    return `<svg width="420" height="220" viewBox="0 0 420 220" role="img" aria-label="Termómetro. El tamaño sigue el volumen y la columna sigue la temperatura.">
      <text x="24" y="24" style="fill:var(--svg-muted)" font-size="14">${pixels >= 0 ? "La columna sube con cada grado" : "La columna baja con cada grado"}</text>
      <rect x="${px(tubeX)}" y="${px(tubeTop)}" width="${px(tubeW)}" height="${px(tubeH)}" rx="${px(tubeW / 2)}" style="fill:var(--svg-glass);stroke:var(--svg-ghost)" stroke-width="2.5"/>
      <circle cx="${cx}" cy="${bulbY}" r="${px(bulbR)}" style="fill:${mercury};stroke:var(--svg-ghost)" stroke-width="2.5"/>
      <rect x="${px(cx - tubeW * 0.28)}" y="${px(top)}" width="${px(tubeW * 0.56)}" height="${px(bulbY - top)}" fill="${mercury}"/>
      <circle cx="${cx}" cy="${bulbY}" r="${px(bulbR * 0.55)}" fill="${mercury}"/>
      <line x1="${px(tubeX - 18)}" y1="${px(rest)}" x2="${px(tubeX + tubeW + 10)}" y2="${px(rest)}" style="stroke:var(--svg-mark)" stroke-dasharray="4 3" stroke-width="1.5"/>
      <text x="${px(tubeX + tubeW + 18)}" y="${px(rest + 4)}" style="fill:var(--svg-stroke)" font-size="13">nivel inicial</text>
    </svg>`;
  }

  document.addEventListener("DOMContentLoaded", init);
  return { init };
})();
