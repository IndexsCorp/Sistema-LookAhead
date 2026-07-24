// ==========================================================
// MÓDULO: CONTROL DIARIO
// ==========================================================

// Estado local del módulo
let diario_registros = [];
let diario_filtroFecha = '';
let diario_filtroSC = '';
let diario_cargado = false;

// ----------------------------------------------------------
// 1. INICIALIZACIÓN — llamada al activar la pestaña
// ----------------------------------------------------------
async function cargarVistaDiario() {
    if (diario_cargado) {
        renderizarTablaDiario();
        return;
    }
    _diario_setLoadingState(true);

    try {
        const res = await API.obtenerDatosDiario(AppState.currentSheetsId);
        if (res.success) {
            diario_registros = res.diario || [];
            diario_cargado = true;
            _diario_poblarFiltros();
            renderizarTablaDiario();
        } else {
            _diario_mostrarError('Error al cargar datos: ' + res.message);
        }
    } catch (e) {
        _diario_mostrarError('Error de conexión con el servidor.');
        console.error(e);
    } finally {
        _diario_setLoadingState(false);
    }
}

// ----------------------------------------------------------
// 2. RENDERIZADO DE TABLA
// ----------------------------------------------------------
function renderizarTablaDiario() {
    const tbody = document.getElementById('tbodyDiario');
    if (!tbody) return;

    // Filtrar
    let lista = diario_registros.filter(r => {
        const matchFecha = !diario_filtroFecha || r.fecha.includes(diario_filtroFecha);
        const matchSC = !diario_filtroSC || r.sector === diario_filtroSC || _diario_getNombreActividad(r.idActividad).toLowerCase().includes(diario_filtroSC.toLowerCase());
        return matchFecha && matchSC;
    });

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="py-12 text-center text-gray-400 font-semibold">
            <div class="flex flex-col items-center gap-2">
                <span class="text-4xl">📋</span>
                <span>No hay registros de Control Diario para los filtros seleccionados.</span>
                <span class="text-xs">Haz clic en "＋ Nuevo Registro" para agregar el primero.</span>
            </div>
        </td></tr>`;
        return;
    }

    // Ordenar por fecha descendente
    lista.sort((a, b) => {
        const fa = _diario_parseFecha(a.fecha);
        const fb = _diario_parseFecha(b.fecha);
        return fb - fa;
    });

    tbody.innerHTML = lista.map(r => {
        const actividad = _diario_getNombreActividad(r.idActividad);
        const estadoBadge = _diario_getBadgeEstado(r.estado);
        const fechaDisplay = _diario_formatFechaDisplay(r.fecha);
        return `
        <tr class="border-b border-gray-100 hover:bg-blue-50/40 transition-colors group">
            <td class="px-3 py-2.5 text-left">
                <span class="font-semibold text-gray-700 text-xs">${fechaDisplay}</span>
            </td>
            <td class="px-3 py-2.5 text-left">
                <span class="text-xs text-gray-800 font-medium leading-tight block max-w-[200px] truncate" title="${actividad}">${actividad || r.idActividad}</span>
            </td>
            <td class="px-3 py-2.5 text-center">
                <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${r.sector || '—'}</span>
            </td>
            <td class="px-3 py-2.5 text-center">
                <span class="font-bold text-blue-700 text-sm">${r.avance || '0'}</span>
            </td>
            <td class="px-3 py-2.5 text-center">
                <span class="text-xs text-gray-600">${r.personalHH || '—'}</span>
            </td>
            <td class="px-3 py-2.5 text-center">
                <span class="text-xs text-gray-600">${r.equipos || '—'}</span>
            </td>
            <td class="px-3 py-2.5 text-left max-w-[180px]">
                <span class="text-xs text-gray-500 truncate block" title="${r.hallazgos}">${r.hallazgos || '—'}</span>
            </td>
            <td class="px-3 py-2.5 text-center">${estadoBadge}</td>
            <td class="px-3 py-2.5 text-center text-xs text-gray-400 font-mono">${r.rolReporte || '—'}</td>
        </tr>`;
    }).join('');
}

// ----------------------------------------------------------
// 3. GUARDAR REGISTRO
// ----------------------------------------------------------
async function guardarNuevoRegistroDiario() {
    const btnGuardar = document.getElementById('btnConfirmarRegistroDiario');
    const idActividad = document.getElementById('cmbActividadDiario').value;
    const fecha = document.getElementById('txtFechaDiario').value;
    const sector = document.getElementById('txtSectorDiario').value.trim().toUpperCase();
    const avance = document.getElementById('txtAvanceDiario').value.trim();
    const personalHH = document.getElementById('txtPersonalHH').value.trim();
    const equipos = document.getElementById('txtEquiposDiario').value.trim();
    const hallazgos = document.getElementById('txtHallazgosDiario').value.trim();

    if (!idActividad || !fecha) {
        alert('⚠️ Debes seleccionar una actividad y una fecha.');
        return;
    }

    const sessionData = JSON.parse(sessionStorage.getItem('usuarioActivo') || '{}');
    const registro = {
        idActividad,
        fecha,
        sector,
        avance,
        personalHH,
        equipos,
        hallazgos,
        rolReporte: AppState.rolGlobalReal
    };

    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    try {
        const res = await API.guardarRegistroDiario(AppState.currentSheetsId, registro);
        if (res.success) {
            // Agregar a memoria local
            diario_registros.push({
                id: res.newId,
                ...registro,
                estado: 'PENDIENTE',
                timestamp: new Date().toISOString()
            });
            cerrarModalDiario();
            renderizarTablaDiario();
            _diario_poblarFiltros();
            _diario_showToast('✅ Registro guardado correctamente.');
        } else {
            alert('❌ Error al guardar: ' + res.message);
        }
    } catch (e) {
        alert('❌ Error de conexión.');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar Registro';
    }
}

// ----------------------------------------------------------
// 4. MODAL — Abrir / Cerrar
// ----------------------------------------------------------
function abrirModalDiario() {
    // Poblar dropdown de actividades
    const cmb = document.getElementById('cmbActividadDiario');
    cmb.innerHTML = '<option value="">— Seleccionar actividad —</option>';
    AppState.memoriaCache
        .filter(a => a.tipo === 'ACTIVIDAD')
        .forEach(a => {
            cmb.innerHTML += `<option value="${a.id}">[${a.indice}] ${a.descripcion} (${a.scRubro || 'S/SC'})</option>`;
        });

    // Fecha por defecto = hoy
    const hoy = new Date();
    document.getElementById('txtFechaDiario').value = hoy.toISOString().split('T')[0];

    // Limpiar campos
    ['txtSectorDiario','txtAvanceDiario','txtPersonalHH','txtEquiposDiario','txtHallazgosDiario'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    document.getElementById('modalNuevoRegistroDiario').classList.remove('hidden');
}

function cerrarModalDiario() {
    document.getElementById('modalNuevoRegistroDiario').classList.add('hidden');
}

// ----------------------------------------------------------
// 5. FILTROS
// ----------------------------------------------------------
function _diario_poblarFiltros() {
    // Filtro de Sector
    const cmbSC = document.getElementById('filtroDiarioSC');
    if (!cmbSC) return;
    const sectores = [...new Set(diario_registros.map(r => r.sector).filter(s => s && s !== 'undefined'))];
    cmbSC.innerHTML = '<option value="">Todos los sectores</option>';
    sectores.sort().forEach(s => { cmbSC.innerHTML += `<option value="${s}">${s}</option>`; });
}

// ----------------------------------------------------------
// 6. UTILIDADES INTERNAS
// ----------------------------------------------------------
function _diario_getNombreActividad(idActividad) {
    const act = AppState.memoriaCache.find(a => a.id === idActividad);
    return act ? act.descripcion : idActividad;
}

function _diario_getBadgeEstado(estado) {
    const mapa = {
        'PENDIENTE':  { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
        'APROBADO':   { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Aprobado' },
        'RECHAZADO':  { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Rechazado' },
    };
    const s = String(estado).toUpperCase();
    const cfg = mapa[s] || { bg: 'bg-gray-100', text: 'text-gray-600', label: estado || '—' };
    return `<span class="${cfg.bg} ${cfg.text} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">${cfg.label}</span>`;
}

function _diario_parseFecha(fechaStr) {
    if (!fechaStr) return new Date(0);
    // Soporta YYYY-MM-DD y DD/MM/YYYY
    if (fechaStr.includes('-')) return new Date(fechaStr);
    const p = fechaStr.split('/');
    if (p.length === 3) return new Date(`${p[2]}-${p[1]}-${p[0]}`);
    return new Date(fechaStr);
}

function _diario_formatFechaDisplay(fechaStr) {
    const d = _diario_parseFecha(fechaStr);
    if (isNaN(d)) return fechaStr;
    const dias = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
}

function _diario_setLoadingState(loading) {
    const tbody = document.getElementById('tbodyDiario');
    if (!tbody) return;
    if (loading) {
        tbody.innerHTML = `<tr><td colspan="9" class="py-12 text-center text-slate-400 animate-pulse font-semibold">
            Cargando registros del Control Diario...
        </td></tr>`;
    }
}

function _diario_mostrarError(msg) {
    const tbody = document.getElementById('tbodyDiario');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="9" class="py-10 text-center text-red-500 font-semibold">❌ ${msg}</td></tr>`;
}

