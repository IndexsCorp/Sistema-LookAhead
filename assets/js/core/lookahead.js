



    function obtenerColorTextoContraste(bgColor) {
        if (!bgColor) return '#ffffff';
        let r, g, b;
        if (bgColor.startsWith('rgb')) {
            let values = bgColor.match(/\d+/g);
            if (!values || values.length < 3) return '#ffffff';
            r = parseInt(values[0]); g = parseInt(values[1]); b = parseInt(values[2]);
        } else if (bgColor.startsWith('#')) {
            let hex = bgColor.replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            if (hex.length !== 6) return '#ffffff';
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else {
            return '#ffffff';
        }
        let yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#1e293b' : '#ffffff';
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.getElementById('cmbRolSimulado').addEventListener('change', () => {
            if (document.getElementById('cmbHistorialVersiones').value === "ACTUAL") guardarProgramacionTemporal();
            renderizarAmbasTablas();
        });
        document.getElementById('btnToggleComparativo').addEventListener('click', toggleModoComparativo);
    });

    // ---------------------------------------------------------
    // 1. CARGA INICIAL Y PERMISOS
    // ---------------------------------------------------------
    async function cargarLookAhead(sheetsId) {
        AppState.currentSheetsId = sheetsId;
        const tbody = document.getElementById('tbodyLookAhead');
        document.getElementById('btnGuardarOrden').classList.add('hidden');
        document.getElementById('btnGuardarOrden').classList.remove('flex');

        tbody.innerHTML = '<tr><td colspan="12" class="text-center py-10 text-slate-500 font-semibold animate-pulse">Consultando base de datos del proyecto...</td></tr>';

        try {
            const respuesta = await API.obtenerDatosLookAhead(sheetsId);
            if (respuesta.success) {
                AppState.memoriaCache = respuesta.actividades.map(act => ({ ...act, estado: 'ACTIVO' }));
                AppState.memoriaProgramacion = respuesta.programacion || [];
                AppState.configProyecto = respuesta.configuracion || { fechaLunesBase: null, semanaInicio: 1 };

                await inicializarMotorTiempo();

                const sessionData = JSON.parse(sessionStorage.getItem('usuarioActivo'));
                if (sessionData) AppState.rolGlobalReal = sessionData.rol;

                // 🟢 ASIGNACIÓN ESTRICTA DE PERMISOS
                AppState.puedeEditarSectores = !["STAFF", "SC", "RUBRO"].includes(AppState.rolGlobalReal);
                AppState.puedeEditarEstructura = !["SC", "RUBRO"].includes(AppState.rolGlobalReal);

                // Solo el ADMIN puede cambiar de rol simulado
                if (AppState.rolGlobalReal === "ADMIN") {
                    document.getElementById('cmbRolSimulado').classList.remove('hidden');
                }

                aplicarPermisosUI();
                inicializarSelectorMultiples();

                AppState.listaVersionesGlobal = respuesta.versions || respuesta.versiones || [];
                llenarDropdownsVersiones();

                // 🟢 AQUÍ EJECUTAMOS LA NOTA: 
                // Llenamos el combobox con los contratistas antes de pintar la tabla
                actualizarOpcionesFiltroSC();

                renderizarAmbasTablas();

            } else {
                tbody.innerHTML = `<tr><td colspan="12" class="text-center py-10 text-red-500 font-semibold">Error: ${respuesta.message}</td></tr>`;
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="12" class="text-center py-10 text-red-500 font-semibold">Error de conexión.</td></tr>';
        }
    }

    function aplicarPermisosUI() {
        const btnComparar = document.getElementById('btnToggleComparativo');
        const btnConfig = document.getElementById('btnConfigurarSemanas') || document.querySelector('button[onclick*="abrirModalConfigSemanas"]');
        const btnRegVer = document.getElementById('btnRegistrarVersion');
        const btnAddEnc = document.getElementById('btnAbrirEncabezado') || document.querySelector('button[onclick*="modalEncabezado"]');
        const btnAddAct = document.getElementById('btnAbrirActividad') || document.querySelector('button[onclick*="modalActividad"]');

        if (["SC", "RUBRO"].includes(AppState.rolGlobalReal)) {
            if (btnComparar) btnComparar.style.display = 'none';
            if (btnConfig) btnConfig.style.display = 'none';
            if (btnRegVer) btnRegVer.style.display = 'none';
            if (btnAddEnc) btnAddEnc.style.display = 'none';
            if (btnAddAct) btnAddAct.style.display = 'none';
        } else if (AppState.rolGlobalReal === "STAFF") {
            if (btnConfig) btnConfig.style.display = 'none';
            if (btnRegVer) btnRegVer.style.display = 'none';
        }
    }

    // ---------------------------------------------------------
    // 1.5 MEMORIA FOTOGRÁFICA
    // ---------------------------------------------------------
    function guardarProgramacionTemporal() {
        if (!AppState.puedeEditarSectores) return; // 🟢 Bloqueo extra por seguridad
        const celdas = document.querySelectorAll('.celda-prog');
        if (celdas.length === 0) return;

        let rolActivo = AppState.rolRenderizadoActual;
        if (rolActivo === "COMPARATIVO") return;

        let fechasEnPantalla = [];
        celdas.forEach(c => {
            let f = c.getAttribute('data-fecha');
            if (f && !fechasEnPantalla.includes(f)) fechasEnPantalla.push(f);
        });

        let nuevaMemoria = AppState.memoriaProgramacion.filter(p => {
            let esDeEstaSemana = fechasEnPantalla.includes(p.fecha);
            let esDeEsteRol = String(p.rol).trim().toUpperCase() === String(rolActivo).trim().toUpperCase();
            return !(esDeEstaSemana && esDeEsteRol);
        });

        celdas.forEach(celda => {
            const actId = celda.getAttribute('data-act');
            const fecha = celda.getAttribute('data-fecha');
            const sector = celda.innerText.trim() || celda.textContent.trim();
            const color = celda.style.backgroundColor;

            if (actId && fecha && (sector !== '' || (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent'))) {
                nuevaMemoria.push({
                    idActividad: actId,
                    fecha: fecha,
                    sector: sector,
                    color: color,
                    rol: rolActivo
                });
            }
        });

        AppState.memoriaProgramacion = nuevaMemoria;
    }

    // =========================================================
    // LÓGICA DEL FILTRO VISUAL: SC / RUBRO
    // =========================================================
    function actualizarOpcionesFiltroSC() {
        const cmb = document.getElementById('cmbFiltroSCLook');
        if (!cmb) return;
        
        let valorActual = cmb.value;
        let setSC = new Set();
        
        // Extraer todos los SC / Rubros únicos de la memoria viva
        AppState.memoriaCache.forEach(a => {
            if (a.estado !== 'ELIMINADO' && a.scRubro && a.scRubro.trim() !== '') {
                setSC.add(a.scRubro.trim().toUpperCase());
            }
        });
        
        let html = '<option value="">Filtros (Todos)</option>';
        [...setSC].sort().forEach(sc => {
            html += `<option value="${sc}">${sc}</option>`;
        });
        
        cmb.innerHTML = html;
        if ([...setSC].includes(valorActual)) cmb.value = valorActual;
    }

    // Evento que repinta la tabla cuando el usuario elige un filtro
    document.getElementById('cmbFiltroSCLook').addEventListener('change', () => {
        renderizarAmbasTablas();
    });
    
    
    // =========================================================
    // 2. RENDERIZADO UNIFICADO Y CONTROL DE VERSIONES
    // =========================================================

    function llenarDropdownsVersiones() {
        const cmb1 = document.getElementById('cmbHistorialVersiones');
        const cmb2 = document.getElementById('cmbHistorialVersiones2');

        let semInicio = parseInt(AppState.configProyecto.semanaInicio) || 1;
        let rangoActual = `Sem ${semInicio}-${semInicio + 3}`;

        // Combo Principal (Izquierda)
        let htmlOpciones1 = `<option value="ACTUAL" data-rango="${rangoActual}">${rangoActual} - Versión Actual (En Edición)</option>`;
        
        // Combo Comparativo (Derecha) - 🟢 RESTRINGIDO POR ROL
        let htmlOpciones2 = '';
        
        if (AppState.rolGlobalReal === "ADMIN") {
            // Admin ve el "En vivo" de ambos
            htmlOpciones2 += `<option value="ACTUAL_RESIDENTE" data-rango="${rangoActual}" class="font-bold text-blue-700">Versión Actual (RESIDENTE)</option>`;
            htmlOpciones2 += `<option value="ACTUAL_SUPERVISION" data-rango="${rangoActual}" class="font-bold text-purple-700">Versión Actual (SUPERVISION)</option>`;
        } else if (AppState.rolGlobalReal === "SUPERVISION") {
            // Supervisión solo ve su propio "En vivo"
            htmlOpciones2 += `<option value="ACTUAL_SUPERVISION" data-rango="${rangoActual}" class="font-bold text-purple-700">Mi Versión Actual</option>`;
        } else {
            // Residente (y demás) solo ven el "En vivo" del Residente
            htmlOpciones2 += `<option value="ACTUAL_RESIDENTE" data-rango="${rangoActual}" class="font-bold text-blue-700">Mi Versión Actual</option>`;
        }

        // Historial cerrado (Todos ven todo)
        [...AppState.listaVersionesGlobal].reverse().forEach(v => {
            let textoRango = v.rango ? `${v.rango} - ` : "";
            let textoRol = v.rol ? ` - ${v.rol}` : "";
            
            // 🟢 Limpieza de fecha para que no se vea el texto largo "GMT-0500..."
            let fechaLimpia = v.fecha;
            if (fechaLimpia.includes("GMT") || fechaLimpia.length > 20) {
                let d = new Date(fechaLimpia);
                if (!isNaN(d)) {
                    fechaLimpia = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
                }
            }

            htmlOpciones1 += `<option value="${v.numero}" data-rango="${v.rango}">${textoRango}${v.numero} • ${fechaLimpia} (${v.usuario})${textoRol}</option>`;
            htmlOpciones2 += `<option value="${v.numero}" data-rango="${v.rango}">${textoRango}${v.numero} • ${fechaLimpia} (${v.usuario})${textoRol}</option>`;
        });

        cmb1.innerHTML = htmlOpciones1;
        cmb2.innerHTML = htmlOpciones2;

        document.getElementById('lblVersionActual').classList.add('hidden');
        cmb1.classList.remove('hidden');
    }

    const normFecha = (f) => {
        if (!f) return "";
        let s = String(f).trim().replace(/^'/, '');
        if (s.includes('T')) {
            let parts = s.split('T')[0].split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.substring(0, 10);
        let d = new Date(s);
        if (!isNaN(d.getTime())) return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        return s;
    };

    

    // 🟢 EVENTO DEL COMBO COMPARATIVO CORREGIDO
    document.getElementById('cmbHistorialVersiones2').addEventListener('change', async (e) => {
        const val = e.target.value;
        if (val.startsWith("ACTUAL")) {
            AppState.memoriaHistorial2 = null;
        } else {
            document.getElementById('tbodyLookAheadSup').innerHTML = `<tr><td colspan="12" class="text-center py-10 text-purple-500 animate-pulse">Viajando a la ${val}...</td></tr>`;
            try {
                const res = await API.obtenerVersionAntigua(AppState.currentSheetsId, val);
                if (res.success) AppState.memoriaHistorial2 = res.actividades; else throw new Error();
            } catch (e) {
                e.target.selectedIndex = 0; 
                AppState.memoriaHistorial2 = null;
            }
        }
        renderizarAmbasTablas();
    });

    function toggleModoComparativo() {
        AppState.modoComparativoActivo = !AppState.modoComparativoActivo;
        const btn = document.getElementById('btnToggleComparativo');
        const contPrincipal = document.getElementById('contenedorLookAhead');
        const contSecundario = document.getElementById('contenedorSecundario');
        const tituloPrincipal = document.getElementById('tituloTablaPrincipal');
        const cajaVs = document.getElementById('cajaVersionesVs');

        if (document.getElementById('cmbHistorialVersiones').value === "ACTUAL") guardarProgramacionTemporal();

        if (AppState.modoComparativoActivo) {
            btn.classList.replace('bg-teal-600', 'bg-red-500'); btn.classList.replace('hover:bg-teal-700', 'hover:bg-red-600');
            btn.innerHTML = `❌ <span class="hidden sm:inline ml-1">Cerrar Comparativo</span>`;

            contSecundario.classList.remove('hidden'); contSecundario.classList.add('flex');
            tituloPrincipal.classList.remove('hidden');
            cajaVs.classList.remove('hidden'); cajaVs.classList.add('flex');
            contPrincipal.style.maxHeight = '30vh';
            
            document.getElementById('cmbHistorialVersiones2').dispatchEvent(new Event('change'));
        } else {
            btn.classList.replace('bg-red-500', 'bg-teal-600'); btn.classList.replace('hover:bg-red-600', 'hover:bg-teal-700');
            btn.innerHTML = `⚖️ <span class="hidden sm:inline ml-1">Comparar Versiones</span>`;

            contSecundario.classList.add('hidden'); contSecundario.classList.remove('flex');
            tituloPrincipal.classList.add('hidden');
            cajaVs.classList.add('hidden'); cajaVs.classList.remove('flex');
            contPrincipal.style.maxHeight = '60vh';

            renderizarAmbasTablas();
        }
    }

    // =========================================================
    // ⏱️ MOTOR DE TIEMPO VISUAL (CINTA HISTÓRICA)
    // =========================================================
    let listadoSemanasGlobal = []; 
    let indiceSemanaActual = 0; 
    let semanaActiva = 1; // Para mantener compatibilidad visual con la pestaña seleccionada (1 a 4)

    // 1. Inicializador (Llamar al cargar el proyecto)
    async function inicializarMotorTiempo() {
        try {
            const res = await API.obtenerSemanasHistoricas(AppState.currentSheetsId);
            if (res.success && res.semanas.length > 0) {
                listadoSemanasGlobal = res.semanas;
                
                // Buscar la semana correspondiente a "Hoy"
                const hoy = new Date();
                hoy.setHours(0,0,0,0);
                
                let indiceEncontrado = 0;
                for (let i = 0; i < listadoSemanasGlobal.length; i++) {
                    let p = listadoSemanasGlobal[i].fecha.split('-');
                    let fLunes = new Date(p[0], parseInt(p[1])-1, p[2]);
                    let fDomingo = new Date(fLunes);
                    fDomingo.setDate(fDomingo.getDate() + 6);
                    
                    if (hoy >= fLunes && hoy <= fDomingo) {
                        indiceEncontrado = i; break;
                    }
                }
                
                if (indiceEncontrado > listadoSemanasGlobal.length - 4) {
                    indiceEncontrado = Math.max(0, listadoSemanasGlobal.length - 4);
                }
                
                indiceSemanaActual = indiceEncontrado;
                semanaActiva = 1; // Siempre arranca mostrando la primera de la vista
                actualizarInterfazSemanas();
            }
        } catch (e) { console.error("Error cargando motor de tiempo", e); }
    }

    // 2. Control de Pestañas Visuales
    function cambiarSemana(num) {
        if (semanaActiva === num) return;
        if (document.getElementById('cmbHistorialVersiones').value === "ACTUAL") guardarProgramacionTemporal();
        
        semanaActiva = num;
        // Ahora delegamos el repintado visual a la función principal
        actualizarInterfazSemanas();
    }

    // 3. Renderizar Textos de los Botones y Badge
    function actualizarInterfazSemanas() {
    if(listadoSemanasGlobal.length === 0) return;
    
    const bloque = listadoSemanasGlobal.slice(indiceSemanaActual, indiceSemanaActual + 4);
    
    for (let i = 0; i < 4; i++) {
        let btn = document.getElementById(`btnSemana${i+1}`);
        if (btn && bloque[i]) {
            let p = bloque[i].fecha.split('-');
            let inicio = new Date(p[0], parseInt(p[1])-1, p[2]);
            let fin = new Date(inicio); fin.setDate(fin.getDate() + 6);
            
            let colorFecha = ((i+1) === semanaActiva) ? 'text-blue-600' : 'text-gray-400';
            btn.innerHTML = `Semana ${bloque[i].semana} <span class="hidden sm:inline font-normal ${colorFecha} text-[10px] ml-1">(${inicio.getDate()}/${inicio.getMonth() + 1} - ${fin.getDate()}/${fin.getMonth() + 1})</span>`;
            
            // 🟢 SOLUCIÓN DEL BUG: Aplicamos el color de fondo correcto a la pestaña activa
            btn.className = ((i+1) === semanaActiva) 
                ? "tab-semana px-3 sm:px-4 py-1.5 bg-blue-100 text-blue-800 rounded-lg whitespace-nowrap border border-blue-200 shadow-sm transition-all" 
                : "tab-semana px-3 sm:px-4 py-1.5 text-gray-600 hover:bg-slate-100 rounded-lg whitespace-nowrap transition-all hidden sm:block";
        }
    }
    
    if(bloque[0]) {
        document.getElementById('badgeVentana').innerHTML = `🟢 RANGO ACTIVO: SEMANAS ${bloque[0].semana} AL ${bloque[bloque.length-1]?.semana || bloque[0].semana}`;
        // Actualiza el pivote de la App para que generarCabeceraFechas pinte correctamente
        AppState.configProyecto.fechaLunesBase = bloque[0].fecha;
        AppState.configProyecto.semanaInicio = bloque[0].semana;
    }
    
    renderizarAmbasTablas();
    }

    // 4. Generador de Cabeceras Dinámico (Sustituye al antiguo generarCabeceraFechas)
    function generarCabeceraFechas() {
        const trCabecera = document.getElementById('trCabeceraFechas');
        const trCabeceraSup = document.getElementById('trCabeceraFechasSup');
        document.querySelectorAll('.th-fecha').forEach(th => th.remove());

        if (listadoSemanasGlobal.length === 0) {
            trCabecera.innerHTML += `<th colspan="7" class="th-fecha px-2 py-4 bg-red-50 text-red-600 font-bold border border-slate-300">⚠️ Configura el Rango primero.</th>`;
            return;
        }

        // Calcula las fechas de la semana activa en pantalla
        const bloque = listadoSemanasGlobal.slice(indiceSemanaActual, indiceSemanaActual + 4);
        let fechaSemanaSeleccionada = bloque[semanaActiva - 1]?.fecha || bloque[0].fecha;
        
        let partes = fechaSemanaSeleccionada.split('-');
        let dLunesBase = new Date(partes[0], parseInt(partes[1])-1, partes[2]);

        // Llenado en memoria para validaciones
        AppState.fechasRangoActivo = [];
        let dInicioRango = new Date(bloque[0].fecha.split('-')[0], parseInt(bloque[0].fecha.split('-')[1])-1, bloque[0].fecha.split('-')[2]);
        for (let i = 0; i < 28; i++) {
            let f = new Date(dInicioRango); f.setDate(dInicioRango.getDate() + i);
            AppState.fechasRangoActivo.push(`${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`);
        }

        const diasNombres = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        let dateHoy = new Date(); dateHoy.setHours(0, 0, 0, 0);

        AppState.fechasSemanales = [];
        for (let i = 0; i < 7; i++) {
            let f = new Date(dLunesBase); f.setDate(dLunesBase.getDate() + i);
            AppState.fechasSemanales.push(`${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`);

            let esHoy = (f.getTime() === dateHoy.getTime());
            let diaStr = `${f.getDate()}-${mesesNombres[f.getMonth()]}`;
            let clasesTH = esHoy ? "th-fecha px-2 py-1 border border-slate-300 font-semibold w-12 sm:w-16 text-green-700 bg-green-50" : "th-fecha px-2 py-1 border border-slate-300 font-semibold w-12 sm:w-16";
            let subTexto = esHoy ? `<span class="font-normal text-green-600">${diasNombres[i]} (Hoy)</span>` : `<span class="font-normal text-gray-500">${diasNombres[i]}</span>`;

            let thHTML = `<th class="${clasesTH}">${diaStr}<br>${subTexto}</th>`;
            trCabecera.innerHTML += thHTML;
            if (trCabeceraSup) trCabeceraSup.innerHTML += thHTML;
        }
    }

    // 5. Botones Anterior y Siguiente
    document.getElementById('btnSig').addEventListener('click', async () => {
        let cmbHistorial = document.getElementById('cmbHistorialVersiones');
        if (cmbHistorial && cmbHistorial.value !== "ACTUAL") return alert("Estás en modo lectura de una versión pasada. Vuelve a la 'Versión Actual' para navegar.");

        const btn = document.getElementById('btnSig');
        btn.disabled = true; btn.innerHTML = "...";

        let sigIndice = indiceSemanaActual + 1;

        // Extendemos si estamos cerca del borde
        if ((sigIndice + 3) >= listadoSemanasGlobal.length) {
            const res = await API.extenderSemanaHistorica(AppState.currentSheetsId);
            if (res.success) {
                listadoSemanasGlobal.push({ fecha: res.nuevaFecha, semana: res.nuevaSemana });
            } else {
                alert("Error al extender calendario."); 
                btn.disabled = false; btn.innerHTML = "Sig &rarr;"; 
                return;
            }
        }

        indiceSemanaActual = sigIndice;
        actualizarInterfazSemanas();
        btn.disabled = false; btn.innerHTML = "Sig &rarr;";
    });

    document.getElementById('btnAnt').addEventListener('click', () => {
        let cmbHistorial = document.getElementById('cmbHistorialVersiones');
        if (cmbHistorial && cmbHistorial.value !== "ACTUAL") return alert("Estás en modo lectura de una versión pasada. Vuelve a la 'Versión Actual' para navegar.");

        if (indiceSemanaActual > 0) {
            indiceSemanaActual--;
            actualizarInterfazSemanas();
        } else {
            alert("Ya estás en el inicio del proyecto.");
        }
    });

    // =========================================================
// UNIFICACIÓN: EVENTO DEL COMBOBOX (Viaje Temporal + Datos JSON)
// =========================================================
document.getElementById('cmbHistorialVersiones').addEventListener('change', async (e) => {
    const val = e.target.value;
    const btnGuardar = document.getElementById('btnGuardarOrden');

    // 1. VIAJE EN EL TIEMPO VISUAL
    const opcionSeleccionada = e.target.options[e.target.selectedIndex];
    const rangoAtributo = opcionSeleccionada.getAttribute('data-rango'); // Ej: "Sem 39-42"
    
    if (rangoAtributo) {
        const matchRango = rangoAtributo.match(/Sem (\d+)/);
        if (matchRango) {
            const semInicioRequerida = parseInt(matchRango[1]);
            const nuevoIndice = listadoSemanasGlobal.findIndex(s => parseInt(s.semana) === semInicioRequerida);
            if (nuevoIndice !== -1) {
                indiceSemanaActual = nuevoIndice;
                semanaActiva = 1; 
                actualizarInterfazSemanas(); // Mueve las cabeceras
            }
        }
    }

    // 2. CARGA DE DATOS JSON (Memoria)
    if (val === "ACTUAL") {
        AppState.memoriaHistorial1 = null;
        if (btnGuardar && AppState.puedeEditarEstructura) { btnGuardar.classList.remove('hidden'); btnGuardar.classList.add('flex'); }
        renderizarAmbasTablas();
    } else {
        document.getElementById('tbodyLookAhead').innerHTML = `<tr><td colspan="12" class="text-center py-10 text-indigo-500 animate-pulse font-bold">Viajando a la ${val}...</td></tr>`;
        if (btnGuardar) { btnGuardar.classList.add('hidden'); btnGuardar.classList.remove('flex'); }
        try {
            const res = await API.obtenerVersionAntigua(AppState.currentSheetsId, val);
            if (res.success) {
                AppState.memoriaHistorial1 = res.actividades; 
            } else throw new Error();
        } catch (e) {
            e.target.value = "ACTUAL"; AppState.memoriaHistorial1 = null;
            if (btnGuardar && AppState.puedeEditarEstructura) { btnGuardar.classList.remove('hidden'); btnGuardar.classList.add('flex'); }
        }
        renderizarAmbasTablas(); // Dibuja la tabla con el JSON
    }
});


// =========================================================
// LÓGICA DEL BOTÓN: "IR A HOY"
// =========================================================
document.getElementById('btnIrAHoy').addEventListener('click', () => {
    // Si estábamos en una versión del pasado, la regresamos a "ACTUAL"
    let cmbHistorial = document.getElementById('cmbHistorialVersiones');
    if (cmbHistorial && cmbHistorial.value !== "ACTUAL") {
        cmbHistorial.value = "ACTUAL";
        cmbHistorial.dispatchEvent(new Event('change')); // Dispara la carga de datos vivos
    }

    // Recalcular la fecha de Hoy
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    
    let indiceEncontrado = 0;
    for (let i = 0; i < listadoSemanasGlobal.length; i++) {
        let p = listadoSemanasGlobal[i].fecha.split('-');
        let fLunes = new Date(p[0], parseInt(p[1])-1, p[2]);
        let fDomingo = new Date(fLunes);
        fDomingo.setDate(fDomingo.getDate() + 6);
        
        if (hoy >= fLunes && hoy <= fDomingo) {
            indiceEncontrado = i; break;
        }
    }
    
    // Evitar desbordes
    if (indiceEncontrado > listadoSemanasGlobal.length - 4) {
        indiceEncontrado = Math.max(0, listadoSemanasGlobal.length - 4);
    }
    
    // Viajar y pintar
    indiceSemanaActual = indiceEncontrado;
    semanaActiva = 1;
    actualizarInterfazSemanas();
});

    // ---------------- EL MOTOR UNIFICADO ----------------
    function renderizarAmbasTablas() {
        const tbody1 = document.getElementById('tbodyLookAhead');
        const tbody2 = document.getElementById('tbodyLookAheadSup');
        generarCabeceraFechas();
        tbody1.innerHTML = ''; if (tbody2) tbody2.innerHTML = '';

        const dibujar = (tbodyTarget, esTabla1) => {
            let cmbEl = document.getElementById(esTabla1 ? 'cmbHistorialVersiones' : 'cmbHistorialVersiones2');
            
            // Valor por defecto seguro dependiendo del combo
            let fallbackSecundario = AppState.rolGlobalReal === "SUPERVISION" ? "ACTUAL_SUPERVISION" : "ACTUAL_RESIDENTE";
            let valCmb = cmbEl ? cmbEl.value : (esTabla1 ? "ACTUAL" : fallbackSecundario);
            
            let esLectura = esTabla1 ? (valCmb !== "ACTUAL") : !valCmb.startsWith("ACTUAL");

            let dataAct = []; let dataProg = []; let titulo = ""; let rolAUsar = "RESIDENTE";

            // 🟢 DETERMINAR EL ROL DE LA TABLA PRINCIPAL
            let rolMiSesion = "RESIDENTE";
            if (AppState.rolGlobalReal === "ADMIN") {
                let cmbRol = document.getElementById('cmbRolSimulado');
                rolMiSesion = cmbRol ? cmbRol.value : "RESIDENTE";
            } else if (["STAFF", "SC", "RUBRO"].includes(AppState.rolGlobalReal)) {
                rolMiSesion = "RESIDENTE";
            } else {
                rolMiSesion = AppState.rolGlobalReal;
            }

            if (esTabla1) AppState.rolRenderizadoActual = rolMiSesion;

            // Extraer Datos Vivos vs Datos Históricos
            if (!esLectura) {
                dataAct = AppState.memoriaCache.filter(a => a.estado !== 'ELIMINADO');
                dataProg = AppState.memoriaProgramacion;
                
                if (esTabla1) {
                    rolAUsar = rolMiSesion;
                } else {
                    rolAUsar = valCmb === "ACTUAL_RESIDENTE" ? "RESIDENTE" : "SUPERVISION";
                }
                titulo = `PLANIFICACIÓN: ${rolAUsar} (VERSIÓN ACTUAL)`;
            } else {
                let memH = esTabla1 ? AppState.memoriaHistorial1 : AppState.memoriaHistorial2;
                if (!memH) return;
                dataAct = Array.isArray(memH) ? memH : (memH.actividades || []);
                dataProg = memH.programacion || [];
                let vInfo = AppState.listaVersionesGlobal.find(v => v.numero === valCmb);
                rolAUsar = (vInfo && vInfo.rol) ? String(vInfo.rol).trim().toUpperCase() : "RESIDENTE";
                titulo = `PLANIFICACIÓN: ${rolAUsar} (${valCmb})`;
            }

            let elementTitulo = document.getElementById(esTabla1 ? 'tituloTablaPrincipal' : 'tituloTablaSecundaria');
            if (elementTitulo) elementTitulo.innerText = titulo;

            dataAct.sort((a, b) => String(a.indice).localeCompare(String(b.indice), undefined, { numeric: true }));

            if (!esLectura && esTabla1) {
                let contEnc = 0; let contAct = 0; let idPadreActual = "";
                dataAct.forEach(act => {
                    if (act.id.startsWith('ENC')) { contEnc++; contAct = 0; act.indice = String(contEnc); act.idPadre = ""; idPadreActual = act.id; }
                    else { contAct++; act.indice = `${contEnc}.${contAct}`; act.idPadre = idPadreActual; }
                });
            }

            // 🟢 NUEVO: LÓGICA DE FILTRADO VISUAL POR SC/RUBRO
            let filtroSC = document.getElementById('cmbFiltroSCLook') ? document.getElementById('cmbFiltroSCLook').value : "";
            let dataActFiltrada = dataAct;

            if (filtroSC !== "") {
                let encabezadosValidos = new Set();
                
                // 1. Encontrar todos los padres de las actividades que cumplen el filtro
                dataAct.forEach(a => {
                    if (!a.id.startsWith('ENC') && a.tipo !== 'ENCABEZADO' && (a.scRubro || "").trim().toUpperCase() === filtroSC) {
                        if (a.idPadre) encabezadosValidos.add(a.idPadre);
                    }
                });
                
                // 2. Filtrar la lista final (conservando la actividad que coincide + su encabezado)
                dataActFiltrada = dataAct.filter(a => {
                    if (a.id.startsWith('ENC') || a.tipo === 'ENCABEZADO') return encabezadosValidos.has(a.id);
                    return (a.scRubro || "").trim().toUpperCase() === filtroSC;
                });
            }

            let html = '';
            // 🟢 CORRECCIÓN: Usar dataActFiltrada aquí
            if (dataActFiltrada.length === 0) {
                html = `<tr><td colspan="12" class="text-center py-10 text-slate-500">Sin datos para este filtro.</td></tr>`;
            } else {
                // 🟢 CANDADOS DE EDICIÓN Y BLOQUEO VISUAL
                let puedeEditarEstaVista = esTabla1 && !esLectura && AppState.puedeEditarSectores;
                let ocultarEdicion = !AppState.puedeEditarEstructura || !puedeEditarEstaVista;

                let spanDragAct = ocultarEdicion ? '' : `<span class="cursor-move text-gray-400 mr-2 hover:text-gray-600 px-1 drag-handle">☰</span>`;
                let spanDragEnc = ocultarEdicion ? '' : `<span class="cursor-move text-yellow-700 mr-2 hover:text-yellow-900 px-1 drag-handle">☰</span>`;
                let chkBox = ocultarEdicion ? '' : `<input type="checkbox" class="row-chk cursor-pointer w-4 h-4 rounded">`;

                // 🟢 CORRECCIÓN: Usar dataActFiltrada aquí también!
                dataActFiltrada.forEach(act => {
                    let btnEdicionEnc = ocultarEdicion ? '' : `<button onclick="abrirModalEdicion('${act.id}')" class="opacity-0 group-hover:opacity-100 text-slate-700 hover:bg-yellow-400 rounded px-1 transition-all">✏️</button><button onclick="eliminarDeCache('${act.id}')" class="opacity-0 group-hover:opacity-100 text-red-600 hover:bg-red-200 rounded px-1 transition-all ml-1">🗑️</button>`;
                    let btnEdicionAct = ocultarEdicion ? '' : `<button onclick="abrirModalEdicion('${act.id}')" class="opacity-0 group-hover:opacity-100 text-blue-500 hover:bg-blue-50 rounded px-1 transition-all ml-2">✏️</button><button onclick="eliminarDeCache('${act.id}')" class="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 rounded px-1 transition-all ml-1">🗑️</button>`;

                    if (act.id.startsWith('ENC') || act.tipo === 'ENCABEZADO') {
                        if (!puedeEditarEstaVista) {
                            html += `<tr class="bg-yellow-300/80 font-bold border-b border-slate-400 select-none opacity-90"><td class="px-1 py-1.5 border border-slate-400 sticky left-0 z-10 bg-yellow-300/90 w-8 sm:w-10"></td><td class="px-2 py-1.5 border border-slate-400 text-center text-xs font-black text-yellow-900 sticky left-[32px] sm:left-[40px] z-10 bg-yellow-300/90 w-12 sm:w-16">${act.indice}</td><td class="px-3 py-1.5 border border-slate-400 sticky left-[80px] sm:left-[104px] z-10 bg-yellow-300/90 text-left text-xs">${act.descripcion}</td><td class="px-2 py-1.5 border border-slate-400 hidden sm:table-cell"></td><td class="px-2 py-1.5 border border-slate-400"></td><td colspan="7" class="px-2 py-1.5 border border-slate-400 bg-yellow-100/50 text-center text-[10px] font-bold text-yellow-800 tracking-widest uppercase">Modo Lectura</td></tr>`;
                        } else {
                            html += `<tr data-id="${act.id}" class="bg-yellow-300/80 font-bold border-b border-slate-400 select-none"><td class="px-1 py-1.5 border border-slate-400 text-center sticky left-0 z-10 bg-yellow-300/90 w-8 sm:w-10">${chkBox}</td><td class="px-2 py-1.5 border border-slate-400 text-center text-xs font-black text-yellow-900 sticky left-[32px] sm:left-[40px] z-10 bg-yellow-300/90 w-12 sm:w-16">${act.indice}</td><td class="px-3 py-1.5 border border-slate-400 sticky left-[80px] sm:left-[104px] z-10 bg-yellow-300/90 text-left text-xs"><div class="flex items-center group">${spanDragEnc}<span class="flex-grow">${act.descripcion}</span>${btnEdicionEnc}</div></td><td class="px-2 py-1.5 border border-slate-400 hidden sm:table-cell"></td><td class="px-2 py-1.5 border border-slate-400"></td>${[0, 1, 2, 3, 4, 5, 6].map(() => `<td class="border border-slate-400 bg-yellow-100/30"></td>`).join('')}</tr>`;
                        }
                    } else {
                        let celdas = [0, 1, 2, 3, 4, 5, 6].map(dia => {
                            let fStr = AppState.fechasSemanales[dia];
                            let p = dataProg.find(x =>
                                String(x.idActividad).trim() === String(act.id).trim() &&
                                normFecha(x.fecha) === normFecha(fStr) &&
                                String(x.rol || "RESIDENTE").trim().toUpperCase() === String(rolAUsar).trim().toUpperCase()
                            );

                            if (!puedeEditarEstaVista) {
                                // MODO LECTURA: Se agrega data-act y data-fecha para permitir el copiado de formato
                                if (p && (p.sector || p.color)) return `<td class="celda-lectura border border-slate-300 cursor-not-allowed relative font-bold text-[9px] text-center shadow-inner opacity-90" data-act="${act.id}" data-fecha="${fStr}" style="background-color: ${p.color}; color: ${obtenerColorTextoContraste(p.color)}">${p.sector || ''}</td>`;
                                return `<td class="celda-lectura border border-slate-300 cursor-not-allowed bg-gray-50/50" data-act="${act.id}" data-fecha="${fStr}"></td>`;
                            } else {
                                // MODO EDICIÓN
                                if (p && (p.sector || p.color)) return `<td class="celda-prog border border-slate-300 cursor-pointer transition-colors relative font-bold text-[9px] text-center shadow-inner" data-act="${act.id}" data-fecha="${fStr}" style="background-color: ${p.color}; color: ${obtenerColorTextoContraste(p.color)}">${p.sector || ''}</td>`;
                                return `<td class="celda-prog border border-slate-300 cursor-pointer hover:bg-blue-50 transition-colors relative" data-act="${act.id}" data-fecha="${fStr}"></td>`;
                            }
                        }).join('');

                        if (!puedeEditarEstaVista) {
                            html += `<tr class="border-b border-slate-200 bg-white select-none opacity-90"><td class="px-1 py-2 border border-slate-300 sticky left-0 z-10 bg-white w-8 sm:w-10"></td><td class="px-2 py-2 border border-slate-300 text-center text-xs text-gray-500 font-mono sticky left-[32px] sm:left-[40px] z-10 bg-white w-12 sm:w-16">${act.indice}</td><td class="px-3 py-2 border border-slate-300 sticky left-[80px] sm:left-[104px] z-10 bg-white font-medium text-left truncate max-w-[150px] sm:max-w-none text-gray-600">${act.descripcion}</td><td class="px-2 py-2 border border-slate-300 text-gray-500 hidden sm:table-cell">${act.unidad}</td><td class="px-2 py-2 border border-slate-300 font-semibold text-[10px] sm:text-xs text-gray-500">${act.scRubro}</td>${celdas}</tr>`;
                        } else {
                            html += `<tr data-id="${act.id}" class="border-b border-slate-200 hover:bg-slate-50 transition-colors bg-white select-none"><td class="px-1 py-2 border border-slate-300 text-center sticky left-0 z-10 bg-inherit w-8 sm:w-10">${chkBox}</td><td class="px-2 py-2 border border-slate-300 text-center text-xs text-gray-500 font-mono sticky left-[32px] sm:left-[40px] z-10 bg-inherit w-12 sm:w-16">${act.indice}</td><td class="px-3 py-2 border border-slate-300 sticky left-[80px] sm:left-[104px] z-10 bg-inherit font-medium text-left truncate max-w-[150px] sm:max-w-none text-gray-600"><div class="flex items-center group">${spanDragAct}<span class="truncate flex-grow">${act.descripcion}</span>${btnEdicionAct}</div></td><td class="px-2 py-2 border border-slate-300 text-gray-500 hidden sm:table-cell">${act.unidad}</td><td class="px-2 py-2 border border-slate-300 font-semibold text-[10px] sm:text-xs text-gray-600">${act.scRubro}</td>${celdas}</tr>`;
                        }
                    }
                });
            }
            tbodyTarget.innerHTML = html;
        };

        dibujar(tbody1, true);
        if (AppState.modoComparativoActivo) dibujar(tbody2, false);

        let valCmb1 = document.getElementById('cmbHistorialVersiones').value;
        const cmbPadre = document.getElementById('cmbPadreActividad');
        if (valCmb1 === "ACTUAL" && cmbPadre) {
            cmbPadre.innerHTML = '<option value="">Seleccione un encabezado...</option>';
            AppState.memoriaCache.filter(a => a.estado !== 'ELIMINADO' && (a.id.startsWith('ENC') || a.tipo === 'ENCABEZADO')).forEach(act => {
                cmbPadre.innerHTML += `<option value="${act.id}">${act.indice} - ${act.descripcion}</option>`;
            });
            if (AppState.puedeEditarEstructura) inicializarDragAndDrop();
            inicializarInteraccionCeldas();
        } else {
            if (AppState.sortableInstancia) { try { AppState.sortableInstancia.destroy(); } catch (e) { } AppState.sortableInstancia = null; }
        }
    }

    // ---------------------------------------------------------
    // 3. MUTACIONES EN LA CACHÉ
    // ---------------------------------------------------------
    function mostrarBotonGuardar() {
        if (!AppState.puedeEditarEstructura) return; // SC y RUBRO no ven el boton guardar
        const btn = document.getElementById('btnGuardarOrden');
        if (btn) {
            btn.innerHTML = `💾 <span class="hidden sm:inline ml-1">Guardar Cambios</span>`;
            btn.classList.remove('hidden'); btn.classList.add('flex');
        }
    }

    document.getElementById('btnGuardarEncabezado').addEventListener('click', () => {
        const desc = document.getElementById('txtDescEncabezado').value.trim();
        if (!desc) return alert("Por favor, ingresa la descripción.");
        guardarProgramacionTemporal();
        AppState.memoriaCache.push({ id: "ENC_TEMP_" + Date.now(), indice: "999", descripcion: desc.toUpperCase(), unidad: "", scRubro: "", idPadre: "", estado: "ACTIVO" });
        document.getElementById('modalEncabezado').classList.add('hidden');
        document.getElementById('txtDescEncabezado').value = "";
        mostrarBotonGuardar(); renderizarAmbasTablas();
    });

    document.getElementById('btnGuardarActividad').addEventListener('click', () => {
        const idPadre = document.getElementById('cmbPadreActividad').value;
        const desc = document.getElementById('txtDescActividad').value.trim();
        const und = document.getElementById('txtUndActividad').value.trim();
        const sc = document.getElementById('txtScActividad').value.trim();
        if (!idPadre || !desc) return alert("El encabezado y descripción son obligatorios.");
        const padre = AppState.memoriaCache.find(a => a.id === idPadre);
        guardarProgramacionTemporal();
        AppState.memoriaCache.push({ id: "ACT_TEMP_" + Date.now(), indice: padre.indice + ".999", descripcion: desc.toUpperCase(), unidad: und.toUpperCase(), scRubro: sc.toUpperCase(), idPadre: idPadre, estado: "ACTIVO" });
        document.getElementById('modalActividad').classList.add('hidden');
        document.getElementById('txtDescActividad').value = ""; document.getElementById('txtUndActividad').value = ""; document.getElementById('txtScActividad').value = "";
        mostrarBotonGuardar(); renderizarAmbasTablas();
    });

    function eliminarDeCache(id) {
        if (!confirm(`¿Estás seguro de eliminar este ítem?`)) return;
        const item = AppState.memoriaCache.find(x => x.id === id);
        if (item) {
            item.estado = 'ELIMINADO';
            guardarProgramacionTemporal();
            mostrarBotonGuardar(); renderizarAmbasTablas();
        }
    }

    function abrirModalEdicion(id) {
        const item = AppState.memoriaCache.find(x => x.id === id);
        if (!item) return;
        document.getElementById('txtEditIdActividad').value = id;
        document.getElementById('txtEditDesc').value = item.descripcion;
        document.getElementById('modalEditar').classList.remove('hidden');
    }

    document.getElementById('btnGuardarEdicion').addEventListener('click', () => {
        const id = document.getElementById('txtEditIdActividad').value;
        const desc = document.getElementById('txtEditDesc').value.trim();
        if (!desc) return alert("La descripción no puede estar vacía.");
        const item = AppState.memoriaCache.find(x => x.id === id);
        if (item) item.descripcion = desc.toUpperCase();

        document.getElementById('modalEditar').classList.add('hidden');
        guardarProgramacionTemporal();
        mostrarBotonGuardar(); renderizarAmbasTablas();
    });

    // ---------------------------------------------------------
    // 4. LÓGICA DE MULTI-SELECCIÓN (Filas Completas)
    // ---------------------------------------------------------
    function inicializarSelectorMultiples() {
        const tbody = document.getElementById('tbodyLookAhead');
        if (!window.eventosSelectorIniciados) {
            tbody.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('row-chk')) {
                    AppState.isDraggingSelect = true;
                    AppState.dragSelectValue = !e.target.checked;
                    seleccionarFila(e.target, AppState.dragSelectValue);
                    e.preventDefault();
                }
            });
            tbody.addEventListener('mouseover', (e) => {
                if (AppState.isDraggingSelect && e.target.classList.contains('row-chk')) seleccionarFila(e.target, AppState.dragSelectValue);
            });
            document.addEventListener('mouseup', () => AppState.isDraggingSelect = false);
            window.eventosSelectorIniciados = true;
        }
        const chkAll = document.getElementById('chkSelectAll');
        if (chkAll) {
            const nuevoChkAll = chkAll.cloneNode(true);
            chkAll.parentNode.replaceChild(nuevoChkAll, chkAll);
            nuevoChkAll.addEventListener('change', (e) => {
                document.querySelectorAll('.row-chk').forEach(chk => seleccionarFila(chk, e.target.checked));
            });
        }
    }

    function seleccionarFila(checkbox, forceCheck) {
        checkbox.checked = forceCheck;
        const tr = checkbox.closest('tr');
        if (forceCheck) {
            tr.classList.add('multi-selected');
            try { if (Sortable && Sortable.utils) Sortable.utils.select(tr); } catch (e) { }
        } else {
            tr.classList.remove('multi-selected');
            try { if (Sortable && Sortable.utils) Sortable.utils.deselect(tr); } catch (e) { }
        }
    }

    function inicializarDragAndDrop() {
        const tbody = document.getElementById('tbodyLookAhead');

        if (AppState.sortableInstancia) {
            try { AppState.sortableInstancia.destroy(); } catch (e) { }
            AppState.sortableInstancia = null;
        }

        if (typeof Sortable.MultiDrag !== 'undefined' && !window.multiDragMounted) {
            try { Sortable.mount(new Sortable.MultiDrag()); window.multiDragMounted = true; } catch (e) { }
        }

        AppState.sortableInstancia = new Sortable(tbody, {
            multiDrag: true,
            selectedClass: 'multi-selected',
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'bg-blue-50',
            onEnd: function (evt) {
                document.querySelectorAll('.row-chk').forEach(c => c.checked = false);
                if (document.getElementById('chkSelectAll')) document.getElementById('chkSelectAll').checked = false;

                const filas = document.querySelectorAll('#tbodyLookAhead tr');
                let nuevoOrdenCache = [];
                filas.forEach(fila => {
                    const id = fila.getAttribute('data-id');
                    const item = AppState.memoriaCache.find(x => x.id === id);
                    if (item) nuevoOrdenCache.push(item);
                });

                let contEnc = 0; let contAct = 0; let idPadreActual = "";
                nuevoOrdenCache.forEach(act => {
                    if (act.id.startsWith('ENC')) { contEnc++; contAct = 0; act.indice = String(contEnc); act.idPadre = ""; idPadreActual = act.id; }
                    else { contAct++; act.indice = `${contEnc}.${contAct}`; act.idPadre = idPadreActual; }
                });

                document.querySelectorAll('.multi-selected').forEach(tr => {
                    tr.classList.remove('multi-selected');
                    try { if (Sortable && Sortable.utils) Sortable.utils.deselect(tr); } catch (e) { }
                });

                AppState.memoriaCache.filter(x => x.estado === 'ELIMINADO').forEach(x => nuevoOrdenCache.push(x));
                AppState.memoriaCache = nuevoOrdenCache;

                guardarProgramacionTemporal();
                mostrarBotonGuardar();
                renderizarAmbasTablas();
            }
        });
    }

    // ---------------------------------------------------------
    // 5. SINCRONIZADOR MAESTRO Y VERSIONES 
    // ---------------------------------------------------------
    document.getElementById('btnGuardarOrden').addEventListener('click', async () => {
        if (!AppState.puedeEditarEstructura) return; // Bloqueo de seguridad

        const btn = document.getElementById('btnGuardarOrden');
        btn.innerHTML = `⏳ <span class="hidden sm:inline ml-1">Sincronizando...</span>`; btn.disabled = true;

        guardarProgramacionTemporal();

        let rolUsuario = "RESIDENTE";
        if (AppState.rolGlobalReal === "ADMIN") {
            let cmb = document.getElementById('cmbRolSimulado');
            if (cmb) rolUsuario = cmb.value;
        } else if (["STAFF", "SC", "RUBRO"].includes(AppState.rolGlobalReal)) {
            rolUsuario = "RESIDENTE"; // STAFF guarda sus adiciones de estructura a la vista del RESIDENTE
        } else {
            rolUsuario = AppState.rolGlobalReal;
        }

        let progParaGuardar = AppState.memoriaProgramacion.filter(p => AppState.fechasRangoActivo.includes(p.fecha));

        try {
            const respuesta = await API.guardarCambiosCache(AppState.currentSheetsId, AppState.memoriaCache, progParaGuardar, AppState.fechasRangoActivo, rolUsuario);
            if (respuesta.success) cargarLookAhead(AppState.currentSheetsId);
            else alert("Error: " + respuesta.message);
        } catch (e) { alert("Error al sincronizar."); } finally { btn.disabled = false; }
    });

    document.getElementById('btnRegistrarVersion').addEventListener('click', () => {
        document.getElementById('txtComentarioVersion').value = "";
        document.getElementById('modalVersion').classList.remove('hidden');
    });

    document.getElementById('btnGuardarVersion').addEventListener('click', async () => {
        const comentario = document.getElementById('txtComentarioVersion').value.trim();
        if (!comentario) return alert("Por favor ingresa un comentario.");

        const btn = document.getElementById('btnGuardarVersion');
        btn.innerText = "Guardando..."; btn.disabled = true;

        const sessionData = JSON.parse(sessionStorage.getItem('usuarioActivo'));
        const user = sessionData ? sessionData.idUsuario : "DESC";

        let rolUsuario = "RESIDENTE";
        if (AppState.rolGlobalReal === "ADMIN") {
            let cmb = document.getElementById('cmbRolSimulado');
            if (cmb) rolUsuario = cmb.value;
        } else {
            rolUsuario = AppState.rolGlobalReal;
        }

        let semInicio = parseInt(AppState.configProyecto.semanaInicio) || 1;
        let rangoSemanas = `Sem ${semInicio}-${semInicio + 3}`;

        let fechaBaseStr = AppState.configProyecto.fechaLunesBase;
        const sessionProy = JSON.parse(sessionStorage.getItem('proyectoActivo'));
        
        // 🟢 ¡AQUÍ ESTABA EL ERROR! 
        // Cambiamos 'jsonFolder' por 'jsonFolderLook' para que lea la columna correcta
        const jsonFolderId = sessionProy ? sessionProy.jsonFolderLook : "";

        try {
            const res = await API.guardarVersion(AppState.currentSheetsId, comentario, user, rangoSemanas, rolUsuario, fechaBaseStr, jsonFolderId);
            if (res.success) {
                document.getElementById('modalVersion').classList.add('hidden');
                cargarLookAhead(AppState.currentSheetsId);
            } else {
                alert("Error al guardar versión: " + res.message);
            }
        } catch (e) {
            console.error(e);
            alert("Error de red al guardar la versión.");
        } finally {
            btn.innerText = "Confirmar Versión";
            btn.disabled = false;
        }
    });

    // ---------------------------------------------------------
    // 6. INTERACCIÓN DE CELDAS Y MENÚ CONTEXTUAL
    // ---------------------------------------------------------
    let timerLongPress;
    let menuProgramacion = document.getElementById('menuProgramacion');
    let portapapelesFormato = null;
    let menuVisible = false;
    let evitarClicNormal = false;

    let modoCopiarOrigenActivo = false;
    let tipoPegadoSeleccionado = "AMBOS";
    let celdasDestinoCopiar = [];

    let modoMoverActivo = false;
    let celdasOrigenMover = [];

    let isDraggingCelda = false;
    let dragCeldaValue = true;

    function inicializarInteraccionCeldas() {
        const tbodies = [document.getElementById('tbodyLookAhead'), document.getElementById('tbodyLookAheadSup')];

        tbodies.forEach(tbody => {
            if (!tbody) return;
            
            tbody.addEventListener('dragstart', (e) => {
                if (e.target.closest('.celda-prog, .celda-lectura')) e.preventDefault();
            });

            tbody.addEventListener('mousedown', iniciarInteraccion);
            tbody.addEventListener('mouseover', moverInteraccion);

            tbody.addEventListener('touchstart', iniciarInteraccion, { passive: false });
            tbody.addEventListener('touchmove', moverInteraccionTouch, { passive: false });

            tbody.addEventListener('contextmenu', (e) => {
                let celda = e.target.closest('.celda-prog');
                if (celda) {
                    e.preventDefault();
                    mostrarMenuContextual(e.clientX, e.clientY);
                }
            });
        });

        document.addEventListener('mouseup', finalizarInteraccion);
        document.addEventListener('touchend', finalizarInteraccion);
    }

    function iniciarInteraccion(e) {
        if (e.button === 2) return;

        let celda = e.target.closest('.celda-prog, .celda-lectura');
        if (!celda) return;
        if (menuVisible) return;

        if (modoMoverActivo) {
            let tr = celda.closest('tr');
            let todasLasCeldas = Array.from(tr.querySelectorAll('.celda-prog'));
            let indexDestino = todasLasCeldas.indexOf(celda);

            let celdasOrigenOrdenadas = celdasOrigenMover.sort((a, b) => a.cellIndex - b.cellIndex);

            if (indexDestino + celdasOrigenOrdenadas.length > todasLasCeldas.length) {
                alert("No hay espacio suficiente en la semana para acomodar este bloque.");
                return;
            }

            let datosMover = celdasOrigenOrdenadas.map(c => ({
                nombre: c.innerText,
                color: c.style.backgroundColor
            }));

            celdasOrigenOrdenadas.forEach(c => {
                c.innerHTML = '';
                c.style.backgroundColor = '';
                c.className = 'celda-prog border border-slate-300 cursor-pointer hover:bg-blue-50 transition-colors relative';
            });

            for (let i = 0; i < datosMover.length; i++) {
                let celdaPintar = todasLasCeldas[indexDestino + i];
                if (datosMover[i].nombre !== '' || (datosMover[i].color && datosMover[i].color !== 'rgba(0, 0, 0, 0)' && datosMover[i].color !== 'transparent')) {
                    celdaPintar.className = `celda-prog border border-slate-300 cursor-pointer transition-colors relative font-bold text-[9px] text-center shadow-inner`;
                    celdaPintar.style.backgroundColor = datosMover[i].color;
                    celdaPintar.style.color = obtenerColorTextoContraste(datosMover[i].color);
                    celdaPintar.innerText = datosMover[i].nombre;
                }
            }

            mostrarBotonGuardar();
            cancelarModoMover();
            return;
        }

        if (modoCopiarOrigenActivo) {
            if (!celda.style.backgroundColor && celda.innerText.trim() === '') {
                alert("Debes seleccionar una celda que tenga color o texto.");
                return;
            }
            portapapelesFormato = { nombre: celda.innerText.trim(), color: celda.style.backgroundColor };
            document.getElementById('modalConfirmarPegado').classList.remove('hidden');
            document.getElementById('lblSectorPegado').innerText = tipoPegadoSeleccionado === "FORMATO" ? "Solo Color" : (portapapelesFormato.nombre || "(Sin nombre)");
            document.getElementById('colorPegadoPrevia').style.backgroundColor = portapapelesFormato.color;
            return;
        }

        if (celda.classList.contains('celda-lectura')) return;

        isDraggingCelda = true;
        dragCeldaValue = !celda.classList.contains('celda-seleccionada');
        toggleCelda(celda, dragCeldaValue);

        evitarClicNormal = false;
        let touch = e.touches ? e.touches[0] : e;

        timerLongPress = setTimeout(() => {
            evitarClicNormal = true;
            mostrarMenuContextual(touch.clientX, touch.clientY);
        }, 600);
    }

    function moverInteraccion(e) {
        if (modoCopiarOrigenActivo || modoMoverActivo) return;
        let celda = e.target.closest('.celda-prog');
        if (isDraggingCelda && celda) {
            clearTimeout(timerLongPress);
            toggleCelda(celda, dragCeldaValue);
        }
    }

    function moverInteraccionTouch(e) {
        if (modoCopiarOrigenActivo || modoMoverActivo) return;
        if (isDraggingCelda) {
            clearTimeout(timerLongPress);
            let touch = e.touches[0];
            let elemento = document.elementFromPoint(touch.clientX, touch.clientY);
            if (elemento) {
                let celda = elemento.closest('.celda-prog');
                if (celda) toggleCelda(celda, dragCeldaValue);
            }
        }
    }

    function toggleCelda(celda, seleccionar) {
        if (seleccionar) {
            celda.classList.add('celda-seleccionada', 'ring-4', 'ring-inset', 'ring-blue-600', 'brightness-75');
            if (celda.innerText.trim() === '') celda.classList.add('bg-blue-100/50');
        } else {
            celda.classList.remove('celda-seleccionada', 'ring-4', 'ring-inset', 'ring-blue-600', 'brightness-75', 'bg-blue-100/50');
        }
    }

    function finalizarInteraccion(e) {
        isDraggingCelda = false;
        clearTimeout(timerLongPress);

        if (menuVisible && evitarClicNormal) {
            let x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
            let y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
            let elementoSoltado = document.elementFromPoint(x, y);
            if (elementoSoltado) {
                let opcionMenu = elementoSoltado.closest('li');
                if (opcionMenu && opcionMenu.id.startsWith('btnMenu')) opcionMenu.click();
            }
        }
    }

    document.addEventListener('click', (e) => {
        if (evitarClicNormal) { evitarClicNormal = false; return; }
        if (menuVisible && !menuProgramacion.contains(e.target)) ocultarMenuContextual();
    });

    function mostrarMenuContextual(x, y) {
        const seleccionadas = document.querySelectorAll('.celda-seleccionada');
        if (seleccionadas.length === 0) return;

        menuVisible = true;
        menuProgramacion.classList.remove('hidden');

        let menuWidth = menuProgramacion.offsetWidth || 192;
        let menuHeight = menuProgramacion.offsetHeight || 180;

        let posX = x;
        let posY = y;

        if (posX + menuWidth > window.innerWidth) {
            posX = window.innerWidth - menuWidth - 10;
        }

        if (posY + menuHeight > window.innerHeight) {
            posY = window.innerHeight - menuHeight - 10;
        }

        menuProgramacion.style.left = `${posX}px`;
        menuProgramacion.style.top = `${posY}px`;

        setTimeout(() => {
            menuProgramacion.classList.remove('scale-95', 'opacity-0');
            menuProgramacion.classList.add('scale-100', 'opacity-100');
        }, 10);
    }

    function ocultarMenuContextual() {
        menuProgramacion.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { menuProgramacion.classList.add('hidden'); menuVisible = false; }, 150);
    }

    // ==========================================
    // ACCIONES DEL MENÚ
    // ==========================================

    document.getElementById('btnMenuAsignar').addEventListener('click', () => {
        ocultarMenuContextual();
        
        // Populate recent sectors
        const cmb = document.getElementById('cmbSectoresRecientes');
        if (cmb) {
            cmb.innerHTML = '<option value="">(Ninguno)</option>';
            let sectoresUnicos = {};
            AppState.memoriaProgramacion.forEach(p => {
                if (p.sector && p.sector.trim() !== '' && p.color) {
                    sectoresUnicos[p.sector.trim()] = p.color;
                }
            });
            for (let sec in sectoresUnicos) {
                cmb.innerHTML += `<option value="${sectoresUnicos[sec]}">${sec}</option>`;
            }
        }
        
        document.getElementById('modalSector').classList.remove('hidden');
    });

    // Auto-fill color when a recent sector is selected
    const cmbSecRec = document.getElementById('cmbSectoresRecientes');
    if (cmbSecRec) {
        cmbSecRec.addEventListener('change', (e) => {
            if (e.target.value) {
                document.getElementById('txtColorSector').value = e.target.value;
                const txtNombre = document.getElementById('txtNombreSector');
                if (txtNombre.value.trim() === '') {
                    txtNombre.value = e.target.options[e.target.selectedIndex].text;
                }
            }
        });
    }

    document.getElementById('btnMenuEliminar').addEventListener('click', () => {
        const seleccionadas = document.querySelectorAll('.celda-seleccionada');
        seleccionadas.forEach(celda => {
            celda.innerHTML = '';
            celda.style.backgroundColor = '';
            celda.className = 'celda-prog border border-slate-300 cursor-pointer hover:bg-blue-50 transition-colors relative';
        });
        mostrarBotonGuardar();
        ocultarMenuContextual();
    });

    document.getElementById('btnMenuCopiarFormato').addEventListener('click', () => iniciarModoCopiar("FORMATO"));
    document.getElementById('btnMenuCopiarSector').addEventListener('click', () => iniciarModoCopiar("AMBOS"));

    function iniciarModoCopiar(tipo) {
        const seleccionadas = document.querySelectorAll('.celda-seleccionada');
        if (seleccionadas.length === 0) {
            alert("Primero selecciona las celdas donde deseas pegar.");
            ocultarMenuContextual(); return;
        }

        guardarProgramacionTemporal();

        tipoPegadoSeleccionado = tipo;
        celdasDestinoCopiar = Array.from(seleccionadas).map(c => ({
            actId: c.getAttribute('data-act'),
            fecha: c.getAttribute('data-fecha')
        }));
        modoCopiarOrigenActivo = true;

        const banner = document.getElementById('bannerModoPegado');
        if (banner) {
            let texto = tipo === "FORMATO" ? "🖌️ Haz clic en el sector origen para copiar el COLOR..." : "📋 Haz clic en el sector origen para copiar NOMBRE Y COLOR...";
            banner.innerHTML = `<span>${texto}</span><button onclick="cancelarModoPegado()" class="ml-4 text-indigo-200 hover:text-white transition-colors">✕ Cancelar</button>`;
            banner.classList.remove('hidden');
        }
        document.body.classList.add('cursor-crosshair');
        ocultarMenuContextual();
    }

    document.getElementById('btnMenuMover').addEventListener('click', () => {
        const seleccionadas = document.querySelectorAll('.celda-seleccionada');
        if (seleccionadas.length === 0) return ocultarMenuContextual();

        const actId = seleccionadas[0].getAttribute('data-act');
        const mismaFila = Array.from(seleccionadas).every(c => c.getAttribute('data-act') === actId);

        if (!mismaFila) {
            alert("Para mover un bloque, selecciona celdas pertenecientes a una sola actividad (una sola fila).");
            ocultarMenuContextual();
            return;
        }

        celdasOrigenMover = Array.from(seleccionadas);
        modoMoverActivo = true;

        const bannerMover = document.getElementById('bannerModoMover');
        if (bannerMover) bannerMover.classList.remove('hidden');
        ocultarMenuContextual();
    });

    document.getElementById('btnConfirmarSector').addEventListener('click', () => {
        const nombre = document.getElementById('txtNombreSector').value.trim();
        const color = document.getElementById('txtColorSector').value;
        if (!nombre) return alert("Ingresa un nombre para el sector.");

        const seleccionadas = document.querySelectorAll('.celda-seleccionada');
        seleccionadas.forEach(celda => {
            celda.classList.remove('celda-seleccionada', 'ring-4', 'ring-inset', 'ring-blue-600', 'brightness-75', 'bg-blue-100/50');
            celda.className = `celda-prog border border-slate-300 cursor-pointer transition-colors relative font-bold text-[9px] text-center shadow-inner`;
            celda.style.backgroundColor = color;
            celda.style.color = obtenerColorTextoContraste(color);
            celda.innerHTML = nombre;
        });

        mostrarBotonGuardar();
        document.getElementById('modalSector').classList.add('hidden');
    });

    document.getElementById('btnConfirmarPegado').addEventListener('click', () => {
        guardarProgramacionTemporal();

        let rolActivo = AppState.rolRenderizadoActual;

        celdasDestinoCopiar.forEach(dest => {
            let idx = AppState.memoriaProgramacion.findIndex(p => p.idActividad === dest.actId && p.fecha === dest.fecha && String(p.rol).toUpperCase() === String(rolActivo).toUpperCase());

            let nombreFinal = "";
            let colorFinal = portapapelesFormato.color;

            if (tipoPegadoSeleccionado === "FORMATO") {
                if (idx >= 0) {
                    nombreFinal = AppState.memoriaProgramacion[idx].sector;
                } else {
                    let celdaPantalla = document.querySelector(`.celda-prog[data-act="${dest.actId}"][data-fecha="${dest.fecha}"]`);
                    if (celdaPantalla) nombreFinal = celdaPantalla.innerText.trim();
                }
            } else {
                nombreFinal = portapapelesFormato.nombre;
            }

            if (idx >= 0) {
                AppState.memoriaProgramacion[idx].sector = nombreFinal;
                AppState.memoriaProgramacion[idx].color = colorFinal;
            } else {
                AppState.memoriaProgramacion.push({
                    idActividad: dest.actId,
                    fecha: dest.fecha,
                    sector: nombreFinal,
                    color: colorFinal,
                    rol: rolActivo
                });
            }
        });

        renderizarAmbasTablas();
        mostrarBotonGuardar();
        cancelarModoPegado();
    });

    function cancelarModoPegado() {
        modoCopiarOrigenActivo = false;
        celdasDestinoCopiar = [];
        const bannerPegado = document.getElementById('bannerModoPegado');
        if (bannerPegado) bannerPegado.classList.add('hidden');
        document.getElementById('modalConfirmarPegado').classList.add('hidden');
        document.querySelectorAll('.celda-seleccionada').forEach(c => toggleCelda(c, false));
        document.body.classList.remove('cursor-crosshair');
    }

    function cancelarModoMover() {
        modoMoverActivo = false;
        celdasOrigenMover.forEach(c => toggleCelda(c, false));
        celdasOrigenMover = [];
        const bannerMover = document.getElementById('bannerModoMover');
        if (bannerMover) bannerMover.classList.add('hidden');
    }

    // ==========================================
    // CONFIGURACIÓN DE LÍNEA DE TIEMPO
    // ==========================================
    function abrirModalConfigSemanas() {
        if (AppState.configProyecto.fechaLunesBase) {
            document.getElementById('txtFechaLunes').value = AppState.configProyecto.fechaLunesBase;
            document.getElementById('txtSemanaInicio').value = AppState.configProyecto.semanaInicio;
        }
        document.getElementById('modalConfigSemanas').classList.remove('hidden');
    }

    document.getElementById('btnGuardarConfigSemanas').addEventListener('click', async () => {
        const fecha = document.getElementById('txtFechaLunes').value;
        const sem = parseInt(document.getElementById('txtSemanaInicio').value);

        if (!fecha || isNaN(sem)) return alert("Completa todos los campos correctamente.");

        let d = new Date(fecha + "T00:00:00");
        if (d.getDay() !== 1) return alert("La fecha seleccionada DEBE ser un Lunes para iniciar la semana.");

        const btn = document.getElementById('btnGuardarConfigSemanas');
        btn.innerText = "Guardando..."; btn.disabled = true;

        try {
            const res = await API.guardarConfiguracionProyecto(AppState.currentSheetsId, fecha, sem);
            if (res.success) {
                document.getElementById('modalConfigSemanas').classList.add('hidden');
                cargarLookAhead(AppState.currentSheetsId);
            } else { alert("Error: " + res.message); }
        } catch (e) { alert("Error de red."); } finally {
            btn.innerText = "Guardar y Recalcular"; btn.disabled = false;
        }
    });

    // =========================================================
// 8. EXPORTAR LOOK-AHEAD A PDF (POR BLOQUES SEMANALES)
// =========================================================
document.getElementById('btnExportarPDFLA').addEventListener('click', () => {
    // 1. VALIDACIÓN
    if (!AppState.memoriaCache || AppState.memoriaCache.length === 0) {
        alert("⚠️ No hay datos en el Look-Ahead para exportar.");
        return;
    }

    const btn = document.getElementById('btnExportarPDFLA');
    const originalText = btn.innerHTML;
    btn.innerHTML = `⏳ <span class="hidden sm:inline ml-1">Abriendo...</span>`;
    btn.disabled = true;

    // 2. RECOLECTAR METADATOS
    const nombreProyecto = document.getElementById('lblNombreProyecto').innerText;
    const cmb = document.getElementById('cmbHistorialVersiones');
    const valCmb = cmb.value;
    const textoOpcion = cmb.options[cmb.selectedIndex].text;
    
    let modoLectura = valCmb !== "ACTUAL";
    let rolEvaluado = AppState.rolRenderizadoActual;
    let fechaReporte = "";
    let nombreVersion = valCmb;

    if (modoLectura) {
        let matchFecha = textoOpcion.match(/•\s*(.*?)\s*\(/);
        fechaReporte = matchFecha ? matchFecha[1].trim() : "Histórico";
        let matchRol = textoOpcion.match(/\)\s*-\s*(.*)/);
        if (matchRol) rolEvaluado = matchRol[1].trim();
    } else {
        const d = new Date();
        fechaReporte = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    // 3. OBTENER EL BLOQUE DE 4 SEMANAS
    const bloque = listadoSemanasGlobal.slice(indiceSemanaActual, indiceSemanaActual + 4);
    if (bloque.length === 0) {
        alert("No hay un rango de semanas configurado.");
        btn.innerHTML = originalText; btn.disabled = false; return;
    }

    let dataAct = modoLectura ? (AppState.memoriaHistorial1.actividades || AppState.memoriaHistorial1) : AppState.memoriaCache.filter(a => a.estado !== 'ELIMINADO');
    let dataProg = modoLectura ? (AppState.memoriaHistorial1.programacion || []) : AppState.memoriaProgramacion;
    
    dataAct.sort((a, b) => String(a.indice).localeCompare(String(b.indice), undefined, { numeric: true }));

    // 4. BUCLE DE GENERACIÓN DE SEMANAS
    const diasNombres = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    let paginasHTML = '';

    bloque.forEach((semInfo, indexSemana) => {
        let partes = semInfo.fecha.split('-');
        let dLunes = new Date(partes[0], parseInt(partes[1]) - 1, partes[2]);
        let fechasSemanaActual = [];
        let htmlCabeceraDias = '';
        
        for (let i = 0; i < 7; i++) {
            let f = new Date(dLunes);
            f.setDate(dLunes.getDate() + i);
            let fStr = `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`;
            fechasSemanaActual.push(fStr);
            
            htmlCabeceraDias += `<th style="width: 7%; border: 1px solid #cbd5e1; background-color: #f1f5f9; color: #334155; padding: 8px 4px; font-size: 10px;">${fStr.substring(0, 5)}<br><span style="font-weight: normal; font-size: 9px;">${diasNombres[i]}</span></th>`;
        }

        let htmlFilasActividades = '';
        dataAct.forEach(act => {
            if (act.id.startsWith('ENC') || act.tipo === 'ENCABEZADO') {
                htmlFilasActividades += `
                    <tr class="evitar-quiebre" style="background-color: #fef08a; color: #854d0e; font-weight: 900; font-size: 11px;">
                        <td style="width: 4%; border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center;">${act.indice}</td>
                        <td style="width: 32%; border: 1px solid #cbd5e1; text-align: left; padding-left: 8px;">${act.descripcion}</td>
                        <td style="width: 5%; border: 1px solid #cbd5e1; text-align: center;"></td>
                        <td style="width: 10%; border: 1px solid #cbd5e1; text-align: center;"></td>
                        <td colspan="7" style="border: 1px solid #cbd5e1; background-color: #fef08a;"></td>
                    </tr>`;
            } else {
                let celdasHTML = '';
                let tieneDatosSemana = false;

                fechasSemanaActual.forEach(fStr => {
                    let p = dataProg.find(x => x.idActividad === act.id && normFecha(x.fecha) === fStr && String(x.rol || "RESIDENTE").trim().toUpperCase() === String(rolEvaluado).toUpperCase());
                    
                    if (p && (p.sector || p.color)) {
                        tieneDatosSemana = true;
                        let textColor = obtenerColorTextoContraste(p.color);
                        celdasHTML += `<td style="border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; color: ${textColor}; font-weight: bold; background-color: ${p.color};">${p.sector || ''}</td>`;
                    } else {
                        celdasHTML += `<td style="border: 1px solid #cbd5e1; background-color: #f8fafc;"></td>`;
                    }
                });
                
                // Opcional: Si quieres que se impriman solo las actividades que tienen datos en esta semana,
                // puedes descomentar la siguiente línea:
                // if(!tieneDatosSemana) return; 

                htmlFilasActividades += `
                    <tr class="evitar-quiebre">
                        <td style="border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; font-weight: bold; color: #64748b;">${act.indice}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 4px; text-align: left; padding-left: 8px; font-weight: bold; color: #1e293b;">${act.descripcion}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; color: #64748b; font-size: 9px;">${act.unidad || ''}</td>
                        <td style="border: 1px solid #cbd5e1; padding: 6px 4px; text-align: center; color: #64748b; font-size: 9px;">${act.scRubro || ''}</td>
                        ${celdasHTML}
                    </tr>`;
            }
        });

        let pageBreak = (indexSemana < bloque.length - 1) ? '<div class="page-break"></div>' : '';

        // 5. ENSAMBLAR LA TABLA CON EL TÍTULO DENTRO DEL THEAD
        // ¡Esto hace que el título se repita en cada hoja si la semana ocupa más de 1 página!
        paginasHTML += `
        <div class="hoja">
            <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 10px;">
                <thead style="display: table-header-group;">
                    <tr>
                        <td colspan="11" style="border: none; padding: 0; background: white; text-align: left;">
                            <div style="display: flex; border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 15px; align-items: flex-end;">
                                <div style="flex-grow: 1;">
                                    <h1 style="margin: 0; font-size: 22px; text-transform: uppercase; color: #0f172a; letter-spacing: 1px;">Look-Ahead (Semana ${semInfo.semana})</h1>
                                    <h2 style="margin: 5px 0 0 0; font-size: 14px; color: #2563eb;">Proyecto: ${nombreProyecto}</h2>
                                </div>
                                <div style="text-align: right; font-size: 11px; line-height: 1.5; color: #64748b;">
                                    <p style="margin:2px 0;"><span style="font-weight: bold; color: #0f172a;">Fecha Reporte:</span> ${fechaReporte}</p>
                                    <p style="margin:2px 0;"><span style="font-weight: bold; color: #0f172a;">Versión Base:</span> ${nombreVersion}</p>
                                    <p style="margin:2px 0;"><span style="font-weight: bold; color: #0f172a;">Rol Evaluado:</span> ${rolEvaluado}</p>
                                    <p style="margin:2px 0;"><span style="font-weight: bold; color: #0f172a;">Rango Total:</span> Semanas ${bloque[0].semana} al ${bloque[bloque.length-1].semana}</p>
                                </div>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <th style="width: 4%; background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 4px; font-weight: bold;">ÍNDICE</th>
                        <th style="width: 32%; background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 4px; font-weight: bold; text-align:left; padding-left:8px;">DESCRIPCIÓN DE LA ACTIVIDAD</th>
                        <th style="width: 5%; background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 4px; font-weight: bold;">UND</th>
                        <th style="width: 10%; background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 8px 4px; font-weight: bold;">SC / RUBRO</th>
                        ${htmlCabeceraDias}
                    </tr>
                </thead>
                <tbody>
                    ${htmlFilasActividades}
                </tbody>
            </table>
        </div>
        ${pageBreak}
        `;
    });

    // 6. INYECTAR EN PLANTILLA FINAL
    const htmlPlantilla = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Look-Ahead Semanas ${bloque[0].semana}-${bloque[bloque.length-1].semana}</title>
        <style>
            @page { size: A4 landscape; margin: 10mm 12mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background-color: white; color: #333; font-size: 11px; }
            .evitar-quiebre { page-break-inside: avoid; break-inside: avoid; }
            .page-break { page-break-after: always; }
            .hoja { width: 100%; }
        </style>
    </head>
    <body>
        ${paginasHTML}
        <script>
            setTimeout(() => { window.print(); }, 800);
        </script>
    </body>
    </html>`;

    const ventanaPDF = window.open('', '_blank');
    ventanaPDF.document.write(htmlPlantilla);
    ventanaPDF.document.close(); 

    btn.innerHTML = originalText;
    btn.disabled = false;
});