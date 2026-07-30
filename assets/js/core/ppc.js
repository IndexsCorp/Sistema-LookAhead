
// =========================================================
// VARIABLES GLOBALES DEL MÓDULO PPC
// =========================================================
let ppc_fechasSemana = [];
let ppc_actividades = [];
let ppc_programacion = [];
let ppc_catalogoCNC = [];
let ppc_borradores = [];
let ppc_celdaActiva = null;
let modoLecturaPPC = false; // 🟢 NUEVO: Controla si estamos viendo el JSON
let graficoCNC = null;

// =========================================================
// 1. INICIALIZACIÓN (Se llama al cambiar de pestaña)
// =========================================================
async function cargarVistaPPC() {
    // Llenar combo de Base Look-Ahead
    const cmbBase = document.getElementById('cmbVersionPPC');
    cmbBase.innerHTML = '<option value="">Seleccione Versión Base...</option>';
    [...AppState.listaVersionesGlobal].reverse().forEach(v => {
        let fechaLimpia = v.fecha;
        if (fechaLimpia.includes("GMT")) {
            let d = new Date(fechaLimpia);
            if (!isNaN(d)) fechaLimpia = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
        cmbBase.innerHTML += `<option value="${v.numero}">${v.numero} • ${fechaLimpia} (${v.rol})</option>`;
    });

    const cmbSem = document.getElementById('cmbSemanaPPC');
    let semInicio = parseInt(AppState.configProyecto.semanaInicio) || 1;
    cmbSem.innerHTML = `
            <option value="1">Semana ${semInicio}</option>
            <option value="2">Semana ${semInicio + 1}</option>
            <option value="3">Semana ${semInicio + 2}</option>
            <option value="4">Semana ${semInicio + 3}</option>
        `;

    // Configuración de botones de guardado según rol
    if (["SC", "RUBRO", "STAFF"].includes(AppState.rolGlobalReal)) {
        document.getElementById('btnGuardarBorradorPPC').classList.add('hidden');
        document.getElementById('btnRegistrarVersionPPC').classList.add('hidden');
    } else {
        document.getElementById('btnGuardarBorradorPPC').classList.remove('hidden');
        document.getElementById('btnGuardarBorradorPPC').classList.add('flex');
        document.getElementById('btnRegistrarVersionPPC').classList.remove('hidden');
        document.getElementById('btnRegistrarVersionPPC').classList.add('flex');
    }

    if (AppState.rolGlobalReal === "ADMIN") {
        const cmbRolPPC = document.getElementById('cmbRolSimuladoPPC');
        if (cmbRolPPC) {
            cmbRolPPC.classList.remove('hidden');
            cmbRolPPC.addEventListener('change', () => {
                if (!modoLecturaPPC) document.getElementById('btnCargarPPC').click();
            });
        }
    }

    // 🟢 NUEVO: Llenar el Historial de PPC desde la base de datos
    try {
        const res = await API.obtenerListaVersionesPPC(AppState.currentSheetsId);
        if (res.success) {
            const cmbHistorial = document.getElementById('cmbHistorialPPC');
            cmbHistorial.innerHTML = '<option value="EDICION" data-file="">Modo Edición</option>';

            // Las versiones vienen del final hacia el principio (las más nuevas arriba)
            [...res.versiones].reverse().forEach(v => {
                let fechaL = v.fecha;
                if (fechaL.includes("GMT")) {
                    let d = new Date(fechaL);
                    if (!isNaN(d)) fechaL = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                }
                cmbHistorial.innerHTML += `<option value="${v.numero}" data-file="${v.archivoId}">${v.numero} • ${fechaL} (${v.rol}) - ${v.rango}</option>`;
            });
        }
    } catch (e) { console.error("Error cargando historial PPC"); }
}

// =========================================================
// 1.5. EVENTO DE CAMBIO: MODO EDICIÓN VS LECTURA JSON
// =========================================================
document.getElementById('cmbHistorialPPC').addEventListener('change', async (e) => {
    const opcion = e.target.options[e.target.selectedIndex];
    const valor = opcion.value;
    const archivoId = opcion.getAttribute('data-file');

    const btnCargar = document.getElementById('btnCargarPPC');
    const btnGuardar = document.getElementById('btnGuardarBorradorPPC');
    const btnRegistrar = document.getElementById('btnRegistrarVersionPPC');
    const selectoresEdicion = document.querySelectorAll('.selectores-edicion-ppc select');

    if (valor === "EDICION") {
        // VOLVEMOS AL MODO EDICIÓN VIVO
        modoLecturaPPC = false;
        btnCargar.classList.remove('hidden'); btnCargar.classList.add('flex');
        selectoresEdicion.forEach(s => { s.disabled = false; s.classList.remove('opacity-50'); });

        if (!["SC", "RUBRO", "STAFF"].includes(AppState.rolGlobalReal)) {
            btnGuardar.classList.remove('hidden'); btnGuardar.classList.add('flex');
            btnRegistrar.classList.remove('hidden'); btnRegistrar.classList.add('flex');
        }
        document.getElementById('tbodyPPC').innerHTML = '<tr><td colspan="11" class="text-center py-10 text-gray-500 font-semibold">Modo Edición activado. Ajusta los filtros y haz clic en "Cargar Datos".</td></tr>';
        document.getElementById('tfootPPC').classList.add('hidden');
        
        // 🟢 NUEVO: Ocultar el contenedor de CNC al volver a "Modo Edición"
        const contenedorCNC = document.getElementById('contenedorResumenCNC');
        if (contenedorCNC) {
            contenedorCNC.classList.add('hidden');
            contenedorCNC.classList.remove('flex');
        }

    } else {
        // ENTRAMOS EN MODO LECTURA DE JSON
        modoLecturaPPC = true;
        btnCargar.classList.add('hidden'); btnCargar.classList.remove('flex');
        btnGuardar.classList.add('hidden'); btnGuardar.classList.remove('flex');
        btnRegistrar.classList.add('hidden'); btnRegistrar.classList.remove('flex');
        selectoresEdicion.forEach(s => { s.disabled = true; s.classList.add('opacity-50'); });

        document.getElementById('tbodyPPC').innerHTML = '<tr><td colspan="11" class="text-center py-10 text-indigo-500 font-bold animate-pulse">Viajando en el tiempo y descargando JSON...</td></tr>';
        document.getElementById('tfootPPC').classList.add('hidden');

        try {
            const resJSON = await API.leerJSONPPC(archivoId);
            if (resJSON.success) {
                const data = resJSON.data;
                ppc_actividades = data.actividades || [];
                ppc_programacion = data.programacion || [];
                ppc_borradores = data.resultadosPPC || []; 

                // 🟢 NUEVO: CAPTURAR METADATOS PARA EL PDF
                const textoOp = opcion.text; // Ej: "v1.0 • 20/07 (SUPERVISION) - Semana 39"
                let rolGuardado = "DESCONOCIDO";
                let fechaGuardada = "DESCONOCIDA";
                
                // Extraer fecha y rol usando los símbolos de separación
                let matchInfo = textoOp.match(/•\s*(.*?)\s*\((.*?)\)/);
                if (matchInfo) {
                    fechaGuardada = matchInfo[1].trim();
                    rolGuardado = matchInfo[2].trim();
                }

                window.ppc_metaPDF = {
                    semanaEvaluada: data.semanaEvaluada, 
                    baseEvaluada: data.baseEvaluada,
                    rolEvaluado: rolGuardado,
                    fechaReporte: fechaGuardada
                };

                // Reconstruimos las fechas basándonos en la Semana guardada en el JSON
                let numSemana = data.semanaEvaluada.match(/\d+/);
                let idxSemana = numSemana ? parseInt(numSemana[0]) : 1;

                let semInicioObra = parseInt(AppState.configProyecto.semanaInicio) || 1;
                let difSemana = idxSemana - semInicioObra; 

                let dLunes = new Date(AppState.configProyecto.fechaLunesBase + "T00:00:00");
                dLunes.setDate(dLunes.getDate() + (difSemana * 7));

                ppc_fechasSemana = [];
                for (let i = 0; i < 7; i++) {
                    let f = new Date(dLunes);
                    f.setDate(dLunes.getDate() + i);
                    ppc_fechasSemana.push(`${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`);
                }

                let rolPlanBase = "RESIDENTE";
                const vInfo = AppState.listaVersionesGlobal.find(v => v.numero === data.baseEvaluada);
                if (vInfo && vInfo.rol) rolPlanBase = String(vInfo.rol).trim().toUpperCase();

                renderizarTablaPPC("LECTURA_JSON", rolPlanBase);
                renderizarResumenCNC();
            } else { throw new Error(resJSON.message); }
        } catch (e) {
            alert("Error leyendo el archivo histórico: " + e.message);
            document.getElementById('cmbHistorialPPC').value = "EDICION";
            document.getElementById('cmbHistorialPPC').dispatchEvent(new Event('change'));
        }
    }
});

// =========================================================
// 2. CARGA DE DATOS EN MODO EDICIÓN VIVA
// =========================================================
document.getElementById('btnCargarPPC').addEventListener('click', async () => {
    const versionBase = document.getElementById('cmbVersionPPC').value;
    const semanaRelativa = parseInt(document.getElementById('cmbSemanaPPC').value);

    if (!versionBase) return alert("Por favor, selecciona una Versión Base para evaluar.");

    const btnCargar = document.getElementById('btnCargarPPC');
    btnCargar.innerHTML = `⏳ <span class="hidden sm:inline ml-1">Cargando...</span>`;
    btnCargar.disabled = true;

    let dLunes = new Date(AppState.configProyecto.fechaLunesBase + "T00:00:00");
    dLunes.setDate(dLunes.getDate() + ((semanaRelativa - 1) * 7));

    ppc_fechasSemana = [];
    for (let i = 0; i < 7; i++) {
        let f = new Date(dLunes);
        f.setDate(dLunes.getDate() + i);
        ppc_fechasSemana.push(`${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`);
    }

    let rolEvaluar = "RESIDENTE";
    if (AppState.rolGlobalReal === "ADMIN") {
        let cmbRol = document.getElementById('cmbRolSimuladoPPC');
        if (cmbRol) rolEvaluar = cmbRol.value;
    } else if (["STAFF", "SC", "RUBRO"].includes(AppState.rolGlobalReal)) {
        rolEvaluar = "RESIDENTE";
    } else {
        rolEvaluar = AppState.rolGlobalReal;
    }

    const versionInfo = AppState.listaVersionesGlobal.find(v => v.numero === versionBase);
    const rolVersionBase = versionInfo && versionInfo.rol ? String(versionInfo.rol).trim().toUpperCase() : "RESIDENTE";

    try {
        const resLA = await API.obtenerVersionAntigua(AppState.currentSheetsId, versionBase);
        if (!resLA.success) throw new Error(resLA.message);

        ppc_actividades = resLA.actividades.actividades || [];
        ppc_programacion = resLA.actividades.programacion || [];

        let nomSemanaReal = document.getElementById('cmbSemanaPPC').options[document.getElementById('cmbSemanaPPC').selectedIndex].text;

        const resPPC = await API.obtenerDatosPPC(AppState.currentSheetsId, versionBase, nomSemanaReal, rolEvaluar);

        if (resPPC.success) {
            ppc_catalogoCNC = resPPC.catalogoCNC || [];
            ppc_borradores = resPPC.registrosPPC || [];

            const cmbCNC = document.getElementById('cmbListaCNC');
            cmbCNC.innerHTML = '<option value="">Seleccione una causa...</option>';
            ppc_catalogoCNC.forEach(c => {
                cmbCNC.innerHTML += `<option value="${c.id}">${c.id} - ${c.descripcion}</option>`;
            });
        }

        renderizarTablaPPC(rolEvaluar, rolVersionBase);
        renderizarResumenCNC();
    } catch (e) { alert("Error al cargar datos PPC: " + e.message); }
    finally { btnCargar.innerHTML = `🔄 <span class="hidden sm:inline ml-1">Cargar Datos</span>`; btnCargar.disabled = false; }
});

// =========================================================
// 3. RENDERIZADO Y MATEMÁTICA
// =========================================================
function renderizarTablaPPC(rolEvaluar, rolVersionBase) {
    const tbody = document.getElementById('tbodyPPC');
    const tfoot = document.getElementById('tfootPPC');
    const trCabecera = document.getElementById('trCabeceraFechasPPC');

    document.querySelectorAll('.th-fecha-ppc').forEach(th => th.remove());

    const diasNombres = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    let htmlDias = '';
    ppc_fechasSemana.forEach((fStr, index) => {
        htmlDias += `<th class="th-fecha-ppc px-2 py-2 border border-slate-300 font-semibold w-12 sm:w-16">${fStr.substring(0, 5)}<br><span class="font-normal text-gray-500">${diasNombres[index]}</span></th>`;
    });

    const refChild = trCabecera.querySelector('th.bg-blue-100');
    refChild.insertAdjacentHTML('beforebegin', htmlDias);

    tbody.innerHTML = '';
    let sumTotalProg = 0;
    let sumTotalCump = 0;
    let hayDatos = false;

    ppc_actividades.sort((a, b) => String(a.indice).localeCompare(String(b.indice), undefined, { numeric: true }));

    // 🟢 Estética visual dependiendo si estamos en Lectura o Edición
    let cursorVisual = modoLecturaPPC ? 'cursor-not-allowed opacity-95' : 'cursor-pointer transition-colors hover:brightness-95';

    ppc_actividades.forEach(act => {
        if (act.id.startsWith('ENC') || act.tipo === 'ENCABEZADO') {
            tbody.innerHTML += `<tr class="bg-yellow-300/80 font-bold border-b border-slate-400 select-none opacity-90"><td class="px-2 py-1.5 border border-slate-400 text-center text-xs font-black text-yellow-900 sticky left-0 z-10 w-12 sm:w-16">${act.indice}</td><td class="px-3 py-1.5 border border-slate-400 sticky left-[48px] sm:left-[64px] z-10 text-left text-xs">${act.descripcion}</td><td colspan="9" class="border border-slate-400 bg-yellow-100/50"></td></tr>`;
        } else {
            let celdasHTML = '';
            let cuentaProgFila = 0;
            let cuentaCumpFila = 0;

            ppc_fechasSemana.forEach(fStr => {
                let p = ppc_programacion.find(x =>
                    x.idActividad === act.id &&
                    normFecha(x.fecha) === fStr &&
                    String(x.rol || "RESIDENTE").trim().toUpperCase() === rolVersionBase
                );

                if (p && (p.sector || p.color)) {
                    cuentaProgFila++;
                    hayDatos = true;

                    let borrador = ppc_borradores.find(b => b.idActividad === act.id && b.fecha === fStr);

                    if (borrador) {
                        celdasHTML += `<td class="celda-ppc hatch-no-cumplido border border-slate-300 relative font-bold text-[9px] text-center shadow-inner ${cursorVisual}" data-act="${act.id}" data-fecha="${fStr}" data-cnc="${borrador.idCNC}" data-obs="${borrador.observacion || ''}" style="background-color: ${p.color};">${p.sector || ''}</td>`;
                    } else {
                        cuentaCumpFila++;
                        celdasHTML += `<td class="celda-ppc border border-slate-300 relative font-bold text-[9px] text-center shadow-inner ${cursorVisual}" data-act="${act.id}" data-fecha="${fStr}" data-cnc="" data-obs="" style="background-color: ${p.color}; color: ${obtenerColorTextoContraste(p.color)}">${p.sector || ''}</td>`;
                    }
                } else {
                    celdasHTML += `<td class="border border-slate-300 bg-gray-50/50"></td>`;
                }
            });

            if (cuentaProgFila > 0) {
                sumTotalProg += cuentaProgFila;
                sumTotalCump += cuentaCumpFila;
                let colorCump = cuentaCumpFila === cuentaProgFila ? 'text-green-700 bg-green-50' : 'text-orange-600 bg-orange-50';

                tbody.innerHTML += `
                    <tr class="border-b border-slate-200 hover:bg-slate-50 transition-colors bg-white select-none">
                        <td class="px-2 py-2 border border-slate-300 text-center text-xs text-gray-500 font-mono sticky left-0 z-10 w-12 sm:w-16">${act.indice}</td>
                        <td class="px-3 py-2 border border-slate-300 sticky left-[48px] sm:left-[64px] z-10 font-medium text-left truncate text-gray-600">${act.descripcion}</td>
                        ${celdasHTML}
                        <td class="px-2 py-2 border border-slate-300 text-center font-bold text-blue-700 bg-blue-50">${cuentaProgFila}</td>
                        <td class="px-2 py-2 border border-slate-300 text-center font-bold ${colorCump} celda-suma-cump">${cuentaCumpFila}</td>
                    </tr>`;
            }
        }
    });

    if (!hayDatos) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center py-10 text-gray-500 font-semibold">No hay sectores programados para la semana seleccionada en esta versión.</td></tr>`;
        tfoot.classList.add('hidden');
    } else {
        tfoot.classList.remove('hidden');
        document.querySelectorAll('.tfoot-spacer').forEach(e => e.remove());
        const tdEspacio = `<td colspan="7" class="tfoot-spacer border-t border-slate-600 bg-slate-800"></td>`;
        document.getElementById('lblTotalProg').insertAdjacentHTML('beforebegin', tdEspacio);
        document.getElementById('lblPorcentajePPC').insertAdjacentHTML('beforebegin', `<td colspan="7" class="tfoot-spacer border-t border-slate-600 bg-slate-900"></td>`);
        actualizarTotalesUI(sumTotalProg, sumTotalCump);
    }

    inicializarClicsPPC();
}

