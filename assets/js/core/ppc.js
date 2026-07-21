
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

    // =========================================================
    // 1. INICIALIZACIÓN (Se llama al cambiar de pestaña)
    // =========================================================
    async function cargarVistaPPC() {
        // Llenar combo de Base Look-Ahead
        const cmbBase = document.getElementById('cmbVersionPPC');
        cmbBase.innerHTML = '<option value="">Seleccione Versión Base...</option>';
        listaVersionesGlobal.forEach(v => {
            let fechaLimpia = v.fecha;
            if (fechaLimpia.includes("GMT")) {
                let d = new Date(fechaLimpia);
                if (!isNaN(d)) fechaLimpia = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            }
            cmbBase.innerHTML += `<option value="${v.numero}">${v.numero} • ${fechaLimpia} (${v.rol})</option>`;
        });

        const cmbSem = document.getElementById('cmbSemanaPPC');
        let semInicio = parseInt(configProyecto.semanaInicio) || 1;
        cmbSem.innerHTML = `
            <option value="1">Semana ${semInicio}</option>
            <option value="2">Semana ${semInicio + 1}</option>
            <option value="3">Semana ${semInicio + 2}</option>
            <option value="4">Semana ${semInicio + 3}</option>
        `;

        // Configuración de botones de guardado según rol
        if (["SC", "RUBRO", "STAFF"].includes(rolGlobalReal)) {
            document.getElementById('btnGuardarBorradorPPC').classList.add('hidden');
            document.getElementById('btnRegistrarVersionPPC').classList.add('hidden');
        } else {
            document.getElementById('btnGuardarBorradorPPC').classList.remove('hidden');
            document.getElementById('btnGuardarBorradorPPC').classList.add('flex');
            document.getElementById('btnRegistrarVersionPPC').classList.remove('hidden');
            document.getElementById('btnRegistrarVersionPPC').classList.add('flex');
        }

        if (rolGlobalReal === "ADMIN") {
            const cmbRolPPC = document.getElementById('cmbRolSimuladoPPC');
            if (cmbRolPPC) {
                cmbRolPPC.classList.remove('hidden');
                cmbRolPPC.addEventListener('change', () => {
                    if(!modoLecturaPPC) document.getElementById('btnCargarPPC').click();
                });
            }
        }

        // 🟢 NUEVO: Llenar el Historial de PPC desde la base de datos
        try {
            const res = await API.obtenerListaVersionesPPC(currentSheetsId);
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
            
            if (!["SC", "RUBRO", "STAFF"].includes(rolGlobalReal)) {
                btnGuardar.classList.remove('hidden'); btnGuardar.classList.add('flex');
                btnRegistrar.classList.remove('hidden'); btnRegistrar.classList.add('flex');
            }
            document.getElementById('tbodyPPC').innerHTML = '<tr><td colspan="11" class="text-center py-10 text-gray-500 font-semibold">Modo Edición activado. Ajusta los filtros y haz clic en "Cargar Datos".</td></tr>';
            document.getElementById('tfootPPC').classList.add('hidden');
        
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
                    ppc_borradores = data.resultadosPPC || []; // En el JSON, estos son los achurados guardados

                    // Reconstruimos las fechas basándonos en la Semana guardada en el JSON
                    let numSemana = data.semanaEvaluada.match(/\d+/);
                    let idxSemana = numSemana ? parseInt(numSemana[0]) : 1;
                    
                    let semInicioObra = parseInt(configProyecto.semanaInicio) || 1;
                    let difSemana = idxSemana - semInicioObra; // Diferencia respecto a la semana 1
                    
                    let dLunes = new Date(configProyecto.fechaLunesBase + "T00:00:00");
                    dLunes.setDate(dLunes.getDate() + (difSemana * 7));
                    
                    ppc_fechasSemana = [];
                    for (let i = 0; i < 7; i++) {
                        let f = new Date(dLunes);
                        f.setDate(dLunes.getDate() + i);
                        ppc_fechasSemana.push(`${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`);
                    }

                    // Determinar de quién era el plan base
                    let rolPlanBase = "RESIDENTE";
                    const vInfo = listaVersionesGlobal.find(v => v.numero === data.baseEvaluada);
                    if (vInfo && vInfo.rol) rolPlanBase = String(vInfo.rol).trim().toUpperCase();

                    renderizarTablaPPC("LECTURA_JSON", rolPlanBase);
                } else { throw new Error(resJSON.message); }
            } catch(e) {
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

        let dLunes = new Date(configProyecto.fechaLunesBase + "T00:00:00");
        dLunes.setDate(dLunes.getDate() + ((semanaRelativa - 1) * 7));
        
        ppc_fechasSemana = [];
        for (let i = 0; i < 7; i++) {
            let f = new Date(dLunes);
            f.setDate(dLunes.getDate() + i);
            ppc_fechasSemana.push(`${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`);
        }

        let rolEvaluar = "RESIDENTE";
        if (rolGlobalReal === "ADMIN") {
            let cmbRol = document.getElementById('cmbRolSimuladoPPC');
            if (cmbRol) rolEvaluar = cmbRol.value;
        } else if (["STAFF", "SC", "RUBRO"].includes(rolGlobalReal)) {
            rolEvaluar = "RESIDENTE"; 
        } else {
            rolEvaluar = rolGlobalReal;
        }

        const versionInfo = listaVersionesGlobal.find(v => v.numero === versionBase);
        const rolVersionBase = versionInfo && versionInfo.rol ? String(versionInfo.rol).trim().toUpperCase() : "RESIDENTE";

        try {
            const resLA = await API.obtenerVersionAntigua(currentSheetsId, versionBase);
            if (!resLA.success) throw new Error(resLA.message);
            
            ppc_actividades = resLA.actividades.actividades || [];
            ppc_programacion = resLA.actividades.programacion || [];

            let nomSemanaReal = document.getElementById('cmbSemanaPPC').options[document.getElementById('cmbSemanaPPC').selectedIndex].text;
            
            const resPPC = await API.obtenerDatosPPC(currentSheetsId, versionBase, nomSemanaReal, rolEvaluar);
            
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
            htmlDias += `<th class="th-fecha-ppc px-2 py-2 border border-slate-300 font-semibold w-12 sm:w-16">${fStr.substring(0,5)}<br><span class="font-normal text-gray-500">${diasNombres[index]}</span></th>`;
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
        if(pctNum >= 85) lblPct.className = "px-2 py-2 text-center bg-slate-900 text-green-400 border-l border-slate-600 text-lg font-black";
        else if(pctNum >= 70) lblPct.className = "px-2 py-2 text-center bg-slate-900 text-yellow-400 border-l border-slate-600 text-lg font-black";
        else lblPct.className = "px-2 py-2 text-center bg-slate-900 text-red-500 border-l border-slate-600 text-lg font-black";
    }

    // =========================================================
    // 4. INTERACCIÓN DE ACHURADO (TOGGLE Y MODAL)
    // =========================================================
    function inicializarClicsPPC() {
        if (modoLecturaPPC) return; // 🟢 CANDADO: Si es el JSON Histórico, no se puede hacer clic en nada.

        const celdas = document.querySelectorAll('.celda-ppc');
        celdas.forEach(c => {
            c.addEventListener('click', function() {
                if (!puedeEditarEstructura) return; 

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
        if (rolGlobalReal === "ADMIN") {
            let cmbRol = document.getElementById('cmbRolSimuladoPPC');
            if (cmbRol) rolGuardar = cmbRol.value;
        } else {
            rolGuardar = rolGlobalReal;
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
            const res = await API.guardarBorradorPPC(currentSheetsId, versionBase, nomSemanaReal, rolGuardar, datosGuardar);
            if (res.success) {
                btn.innerHTML = `✅ <span class="hidden sm:inline ml-1">¡Guardado!</span>`;
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
        if (rolGlobalReal === "ADMIN") {
            let cmb = document.getElementById('cmbRolSimuladoPPC');
            if (cmb) rolUsuario = cmb.value;
        } else {
            rolUsuario = rolGlobalReal;
        }

        const sessionProy = JSON.parse(sessionStorage.getItem('proyectoActivo'));
        const jsonFolderIdPPC = sessionProy ? sessionProy.jsonFolderPPC : ""; 

        try {
            document.getElementById('btnGuardarBorradorPPC').click();
            
            setTimeout(async () => {
                const res = await API.guardarVersionPPC(currentSheetsId, comentario, idUsuario, nomSemanaReal, rolUsuario, versionBase, jsonFolderIdPPC);
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
    // 7. EXPORTAR TABLA A PDF (MEDIANTE CAPTURA PERFECTA)
    // =========================================================
    document.getElementById('btnExportarPDFPPC').addEventListener('click', () => {
        const btn = document.getElementById('btnExportarPDFPPC');
        const originalText = btn.innerHTML;
        btn.innerHTML = `⏳ <span class="hidden sm:inline ml-1">Generando PDF...</span>`;
        btn.disabled = true;

        const contenedor = document.getElementById('contenedorTablaPPC');

        // 1. Quitar los límites de scroll temporalmente para expandir la tabla
        contenedor.classList.remove('max-h-[60vh]', 'overflow-auto');
        contenedor.style.maxHeight = 'none';
        contenedor.style.overflow = 'visible';

        // 2. Apagar el efecto "inmovilizado" (sticky)
        const elementosSticky = contenedor.querySelectorAll('.sticky');
        elementosSticky.forEach(el => {
            el.style.setProperty('position', 'static', 'important');
        });

        // 3. Darle 300ms al navegador para redibujar y luego tomar la foto
        setTimeout(() => {
            html2canvas(contenedor, {
                scale: 2, // Alta resolución
                useCORS: true,
                backgroundColor: '#ffffff'
            }).then(canvas => {
                // 4. Restaurar la vista web a la normalidad
                contenedor.classList.add('max-h-[60vh]', 'overflow-auto');
                contenedor.style.maxHeight = '';
                contenedor.style.overflow = '';
                elementosSticky.forEach(el => {
                    el.style.removeProperty('position');
                });

                // 5. Convertir el Canvas a una imagen JPG de alta calidad
                const imgData = canvas.toDataURL('image/jpeg', 0.98);

                // 6. Crear el PDF (A4 en formato Horizontal/Landscape)
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('l', 'mm', 'a4'); 

                // Calcular escalas para que la imagen encaje perfecto en la hoja
                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = doc.internal.pageSize.getHeight();
                const margin = 10; // 10mm de margen
                const maxImgWidth = pdfWidth - (margin * 2);
                const maxImgHeight = pdfHeight - (margin * 2);

                const imgProps = doc.getImageProperties(imgData);
                let finalWidth = maxImgWidth;
                let finalHeight = (imgProps.height * finalWidth) / imgProps.width;

                // Si la imagen sigue siendo muy alta, escalarla por el alto en su lugar
                if (finalHeight > maxImgHeight) {
                    finalHeight = maxImgHeight;
                    finalWidth = (imgProps.width * finalHeight) / imgProps.height;
                }

                // Centrar horizontalmente si sobra espacio
                const x = (pdfWidth - finalWidth) / 2;
                const y = margin; // Pegado arriba respetando el margen

                // Insertar la imagen y guardar el PDF
                doc.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
                
                const semana = document.getElementById('cmbSemanaPPC').options[document.getElementById('cmbSemanaPPC').selectedIndex].text;
                const version = document.getElementById('cmbVersionPPC').value || 'Base';
                const nombreArchivo = `Reporte_PPC_${semana}_${version}.pdf`.replace(/ /g, "_");
                
                doc.save(nombreArchivo);

                btn.innerHTML = originalText;
                btn.disabled = false;
            }).catch(err => {
                console.error(err);
                alert("Error al generar el PDF.");
                btn.innerHTML = originalText;
                btn.disabled = false;
            });
        }, 300);
    });