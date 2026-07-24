import re

with open('2. Repositorio GitHub (Frontend)/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# The mains should be inserted after mainPPC
main_diario_html = """
        <!-- CONTENEDOR CONTROL DIARIO -->
        <main id="mainDiario" class="hidden bg-white rounded-xl shadow-sm border border-gray-100 flex-grow flex-col overflow-hidden mt-4">
            <div class="p-3 border-b border-gray-200 flex justify-between items-center bg-slate-50 flex-wrap gap-2">
                <div class="flex items-center space-x-2 sm:space-x-4">
                    <h2 class="text-sm font-bold text-gray-800">Control Diario</h2>
                    <input type="date" id="filtroDiarioFecha" class="px-2 py-1 border border-gray-300 rounded text-xs">
                    <select id="filtroDiarioSC" class="px-2 py-1 border border-gray-300 rounded text-xs bg-white">
                        <option value="">Todos los sectores</option>
                    </select>
                    <button id="btnLimpiarFiltrosDiario" class="text-gray-500 hover:text-gray-700 text-xs px-2">Limpiar</button>
                </div>
                <div class="flex items-center space-x-2">
                    <button id="btnRecargarDiario" class="bg-gray-100 text-gray-700 px-2 sm:px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-200 transition shadow-sm">🔄 Recargar</button>
                    <button id="btnNuevoRegistroDiario" class="bg-blue-600 text-white px-2 sm:px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-700 transition shadow-sm">＋ Nuevo Registro</button>
                </div>
            </div>
            <div class="w-full overflow-x-auto overflow-y-auto relative custom-scrollbar transition-all" style="max-height: 60vh;">
                <table class="table-fixed w-full min-w-max text-[11px] sm:text-xs text-center text-gray-800 border-collapse whitespace-nowrap">
                    <thead class="text-xs text-gray-700 bg-slate-100 sticky top-0 z-20 shadow-sm">
                        <tr class="bg-slate-200">
                            <th class="px-3 py-2 border border-slate-300 w-24">Fecha</th>
                            <th class="px-3 py-2 border border-slate-300 w-48 text-left">Actividad</th>
                            <th class="px-3 py-2 border border-slate-300 w-24">Sector</th>
                            <th class="px-3 py-2 border border-slate-300 w-20">Avance</th>
                            <th class="px-3 py-2 border border-slate-300 w-32">Personal (HH)</th>
                            <th class="px-3 py-2 border border-slate-300 w-32">Equipos</th>
                            <th class="px-3 py-2 border border-slate-300 w-48 text-left">Hallazgos/Problemas</th>
                            <th class="px-3 py-2 border border-slate-300 w-24">Estado</th>
                            <th class="px-3 py-2 border border-slate-300 w-24">Rol</th>
                        </tr>
                    </thead>
                    <tbody id="tbodyDiario">
                    </tbody>
                </table>
            </div>
        </main>

        <!-- CONTENEDOR RESTRICCIONES -->
        <main id="mainRestricciones" class="hidden bg-white rounded-xl shadow-sm border border-gray-100 flex-grow flex-col overflow-hidden mt-4">
            <div class="p-3 border-b border-gray-200 flex justify-between items-center bg-slate-50 flex-wrap gap-2">
                <div class="flex items-center space-x-2 sm:space-x-4">
                    <h2 class="text-sm font-bold text-gray-800">Restricciones</h2>
                    <select id="filtroRestriccionEstado" class="px-2 py-1 border border-gray-300 rounded text-xs bg-white">
                        <option value="">Todos los estados</option>
                        <option value="ABIERTO">Abierto</option>
                        <option value="EN PROCESO">En Proceso</option>
                        <option value="CERRADO">Cerrado</option>
                    </select>
                </div>
                <div class="flex items-center space-x-2">
                    <button id="btnRecargarRestricciones" class="bg-gray-100 text-gray-700 px-2 sm:px-3 py-1.5 rounded text-xs font-bold hover:bg-gray-200 transition shadow-sm">🔄 Recargar</button>
                    <button id="btnNuevaRestriccion" class="bg-red-600 text-white px-2 sm:px-3 py-1.5 rounded text-xs font-bold hover:bg-red-700 transition shadow-sm">＋ Nueva Restricción</button>
                </div>
            </div>
            <div class="w-full overflow-x-auto overflow-y-auto relative custom-scrollbar transition-all" style="max-height: 60vh;">
                <table class="table-fixed w-full min-w-max text-[11px] sm:text-xs text-center text-gray-800 border-collapse whitespace-nowrap">
                    <thead class="text-xs text-gray-700 bg-slate-100 sticky top-0 z-20 shadow-sm">
                        <tr class="bg-slate-200">
                            <th class="px-3 py-2 border border-slate-300 w-24">ID</th>
                            <th class="px-3 py-2 border border-slate-300 w-48 text-left">Restricción</th>
                            <th class="px-3 py-2 border border-slate-300 w-32">Actividad Afectada</th>
                            <th class="px-3 py-2 border border-slate-300 w-32">Responsable</th>
                            <th class="px-3 py-2 border border-slate-300 w-24">F. Identificación</th>
                            <th class="px-3 py-2 border border-slate-300 w-24">F. Requerida</th>
                            <th class="px-3 py-2 border border-slate-300 w-24">Estado</th>
                        </tr>
                    </thead>
                    <tbody id="tbodyRestricciones">
                    </tbody>
                </table>
            </div>
        </main>

        <!-- CONTENEDOR DASHBOARD (PROYECTO) -->
        <main id="mainDashboard" class="hidden bg-white rounded-xl shadow-sm border border-gray-100 flex-grow flex-col overflow-hidden mt-4 p-4">
            <h2 class="text-xl font-bold text-gray-800 mb-4">Dashboard (KPIs y Gráficos)</h2>
            <div id="dashboardContent" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-slate-50 border border-gray-200 p-4 rounded-lg shadow-sm flex flex-col items-center justify-center h-48">
                    <span class="text-gray-400">Gráfico PPC (Próximamente)</span>
                </div>
                <div class="bg-slate-50 border border-gray-200 p-4 rounded-lg shadow-sm flex flex-col items-center justify-center h-48">
                    <span class="text-gray-400">Gráfico Restricciones (Próximamente)</span>
                </div>
            </div>
        </main>
"""

modal_html = """
    <!-- MODAL: NUEVO REGISTRO DIARIO -->
    <div id="modalNuevoRegistroDiario" class="hidden fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center backdrop-blur-sm">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">📝 Nuevo Registro Diario</h3>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="col-span-2">
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Actividad</label>
                    <select id="cmbActividadDiario" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-slate-50">
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Fecha</label>
                    <input type="date" id="txtFechaDiario" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Sector / Ubicación</label>
                    <input type="text" id="txtSectorDiario" placeholder="Ej: SECTOR 1" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm uppercase">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Avance / Metrado</label>
                    <input type="text" id="txtAvanceDiario" placeholder="Ej: 50 m3" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Personal (HH / Categorías)</label>
                    <input type="text" id="txtPersonalHH" placeholder="Ej: 2O + 1P" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                </div>
                <div class="col-span-2">
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Equipos Usados</label>
                    <input type="text" id="txtEquiposDiario" placeholder="Ej: Retroexcavadora" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm">
                </div>
                <div class="col-span-2">
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Hallazgos o Problemas</label>
                    <textarea id="txtHallazgosDiario" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none" placeholder="Observaciones en campo..."></textarea>
                </div>
            </div>
            
            <div class="flex justify-end space-x-2 mt-4">
                <button id="btnCancelarRegistroDiario" class="px-4 py-2 text-gray-600 font-semibold text-sm hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button id="btnConfirmarRegistroDiario" class="px-4 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 shadow-sm">Guardar Registro</button>
            </div>
        </div>
    </div>

    <!-- MODAL: NUEVA RESTRICCIÓN -->
    <div id="modalNuevaRestriccion" class="hidden fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center backdrop-blur-sm">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">🚧 Nueva Restricción</h3>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
                <div class="col-span-2">
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Descripción de la Restricción</label>
                    <input type="text" id="txtDescRestriccion" placeholder="Ej: Falta diseño estructural" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm">
                </div>
                <div class="col-span-2">
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Actividad Afectada (Opcional)</label>
                    <select id="cmbActividadRestriccion" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm bg-slate-50">
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Responsable</label>
                    <input type="text" id="txtResponsableRestriccion" placeholder="Ej: Juan Perez" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                    <select id="cmbEstadoRestriccion" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm bg-slate-50">
                        <option value="ABIERTO">Abierto</option>
                        <option value="EN PROCESO">En Proceso</option>
                        <option value="CERRADO">Cerrado</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Fecha Identificación</label>
                    <input type="date" id="txtFechaIdenRestriccion" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-600 mb-1">Fecha Requerida</label>
                    <input type="date" id="txtFechaReqRestriccion" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm">
                </div>
            </div>
            
            <div class="flex justify-end space-x-2 mt-4">
                <button id="btnCancelarRestriccion" class="px-4 py-2 text-gray-600 font-semibold text-sm hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button id="btnConfirmarRestriccion" class="px-4 py-2 bg-red-600 text-white font-bold text-sm rounded-lg hover:bg-red-700 shadow-sm">Guardar Restricción</button>
            </div>
        </div>
    </div>
"""

toast_html = """
    <!-- TOAST NOTIFICATION -->
    <div id="toastDiario" class="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-semibold opacity-0 pointer-events-none transition-opacity duration-300 z-[200]">
        Notificación
    </div>
"""

# Insert mains after mainPPC closure
content = content.replace('        </main>\n    </div>\n\n    <!-- MODALES DE CREACIÓN Y EDICIÓN -->', '        </main>\n' + main_diario_html + '\n    </div>\n\n    <!-- MODALES DE CREACIÓN Y EDICIÓN -->')

# Insert modals before "<!-- MODAL: NUEVA RESTRICCIÓN -->" wasn't there so I can just put it before the closing body
content = content.replace('    <!-- Conexion a la Base de Datos y API -->', modal_html + '\n' + toast_html + '\n    <!-- Conexion a la Base de Datos y API -->')

content = content.replace('<script src="assets/js/core/diario.js"></script>', '<script src="assets/js/core/diario.js"></script>\n    <script src="assets/js/core/restricciones.js"></script>')

with open('2. Repositorio GitHub (Frontend)/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