function actualizarTotalesUI(prog, cump) {
    document.getElementById('lblTotalProg').innerText = prog;
    document.getElementById('lblTotalCump').innerText = cump;

    // Calculamos el valor real y el texto con 2 decimales
    let pctNum = prog > 0 ? (cump / prog) * 100 : 0;
    let pctStr = prog > 0 ? pctNum.toFixed(2) : "0.00";

    let lblPct = document.getElementById('lblPorcentajePPC');
    lblPct.innerText = pctStr + "%";

    // Evaluamos el color basándonos en el valor numérico
    if (pctNum >= 85) lblPct.className = "px-2 py-2 text-center bg-slate-900 text-green-400 border-l border-slate-600 text-lg font-black";
    else if (pctNum >= 70) lblPct.className = "px-2 py-2 text-center bg-slate-900 text-yellow-400 border-l border-slate-600 text-lg font-black";
    else lblPct.className = "px-2 py-2 text-center bg-slate-900 text-red-500 border-l border-slate-600 text-lg font-black";
}

function renderizarResumenCNC() {
    const contenedorResumen = document.getElementById('contenedorResumenCNC');
    const areaDatos = document.getElementById('areaDatosCNC');
    const estadoVacio = document.getElementById('estadoVacioCNC');
    const tbodyDetalle = document.getElementById('tbodyDetalleCNC');

    if (!contenedorResumen) return;

    // 1. Mostrar el contenedor general si hay datos en la tabla (o si ppc_actividades tiene datos)
    if (!ppc_actividades || ppc_actividades.length === 0) {
        contenedorResumen.classList.add('hidden');
        return;
    }
    contenedorResumen.classList.remove('hidden');
    contenedorResumen.classList.add('flex'); // Add flex as it's flex-col

    // 2. Validar estado vacío de borradores
    if (!ppc_borradores || ppc_borradores.length === 0) {
        areaDatos.classList.add('hidden');
        estadoVacio.classList.remove('hidden');
        estadoVacio.classList.add('flex');
        return;
    } else {
        areaDatos.classList.remove('hidden');
        estadoVacio.classList.add('hidden');
        estadoVacio.classList.remove('flex');
    }

    // 3. Procesar datos (Agrupación)
    const gruposCNC = {};

    ppc_borradores.forEach(borrador => {
        // Encontrar descripción CNC y armar el título completo
        const idCausa = borrador.idCNC;
        const cnc = ppc_catalogoCNC.find(c => c.id === idCausa);
        const nombreCausa = cnc ? cnc.descripcion : "CAUSA NO DEFINIDA";
        const descCNC = `${idCausa} - ${nombreCausa}`;

        // Encontrar Actividad
        const act = ppc_actividades.find(a => a.id === borrador.idActividad);
        const descActividad = act ? `[${act.indice}] ${act.descripcion}` : "Actividad desconocida";

        // Obtener sector cruzando con programacion
        let sector = "";
        if (ppc_programacion && typeof normFecha === 'function') {
            const prog = ppc_programacion.find(p => p.idActividad === borrador.idActividad && normFecha(p.fecha) === borrador.fecha);
            if (prog) sector = prog.sector;
        }

        // Día formateado
        let diaNombre = "";
        let diaIdx = ppc_fechasSemana.indexOf(borrador.fecha);
        if (diaIdx !== -1) {
            const diasCortos = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
            diaNombre = diasCortos[diaIdx] + " " + borrador.fecha.substring(0, 2);
        } else {
            diaNombre = borrador.fecha;
        }

        const diaSector = sector ? `${diaNombre}<br><span class="font-bold">${sector}</span>` : diaNombre;

        if (!gruposCNC[descCNC]) {
            gruposCNC[descCNC] = {
                idCNC: borrador.idCNC,
                nombre: descCNC,
                incidencias: []
            };
        }

        gruposCNC[descCNC].incidencias.push({
            actividad: descActividad,
            diaSector: diaSector,
            observacion: borrador.observacion || ""
        });
    });

    // 4. Inyectar Tabla
    tbodyDetalle.innerHTML = '';
    const labelsGrafico = [];
    const datosGrafico = [];
    const coloresFondo = [];

    // Paleta de colores para Chart.js
    const paleta = ['#3b82f6', '#eab308', '#a855f7', '#ef4444', '#22c55e', '#f97316', '#64748b', '#ec4899', '#14b8a6'];
    let colorIndex = 0;

    Object.values(gruposCNC).forEach(grupo => {
        labelsGrafico.push(grupo.nombre);
        datosGrafico.push(grupo.incidencias.length);
        coloresFondo.push(paleta[colorIndex % paleta.length]);
        colorIndex++;

        // Fila cabecera del grupo
        tbodyDetalle.innerHTML += `
                <tr class="bg-gray-50 border-b border-gray-200">
                    <td colspan="3" class="px-4 py-2 font-bold text-gray-700 uppercase">
                        <span class="mr-1">📦</span> ${grupo.nombre} 
                        <span class="ml-2 bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full">${grupo.incidencias.length} incidencias</span>
                    </td>
                </tr>
            `;

        grupo.incidencias.forEach(inc => {
            const obsHTML = inc.observacion ? `"${inc.observacion}"` : `<span class="text-gray-400">Sin observación</span>`;
            tbodyDetalle.innerHTML += `
                    <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td class="px-4 py-2 text-gray-600 font-medium">${inc.actividad}</td>
                        <td class="px-4 py-2 text-center text-gray-500">${inc.diaSector}</td>
                        <td class="px-4 py-2 text-gray-500 italic">${obsHTML}</td>
                    </tr>
                `;
        });
    });

    // 5. Dibujar Gráfico
    if (graficoCNC !== null) {
        graficoCNC.destroy();
    }

    const canvas = document.getElementById('cncChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Ensure ChartDataLabels is registered if available globally
    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }

    graficoCNC = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labelsGrafico,
            datasets: [{
                data: datosGrafico,
                backgroundColor: coloresFondo,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { size: 10 }
                    }
                },
                datalabels: {
                    color: '#ffffff',
                    font: { weight: 'bold', size: 12 },
                    formatter: (value) => {
                        return value;
                    }
                }
            }
        }
    });
}