function _diario_showToast(msg) {
    const toast = document.getElementById('toastDiario');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('opacity-0', 'pointer-events-none');
    toast.classList.add('opacity-100');
    setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0', 'pointer-events-none');
    }, 3000);
}

// ----------------------------------------------------------
// 7. EVENTOS — se inicializan al cargar el DOM
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Botón nuevo registro
    const btnNuevo = document.getElementById('btnNuevoRegistroDiario');
    if (btnNuevo) btnNuevo.addEventListener('click', abrirModalDiario);

    // Confirmar guardar
    const btnConfirmar = document.getElementById('btnConfirmarRegistroDiario');
    if (btnConfirmar) btnConfirmar.addEventListener('click', guardarNuevoRegistroDiario);

    // Cancelar modal
    const btnCancelar = document.getElementById('btnCancelarRegistroDiario');
    if (btnCancelar) btnCancelar.addEventListener('click', cerrarModalDiario);

    // Filtro fecha
    const filtroFecha = document.getElementById('filtroDiarioFecha');
    if (filtroFecha) filtroFecha.addEventListener('input', (e) => {
        diario_filtroFecha = e.target.value;
        renderizarTablaDiario();
    });

    // Filtro sector
    const filtroSC = document.getElementById('filtroDiarioSC');
    if (filtroSC) filtroSC.addEventListener('change', (e) => {
        diario_filtroSC = e.target.value;
        renderizarTablaDiario();
    });

    // Botón limpiar filtros
    const btnLimpiar = document.getElementById('btnLimpiarFiltrosDiario');
    if (btnLimpiar) btnLimpiar.addEventListener('click', () => {
        diario_filtroFecha = '';
        diario_filtroSC = '';
        if (filtroFecha) filtroFecha.value = '';
        if (filtroSC) filtroSC.value = '';
        renderizarTablaDiario();
    });

    // Botón recargar
    const btnRecargar = document.getElementById('btnRecargarDiario');
    if (btnRecargar) btnRecargar.addEventListener('click', () => {
        diario_cargado = false;
        cargarVistaDiario();
    });
});
