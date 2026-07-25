// ==========================================================
// MÓDULO: RESTRICCIONES
// ==========================================================

let restricciones_registros = [];
let restricciones_filtroEstado = '';
let restricciones_cargado = false;

// 1. INICIALIZACIÓN
async function cargarVistaRestricciones() {
    if (restricciones_cargado) {
        renderizarTablaRestricciones();
        return;
    }
    _restricciones_setLoadingState(true);

    try {
        const res = await API.obtenerRestricciones(AppState.currentSheetsId);
        if (res.success) {
            restricciones_registros = res.restricciones || [];
            restricciones_cargado = true;
            renderizarTablaRestricciones();
        } else {
            _restricciones_mostrarError('Error al cargar datos: ' + res.message);
        }
    } catch (e) {
        _restricciones_mostrarError('Error de conexión con el servidor.');
        console.error(e);
    } finally {
        _restricciones_setLoadingState(false);
    }
}

// 2. RENDERIZADO
function renderizarTablaRestricciones() {
    const tbody = document.getElementById('tbodyRestricciones');
    if (!tbody) return;

    let lista = restricciones_registros.filter(r => {
        return !restricciones_filtroEstado || r.estado === restricciones_filtroEstado;
    });

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-gray-400 font-semibold">
            <div class="flex flex-col items-center gap-2">
                <span class="text-4xl">🚧</span>
                <span>No hay restricciones registradas para los filtros actuales.</span>
                <span class="text-xs">Haz clic en "＋ Nueva Restricción" para agregar una.</span>
            </div>
        </td></tr>`;
        return;
    }

    // Ordenar por fecha requerida
    lista.sort((a, b) => {
        const fa = new Date(a.fechaRequerida || 0);
        const fb = new Date(b.fechaRequerida || 0);
        return fa - fb;
    });

    tbody.innerHTML = lista.map(r => {
        const estadoBadge = _restricciones_getBadgeEstado(r.estado);
        const actividad = r.idActividad ? _restricciones_getNombreActividad(r.idActividad) : '—';
        return `
        <tr class="border-b border-gray-100 hover:bg-red-50/40 transition-colors">
            <td class="px-3 py-2.5 text-center font-bold text-xs text-gray-500">${r.id || 'N/A'}</td>
            <td class="px-3 py-2.5 text-left text-sm font-semibold text-gray-800">${r.descripcion}</td>
            <td class="px-3 py-2.5 text-left text-xs text-gray-600 truncate max-w-[150px]" title="${actividad}">${actividad}</td>
            <td class="px-3 py-2.5 text-center text-xs font-medium text-gray-700">${r.responsable || '—'}</td>
            <td class="px-3 py-2.5 text-center text-xs text-gray-600">${_restricciones_formatFecha(r.fechaIdentificacion)}</td>
            <td class="px-3 py-2.5 text-center text-xs text-red-600 font-bold">${_restricciones_formatFecha(r.fechaRequerida)}</td>
            <td class="px-3 py-2.5 text-center">${estadoBadge}</td>
        </tr>`;
    }).join('');
}

// 3. GUARDAR REGISTRO
async function guardarNuevaRestriccion() {
    const btnGuardar = document.getElementById('btnConfirmarRestriccion');
    const descripcion = document.getElementById('txtDescRestriccion').value.trim();
    const idActividad = document.getElementById('cmbActividadRestriccion').value;
    const responsable = document.getElementById('txtResponsableRestriccion').value.trim();
    const estado = document.getElementById('cmbEstadoRestriccion').value;
    const fechaIdentificacion = document.getElementById('txtFechaIdenRestriccion').value;
    const fechaRequerida = document.getElementById('txtFechaReqRestriccion').value;

    if (!descripcion || !fechaRequerida) {
        alert('⚠️ Debes ingresar al menos la descripción y la fecha requerida.');
        return;
    }

    const registro = {
        descripcion,
        idActividad,
        responsable,
        estado,
        fechaIdentificacion,
        fechaRequerida,
        creadoPor: AppState.rolGlobalReal
    };

    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando...';

    try {
        const res = await API.guardarRestriccion(AppState.currentSheetsId, registro);
        if (res.success) {
            restricciones_registros.push({
                id: res.newId,
                ...registro
            });
            cerrarModalRestriccion();
            renderizarTablaRestricciones();
            if (typeof _diario_showToast === 'function') _diario_showToast('✅ Restricción guardada correctamente.');
        } else {
            alert('❌ Error al guardar: ' + res.message);
        }
    } catch (e) {
        alert('❌ Error de conexión.');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = 'Guardar Restricción';
    }
}

// 4. MODAL
function abrirModalRestriccion() {
    const cmb = document.getElementById('cmbActividadRestriccion');
    cmb.innerHTML = '<option value="">— Ninguna (General) —</option>';
    if (AppState.memoriaCache) {
        AppState.memoriaCache
            .filter(a => a.tipo === 'ACTIVIDAD')
            .forEach(a => {
                cmb.innerHTML += `<option value="${a.id}">[${a.indice}] ${a.descripcion}</option>`;
            });
    }

    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('txtFechaIdenRestriccion').value = hoy;
    
    let enUnaSemana = new Date();
    enUnaSemana.setDate(enUnaSemana.getDate() + 7);
    document.getElementById('txtFechaReqRestriccion').value = enUnaSemana.toISOString().split('T')[0];

    document.getElementById('txtDescRestriccion').value = '';
    document.getElementById('txtResponsableRestriccion').value = '';
    document.getElementById('cmbEstadoRestriccion').value = 'ABIERTO';

    document.getElementById('modalNuevaRestriccion').classList.remove('hidden');
}

function cerrarModalRestriccion() {
    document.getElementById('modalNuevaRestriccion').classList.add('hidden');
}

// 5. UTILIDADES INTERNAS
function _restricciones_getBadgeEstado(estado) {
    const mapa = {
        'ABIERTO':    { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Abierto' },
        'EN PROCESO': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'En Proceso' },
        'CERRADO':    { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Cerrado' },
    };
    const s = String(estado).toUpperCase();
    const cfg = mapa[s] || { bg: 'bg-gray-100', text: 'text-gray-600', label: estado || '—' };
    return `<span class="${cfg.bg} ${cfg.text} text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">${cfg.label}</span>`;
}

function _restricciones_formatFecha(fechaStr) {
    if (!fechaStr) return '—';
    if (fechaStr.includes('-')) {
        const parts = fechaStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return fechaStr;
}

function _restricciones_getNombreActividad(idActividad) {
    if (!AppState.memoriaCache) return idActividad;
    const act = AppState.memoriaCache.find(a => a.id === idActividad);
    return act ? act.descripcion : idActividad;
}

function _restricciones_setLoadingState(loading) {
    const tbody = document.getElementById('tbodyRestricciones');
    if (!tbody) return;
    if (loading) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400 animate-pulse font-semibold">
            Cargando restricciones...
        </td></tr>`;
    }
}

function _restricciones_mostrarError(msg) {
    const tbody = document.getElementById('tbodyRestricciones');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="py-10 text-center text-red-500 font-semibold">❌ ${msg}</td></tr>`;
}

// 6. EVENTOS
document.addEventListener('DOMContentLoaded', () => {
    const btnNueva = document.getElementById('btnNuevaRestriccion');
    if (btnNueva) btnNueva.addEventListener('click', abrirModalRestriccion);

    const btnConfirmar = document.getElementById('btnConfirmarRestriccion');
    if (btnConfirmar) btnConfirmar.addEventListener('click', guardarNuevaRestriccion);

    const btnCancelar = document.getElementById('btnCancelarRestriccion');
    if (btnCancelar) btnCancelar.addEventListener('click', cerrarModalRestriccion);

    const filtroEstado = document.getElementById('filtroRestriccionEstado');
    if (filtroEstado) filtroEstado.addEventListener('change', (e) => {
        restricciones_filtroEstado = e.target.value;
        renderizarTablaRestricciones();
    });

    const btnRecargar = document.getElementById('btnRecargarRestricciones');
    if (btnRecargar) btnRecargar.addEventListener('click', () => {
        restricciones_cargado = false;
        cargarVistaRestricciones();
    });
});