// =========================================================
// 4. INTERACCIÓN DE ACHURADO (TOGGLE Y MODAL)

// =========================================================
function inicializarClicsPPC() {
    if (modoLecturaPPC) return; // 🟢 CANDADO: Si es el JSON Histórico, no se puede hacer clic en nada.

    const celdas = document.querySelectorAll('.celda-ppc');
    celdas.forEach(c => {
        c.addEventListener('click', function () {
            if (!AppState.puedeEditarEstructura) return;

            if (this.classList.contains('hatch-no-cumplido')) {
                this.classList.remove('hatch-no-cumplido');
                this.setAttribute('data-cnc', '');
                this.setAttribute('data-obs', '');
                this.style.color = obtenerColorTextoContraste(this.style.backgroundColor);
                recalcularTotales();
            } else {
                ppc_celdaActiva = this;
                document.getElementById('cmbListaCNC').value = this.getAttribute('data-cnc') || "";
                document.getElementById('txtObservacionCNC').value = this.getAttribute('data-obs') || "";
                document.getElementById('modalCNC').classList.remove('hidden');
            }
        });
    });
}

document.getElementById('btnConfirmarCNC').addEventListener('click', () => {
    const cncValue = document.getElementById('cmbListaCNC').value;
    const obsValue = document.getElementById('txtObservacionCNC').value.trim();

    if (!cncValue) return alert("Debes seleccionar una causa.");

    if (ppc_celdaActiva) {
        ppc_celdaActiva.classList.add('hatch-no-cumplido');
        ppc_celdaActiva.setAttribute('data-cnc', cncValue);
        ppc_celdaActiva.setAttribute('data-obs', obsValue);
        recalcularTotales();
    }

    document.getElementById('modalCNC').classList.add('hidden');
    ppc_celdaActiva = null;
});

