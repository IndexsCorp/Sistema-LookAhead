/**
 * Descarga y dibuja las tarjetas de los proyectos
 */
async function renderizarProyectos() {
    const grid = document.getElementById('gridProyectos');
    grid.innerHTML = '<p class="text-gray-500 col-span-full text-center py-10">Buscando proyectos en la base de datos...</p>';

    try {
        const sessionData = JSON.parse(sessionStorage.getItem('usuarioActivo'));
        if (!sessionData) return;

        const respuesta = await API.obtenerProyectos(sessionData.idUsuario, sessionData.rol);

        if (respuesta.success) {
            const proyectos = respuesta.data;
            grid.innerHTML = ''; // Limpiar el mensaje de carga

            if (proyectos.length === 0) {
                grid.innerHTML = '<p class="text-gray-500 col-span-full text-center py-10">No tienes proyectos asignados actualmente.</p>';
                return;
            }

            // Dibujar cada proyecto
            proyectos.forEach(proy => {
                const card = `
                    <div class="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-6 border border-gray-100 flex flex-col h-full cursor-pointer group" onclick="abrirProyecto('${proy.id}', '${proy.sheetsId}', '${proy.nombre}', '${proy.jsonFolderIdLook}', '${proy.jsonFolderIdPPC}', '${proy.pdfFolderId}')">
                        <div class="flex items-center justify-between mb-4">
                            <span class="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded">${proy.id}</span>
                            <span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded flex items-center">
                                <span class="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                                ${proy.estado}
                            </span>
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">${proy.nombre}</h3>
                        <p class="text-sm text-gray-500 mb-6 flex-grow flex items-start">
                            📍 ${proy.ubicacion}
                        </p>
                        <button class="w-full bg-slate-50 text-slate-700 font-semibold py-2.5 rounded-lg border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-colors">
                            Entrar al Proyecto
                        </button>
                    </div>
                `;
                grid.innerHTML += card;
            });
        } else {
            grid.innerHTML = `<p class="text-red-500 col-span-full text-center py-10">Error: ${respuesta.message}</p>`;
        }
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="text-red-500 col-span-full text-center py-10">Error de red al cargar los proyectos.</p>';
    }
}

/**
 * Lógica cuando el usuario hace clic en una tarjeta de proyecto
 */
function abrirProyecto(id, sheetsId, nombre, jsonFolderLook, jsonFolderPPC, pdfFolder) {
    // 🟢 NUEVO: Guardamos todos los Folder IDs en la sesión
    const proyectoActivo = { id, sheetsId, nombre, jsonFolderLook, jsonFolderPPC, pdfFolder };
    sessionStorage.setItem('proyectoActivo', JSON.stringify(proyectoActivo));

    document.getElementById('v1-dashboard').classList.add('hidden');
    document.getElementById('v1-dashboard').classList.remove('flex');
    
    const v2 = document.getElementById('v2-proyecto');
    v2.classList.remove('hidden');
    v2.classList.add('flex');

    document.getElementById('lblNombreProyecto').innerText = nombre;
    document.getElementById('lblIdProyecto').innerText = `ID: ${id} | Base de datos: ${sheetsId.substring(0,8)}...`;

    cargarLookAhead(sheetsId);
}

/**
 * Lógica para el botón "Volver a Mis Proyectos"
 */
document.getElementById('btnVolverDashboard').addEventListener('click', function() {
    // Borramos el proyecto activo de la memoria
    sessionStorage.removeItem('proyectoActivo');
    
    // Transición Inversa: Ocultar V2 y Mostrar V1
    document.getElementById('v2-proyecto').classList.add('hidden');
    document.getElementById('v2-proyecto').classList.remove('flex');
    
    const v1 = document.getElementById('v1-dashboard');
    v1.classList.remove('hidden');
    v1.classList.add('flex');
});

// ==========================================
// LÓGICA DE NAVEGACIÓN DE PESTAÑAS (LA vs PPC)
// ==========================================
// Usamos un intervalo rápido para asegurar que el HTML ya exista antes de inyectar el clic
let tabsInterval = setInterval(() => {
    const btnLA = document.getElementById('btnTabLA');
    const btnPPC = document.getElementById('btnTabPPC');
    const mainLA = document.getElementById('mainLookAhead'); 
    const mainPPC = document.getElementById('mainPPC'); 

    if(btnLA && btnPPC && mainLA && mainPPC) {
        clearInterval(tabsInterval); // Ya encontró los botones, detenemos el buscador

        btnLA.addEventListener('click', () => {
            btnLA.className = "px-3 py-2 bg-white shadow text-blue-700 font-semibold rounded-md text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors";
            btnPPC.className = "px-3 py-2 text-gray-600 hover:text-blue-600 font-medium rounded-md text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors";
            
            mainLA.classList.remove('hidden');
            mainLA.classList.add('flex'); // Mantiene el flexbox del lookahead
            mainPPC.classList.add('hidden');
            mainPPC.classList.remove('flex');
        });

        btnPPC.addEventListener('click', () => {
            btnPPC.className = "px-3 py-2 bg-white shadow text-blue-700 font-semibold rounded-md text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors";
            btnLA.className = "px-3 py-2 text-gray-600 hover:text-blue-600 font-medium rounded-md text-xs sm:text-sm whitespace-nowrap flex-shrink-0 transition-colors";
            
            mainLA.classList.add('hidden');
            mainLA.classList.remove('flex');
            mainPPC.classList.remove('hidden');
            mainPPC.classList.add('flex'); // Mantiene el flexbox del PPC
            
            // Disparador de la carga de la vista PPC
            if(typeof cargarVistaPPC === 'function') cargarVistaPPC();
        });
    }
}, 500); // Busca los botones cada medio segundo al arrancar