function recalcularTotales() {
    let sumProg = 0;
    let sumCump = 0;

    const filas = document.querySelectorAll('#tbodyPPC tr');
    filas.forEach(fila => {
        const celdasProg = fila.querySelectorAll('.celda-ppc');
        if (celdasProg.length > 0) {
            let progFila = celdasProg.length;
            let noCumpFila = fila.querySelectorAll('.hatch-no-cumplido').length;
            let cumpFila = progFila - noCumpFila;

            fila.querySelector('.celda-suma-cump').innerText = cumpFila;

            if (cumpFila === progFila) fila.querySelector('.celda-suma-cump').className = "px-2 py-2 border border-slate-300 text-center font-bold text-green-700 bg-green-50 celda-suma-cump";
            else fila.querySelector('.celda-suma-cump').className = "px-2 py-2 border border-slate-300 text-center font-bold text-orange-600 bg-orange-50 celda-suma-cump";

            sumProg += progFila;
            sumCump += cumpFila;
        }
    });

    actualizarTotalesUI(sumProg, sumCump);
}

// =========================================================
// 5. GUARDAR BORRADOR EN BASE DE DATOS
// =========================================================
document.getElementById('btnGuardarBorradorPPC').addEventListener('click', async () => {
    const btn = document.getElementById('btnGuardarBorradorPPC');
    const versionBase = document.getElementById('cmbVersionPPC').value;
    const nomSemanaReal = document.getElementById('cmbSemanaPPC').options[document.getElementById('cmbSemanaPPC').selectedIndex].text;

    if (!versionBase) return alert("Carga una versión primero.");

    let rolGuardar = "RESIDENTE";
    if (AppState.rolGlobalReal === "ADMIN") {
        let cmbRol = document.getElementById('cmbRolSimuladoPPC');
        if (cmbRol) rolGuardar = cmbRol.value;
    } else {
        rolGuardar = AppState.rolGlobalReal;
    }

    let datosGuardar = [];
    document.querySelectorAll('.hatch-no-cumplido').forEach(celda => {
        datosGuardar.push({
            idActividad: celda.getAttribute('data-act'),
            fecha: celda.getAttribute('data-fecha'),
            idCNC: celda.getAttribute('data-cnc'),
            observacion: celda.getAttribute('data-obs') || ""
        });
    });

    btn.innerHTML = `⏳ <span class="hidden sm:inline ml-1">Guardando...</span>`;
    btn.disabled = true;

    try {
        const res = await API.guardarBorradorPPC(AppState.currentSheetsId, versionBase, nomSemanaReal, rolGuardar, datosGuardar);
        if (res.success) {
            btn.innerHTML = `✅ <span class="hidden sm:inline ml-1">¡Guardado!</span>`;

            ppc_borradores = [...datosGuardar];
            renderizarResumenCNC();

            setTimeout(() => {
                btn.innerHTML = `💾 <span class="hidden sm:inline ml-1">Guardar Borrador</span>`;
                btn.disabled = false;
            }, 2000);
        } else {
            throw new Error(res.message);
        }
    } catch (e) {
        alert("Error al guardar: " + e.message);
        btn.innerHTML = `💾 <span class="hidden sm:inline ml-1">Guardar Borrador</span>`;
        btn.disabled = false;
    }
});

// =========================================================
// 6. REGISTRAR VERSIÓN DEFINITIVA (JSON)
// =========================================================
document.getElementById('btnRegistrarVersionPPC').addEventListener('click', () => {
    const versionBase = document.getElementById('cmbVersionPPC').value;
    if (!versionBase) return alert("Carga una versión primero.");

    document.getElementById('txtComentarioVersionPPC').value = "";
    document.getElementById('modalVersionPPC').classList.remove('hidden');
});

document.getElementById('btnGuardarVersionPPC').addEventListener('click', async () => {
    const comentario = document.getElementById('txtComentarioVersionPPC').value.trim();
    if (!comentario) return alert("Por favor ingresa un comentario.");

    const btn = document.getElementById('btnGuardarVersionPPC');
    btn.innerText = "Guardando..."; btn.disabled = true;

    const sessionData = JSON.parse(sessionStorage.getItem('usuarioActivo'));
    const idUsuario = sessionData ? sessionData.idUsuario : "DESC";

    const versionBase = document.getElementById('cmbVersionPPC').value;
    const nomSemanaReal = document.getElementById('cmbSemanaPPC').options[document.getElementById('cmbSemanaPPC').selectedIndex].text;

    let rolUsuario = "RESIDENTE";
    if (AppState.rolGlobalReal === "ADMIN") {
        let cmb = document.getElementById('cmbRolSimuladoPPC');
        if (cmb) rolUsuario = cmb.value;
    } else {
        rolUsuario = AppState.rolGlobalReal;
    }

    const sessionProy = JSON.parse(sessionStorage.getItem('proyectoActivo'));
    const jsonFolderIdPPC = sessionProy ? sessionProy.jsonFolderPPC : "";

    try {
        document.getElementById('btnGuardarBorradorPPC').click();

        setTimeout(async () => {
            const res = await API.guardarVersionPPC(AppState.currentSheetsId, comentario, idUsuario, nomSemanaReal, rolUsuario, versionBase, jsonFolderIdPPC);
            if (res.success) {
                document.getElementById('modalVersionPPC').classList.add('hidden');
                alert(`¡Versión ${res.nuevaVersion} del PPC registrada con éxito!`);

                // RECARGAR EL COMBO DE HISTORIAL
                cargarVistaPPC();
            } else {
                alert("Error al guardar versión: " + res.message);
            }
            btn.innerText = "Confirmar y Guardar";
            btn.disabled = false;
        }, 1500);

    } catch (e) {
        console.error(e);
        alert("Error de red al guardar la versión.");
        btn.innerText = "Confirmar y Guardar";
        btn.disabled = false;
    }
});

// =========================================================
// 7. EXPORTAR REPORTE A PDF (VÍA PESTAÑA NUEVA NATIVA)
// =========================================================
document.getElementById('btnExportarPDFPPC').addEventListener('click', () => {
    // 1. VALIDACIÓN
    if (ppc_actividades.length === 0) {
        alert("⚠️ Por favor, haz clic en 'Cargar Look' o selecciona una versión del historial antes de exportar.");
        return;
    }

    const btn = document.getElementById('btnExportarPDFPPC');
    const originalText = btn.innerHTML;
    btn.innerHTML = `⏳ <span class="hidden sm:inline ml-1">Abriendo...</span>`;
    btn.disabled = true;

    // 2. RECOLECTAR DATOS (INTELIGENCIA MODO LECTURA VS EDICIÓN)
    const nombreProyecto = document.getElementById('lblNombreProyecto').innerText;
    
    let semanaNombre, versionBase, rolEvaluado, fechaReporte;

    // Si estamos viendo el pasado, tomamos la memoria congelada
    if (modoLecturaPPC && window.ppc_metaPDF) {
        semanaNombre = window.ppc_metaPDF.semanaEvaluada;
        versionBase = window.ppc_metaPDF.baseEvaluada;
        rolEvaluado = window.ppc_metaPDF.rolEvaluado;
        fechaReporte = window.ppc_metaPDF.fechaReporte;
    } else {
        // Si estamos editando hoy, tomamos los valores en vivo
        const semanaSel = document.getElementById('cmbSemanaPPC');
        semanaNombre = semanaSel.options[semanaSel.selectedIndex].text;
        versionBase = document.getElementById('cmbVersionPPC').value || "Actual";
        
        rolEvaluado = AppState.rolGlobalReal;
        if (AppState.rolGlobalReal === "ADMIN") {
            const cmbRol = document.getElementById('cmbRolSimuladoPPC');
            if (cmbRol) rolEvaluado = cmbRol.value;
        }

        const d = new Date();
        fechaReporte = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    const versionInfo = AppState.listaVersionesGlobal.find(v => v.numero === versionBase);
    const rolVersionBase = versionInfo && versionInfo.rol ? String(versionInfo.rol).trim().toUpperCase() : "RESIDENTE";

    // 3. CONSTRUIR CABECERA DE DÍAS (TH)
    const diasNombres = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    let htmlCabeceraDias = '';
    ppc_fechasSemana.forEach((f, i) => {
        htmlCabeceraDias += `<th style="width: 7%; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155; padding: 8px 4px; font-size: 10px;">${f.substring(0, 5)}<br><span style="font-weight: normal; font-size: 9px;">${diasNombres[i]}</span></th>`;
    });

    // 4. CONSTRUIR LAS FILAS DE LA TABLA (TR)
    let htmlFilasActividades = '';
    let sumProg = 0;
    let sumCump = 0;

    ppc_actividades.forEach(act => {
        if (act.id.startsWith('ENC') || act.tipo === 'ENCABEZADO') {
            htmlFilasActividades += `
                <tr class="evitar-quiebre" style="background-color: #fef08a; color: #854d0e; font-weight: 900; font-size: 11px;">
                    <td style="width: 5%; border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center;">${act.indice}</td>
                    <td colspan="10" style="border: 1px solid #cbd5e1; text-align: left; padding-left: 8px;">${act.descripcion}</td>
                </tr>`;
        } else {
            let celdasHTML = '';
            let progFila = 0;
            let cumpFila = 0;

            ppc_fechasSemana.forEach(fStr => {
                let p = ppc_programacion.find(x => x.idActividad === act.id && normFecha(x.fecha) === fStr && String(x.rol || "RESIDENTE").trim().toUpperCase() === rolVersionBase);

                if (p && (p.sector || p.color)) {
                    progFila++;
                    let borrador = ppc_borradores.find(b => b.idActividad === act.id && b.fecha === fStr);
                    if (borrador) {
                        celdasHTML += `<td style="border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; color: #000; font-weight: bold; border: 2px solid #ef4444 !important; background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.6), rgba(255,255,255,0.6) 4px, transparent 4px, transparent 8px); background-color: ${p.color};">${p.sector || ''}</td>`;
                    } else {
                        cumpFila++;
                        celdasHTML += `<td style="border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; color: white; font-weight: bold; background-color: ${p.color};">${p.sector || ''}</td>`;
                    }
                } else {
                    celdasHTML += `<td style="border: 1px solid #cbd5e1; background-color: #f8fafc;"></td>`;
                }
            });

            if (progFila > 0) {
                sumProg += progFila;
                sumCump += cumpFila;
                let estiloFallo = cumpFila === progFila ? 'color: #15803d; background-color: #f0fdf4;' : 'color: #ea580c; background-color: #fff7ed;';

                htmlFilasActividades += `
                    <tr class="evitar-quiebre">
                        <td style="width: 5%; border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; font-weight: bold; color: #64748b;">${act.indice}</td>
                        <td style="width: 35%; border: 1px solid #cbd5e1; padding: 6px 4px; text-align: left; padding-left: 8px; font-weight: bold; color: #1e293b;">${act.descripcion}</td>
                        ${celdasHTML}
                        <td style="width: 5.5%; border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; font-weight: bold; color: #1d4ed8; background-color: #eff6ff;">${progFila}</td>
                        <td style="width: 5.5%; border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; font-weight: bold; ${estiloFallo}">${cumpFila}</td>
                    </tr>`;
            }
        }
    });

    // 5. CONSTRUIR DATOS DEL CNC Y GRÁFICO
    let htmlDetalleCNC = '';
    let labelsGrafico = [];
    let datosGrafico = [];
    let gruposCNC = {};

    ppc_borradores.forEach(borrador => {
        const idCausa = borrador.idCNC;
        const cnc = ppc_catalogoCNC.find(c => c.id === idCausa);
        const descCNC = `${idCausa} - ${cnc ? cnc.descripcion : "CAUSA NO DEFINIDA"}`;
        const act = ppc_actividades.find(a => a.id === borrador.idActividad);
        const descActividad = act ? `[${act.indice}] ${act.descripcion}` : "Actividad desconocida";

        let sector = "";
        const prog = ppc_programacion.find(p => p.idActividad === borrador.idActividad && normFecha(p.fecha) === borrador.fecha);
        if (prog) sector = prog.sector;

        let diaIdx = ppc_fechasSemana.indexOf(borrador.fecha);
        let diaNombre = diaIdx !== -1 ? `${diasNombres[diaIdx]} ${borrador.fecha.substring(0, 2)}` : borrador.fecha;

        if (!gruposCNC[descCNC]) gruposCNC[descCNC] = { nombre: descCNC, incidencias: [] };
        gruposCNC[descCNC].incidencias.push({ actividad: descActividad, diaSector: `${diaNombre}<br><b>${sector}</b>`, observacion: borrador.observacion || "Sin observación" });
    });

    Object.values(gruposCNC).forEach(grupo => {
        labelsGrafico.push(grupo.nombre);
        datosGrafico.push(grupo.incidencias.length);

        htmlDetalleCNC += `
            <tr class="evitar-quiebre">
                <td colspan="3" style="background-color: #f8fafc; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-size: 11px; padding: 8px;">
                    📦 ${grupo.nombre} <span style="background-color: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 12px; font-size: 9px; margin-left: 10px;">${grupo.incidencias.length} Incidencia(s)</span>
                </td>
            </tr>`;

        grupo.incidencias.forEach(inc => {
            htmlDetalleCNC += `
                <tr class="evitar-quiebre">
                    <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #475569;">${inc.actividad}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: center;">${inc.diaSector}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; font-style: italic; color: #64748b;">"${inc.observacion}"</td>
                </tr>`;
        });
    });

    let pctNum = sumProg > 0 ? ((sumCump / sumProg) * 100).toFixed(2) : "0.00";
    let mostrarCNC = sumProg === sumCump ? 'display: none;' : 'display: block;';

    // 6. INYECTAR TODO EN LA PLANTILLA HTML
    const htmlPlantilla = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Reporte PPC - ${semanaNombre} (${fechaReporte})</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0"><\/script>
        <style>
            @page { size: A4 landscape; margin: 10mm 15mm 15mm 15mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: white; color: #333; font-size: 11px; }
            .evitar-quiebre { page-break-inside: avoid; break-inside: avoid; }
        </style>
    </head>
    <body>
        <div style="display: flex; border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; align-items: flex-end;">
            <div style="flex-grow: 1;">
                <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; color: #0f172a; letter-spacing: 1px;">Reporte Semanal PPC</h1>
                <h2 style="margin: 5px 0 0 0; font-size: 14px; color: #2563eb;">Proyecto: ${nombreProyecto}</h2>
            </div>
            <div style="text-align: right; font-size: 11px; line-height: 1.5; color: #64748b;">
                <p style="margin:2px 0;"><span style="font-weight: bold; color: #0f172a;">Fecha de Reporte:</span> ${fechaReporte}</p>
                <p style="margin:2px 0;"><span style="font-weight: bold; color: #0f172a;">Semana Evaluada:</span> ${semanaNombre}</p>
                <p style="margin:2px 0;"><span style="font-weight: bold; color: #0f172a;">Versión Base:</span> ${versionBase}</p>
                <p style="margin:2px 0;"><span style="font-weight: bold; color: #0f172a;">Rol Evaluado:</span> ${rolEvaluado}</p>
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; text-align: center;">
            <thead style="display: table-header-group;">
                <tr>
                    <th style="width: 5%; background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 4px; font-size: 10px; font-weight: bold;">ÍNDICE</th>
                    <th style="width: 35%; background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 4px; font-size: 10px; font-weight: bold; text-align:left; padding-left:8px;">DESCRIPCIÓN DE LA ACTIVIDAD</th>
                    ${htmlCabeceraDias}
                    <th style="width: 5.5%; background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 4px; font-size: 10px; font-weight: bold;">PROG.</th>
                    <th style="width: 5.5%; background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 4px; font-size: 10px; font-weight: bold;">CUMP.</th>
                </tr>
            </thead>
            <tbody>
                ${htmlFilasActividades || '<tr><td colspan="11" style="border: 1px solid #cbd5e1; padding: 20px;">No hay datos en esta evaluación</td></tr>'}
            </tbody>
        </table>

        <div class="evitar-quiebre" style="display: flex; flex-direction: column; border: 2px solid #0f172a; margin-bottom: 25px;">
            <div style="display: flex; background-color: #1e293b; color: white;">
                <div style="flex-grow: 1; text-align: right; padding: 8px 15px; font-size: 11px; font-weight: bold; text-transform: uppercase; border-right: 1px solid #334155;">Totales Generales:</div>
                <div style="width: 5.5%; text-align: center; padding: 8px 2px; font-weight: bold; font-size: 12px; color: #93c5fd; border-right: 1px solid #334155;">${sumProg}</div>
                <div style="width: 5.5%; text-align: center; padding: 8px 2px; font-weight: bold; font-size: 12px; color: #4ade80;">${sumCump}</div>
            </div>
            <div style="display: flex; background-color: #0f172a; color: #facc15; border-top: 1px solid #334155;">
                <div style="flex-grow: 1; text-align: right; padding: 8px 15px; font-size: 11px; font-weight: bold; text-transform: uppercase; border-right: 1px solid #334155;">Indicador PPC (%):</div>
                <div style="width: 11%; text-align: center; padding: 8px 2px; font-weight: 900; font-size: 14px;">${pctNum}%</div>
            </div>
        </div>

        <div class="evitar-quiebre" style="${mostrarCNC} border-top: 3px solid #cbd5e1; padding-top: 15px;">
            <h3 style="font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0 0 15px 0;">📊 Análisis de Causas de No Cumplimiento (CNC)</h3>
            <div style="display: flex; gap: 20px; align-items: stretch;">
                <div style="width: 35%; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; text-align: center;">
                    <h3 style="margin: 0 0 10px 0; font-size: 11px; color: #64748b; text-transform: uppercase;">Distribución de Causas</h3>
                    <div style="position: relative; height: 200px; width: 100%; display: flex; justify-content: center;">
                        <canvas id="pdfChart"></canvas>
                    </div>
                </div>
                <table style="width: 65%; border-collapse: collapse; align-self: flex-start; font-size:10px;">
                    <thead>
                        <tr>
                            <th style="background-color: #e2e8f0; color: #475569; padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1; width: 45%;">Actividad Afectada</th>
                            <th style="background-color: #e2e8f0; color: #475569; padding: 8px; text-align: center; border-bottom: 2px solid #cbd5e1; width: 20%;">Día / Sector</th>
                            <th style="background-color: #e2e8f0; color: #475569; padding: 8px; text-align: left; border-bottom: 2px solid #cbd5e1; width: 35%;">Observación de Campo</th>
                        </tr>
                    </thead>
                    <tbody>${htmlDetalleCNC}</tbody>
                </table>
            </div>
        </div>
        
        <script>
            window.onload = function() {
                const labels = ${JSON.stringify(labelsGrafico)};
                const data = ${JSON.stringify(datosGrafico)};
                const ctx = document.getElementById('pdfChart');
                
                if (ctx && data.length > 0) {
                    Chart.register(ChartDataLabels);
                    new Chart(ctx.getContext('2d'), {
                        type: 'doughnut',
                        data: {
                            labels: labels,
                            datasets: [{
                                data: data,
                                backgroundColor: ['#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#22c55e', '#f97316', '#64748b'],
                                borderWidth: 2, borderColor: '#ffffff'
                            }]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false, cutout: '55%', animation: false,
                            plugins: {
                                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                                datalabels: { color: '#ffffff', font: { weight: 'bold', size: 12 }, formatter: (v) => v }
                            }
                        }
                    });
                }
                setTimeout(() => { window.print(); }, 800);
            };
        <\/script>
    </body>
    </html>`;

    // 7. ABRIR PESTAÑA NUEVA E INYECTAR
    const ventanaPDF = window.open('', '_blank');
    ventanaPDF.document.write(htmlPlantilla);
    ventanaPDF.document.close(); 

    btn.innerHTML = originalText;
    btn.disabled = false;
});