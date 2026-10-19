// Apuntamos a tu nuevo servidor local de Node.js
const BASE_URL = "https://script.google.com/macros/s/AKfycbzhIHAa2cYwD363MW-4sUItakTMTWE9dzAwV95icTUPiLHnKACjX9uU34nZ6ezkgx5T/exec";

const API = {
    // 🛠️ FUNCIÓN PUENTE TEMPORAL
    // Evita que las funciones sin migrar rompan la página entera.
    async ejecutar(funcionGoogle, parametros) {
        console.warn(`⚠️ Función pendiente de migrar a Node.js: ${funcionGoogle}`);
        return []; // Devolvemos un arreglo vacío para que el Frontend no colapse
    },

    // --- AUTENTICACIÓN (FASE 1) ---
    async validarLogin(identificador, password) {
        try {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email: identificador, password: password })
            });
            return await response.json();
        } catch (error) {
            console.error(`Error en API [login]:`, error);
            return { success: false, message: "Error de conexión con el servidor Node.js." };
        }
    },

    // --- PROYECTOS (FASE 2) ---
    async obtenerProyectos(usuarioParam, rol) {
        try {
            // Evaluamos si el parámetro viene dentro de un objeto o es un string/número directo
            const codigo = typeof usuarioParam === 'object' 
                ? (usuarioParam.codigo || usuarioParam.id || usuarioParam.usuario) 
                : usuarioParam;

            if (!codigo) {
                console.error("⚠️ No se proporcionó un código de usuario válido.");
                return [];
            }

            const response = await fetch(`${BASE_URL}/proyectos/${codigo}`);
            
            if (!response.ok) {
                throw new Error(`Error en respuesta de proyectos: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error en API [obtenerProyectos]:`, error);
            return [];
        }
    },

    // --- LOOK-AHEAD (FASE 3) ---
    obtenerDatosLookAhead(sheetsId) {
        return this.ejecutar("obtenerDatosLookAhead", { sheetsId });
    },
    guardarActividad(sheetsId, datos) {
        return this.ejecutar("guardarActividad", { sheetsId, datos });
    },
    actualizarActividad(sheetsId, idActividad, datos) {
        return this.ejecutar("actualizarActividad", { sheetsId, idActividad, datos });
    },
    guardarOrdenMasivo(sheetsId, listaOrdenada) {
        return this.ejecutar("guardarOrdenMasivo", { sheetsId, listaOrdenada });
    },
    eliminarActividad(sheetsId, idActividad) {
        return this.ejecutar("eliminarActividad", { sheetsId, idActividad });
    },
    guardarVersion(sheetsId, comentario, idUsuario, rangoSemanas, rolUsuario, fechaLunesBase, jsonFolderId) {
        return this.ejecutar("guardarVersion", { sheetsId, comentario, idUsuario, rangoSemanas, rolUsuario, fechaLunesBaseStr: fechaLunesBase, jsonFolderId });
    },
    obtenerVersionAntigua(sheetsId, numeroVersion) {
        return this.ejecutar("obtenerVersionAntigua", { sheetsId, numeroVersion });
    },
    guardarCambiosCache(sheetsId, datosCache, progCache, fechasSemanaStr, rolUsuario) {
        return this.ejecutar("sincronizarCache", { sheetsId, datosCache, progCache, fechasSemanaStr, rolUsuario });
    },
    guardarConfiguracionProyecto(sheetsId, fechaLunesBase, semanaInicio) {
        return this.ejecutar("guardarConfigProyecto", { sheetsId, fechaLunesBase, semanaInicio });
    },
    obtenerSemanasHistoricas(sheetsId) {
        return this.ejecutar("obtenerSemanasHistoricas", { sheetsId });
    },
    establecerSemanasBase(sheetsId, fechaLunesBase, semanaInicio) {
        return this.ejecutar("establecerSemanasBase", { sheetsId, fechaLunesBase, semanaInicio });
    },
    extenderSemanaHistorica(sheetsId) {
        return this.ejecutar("extenderSemanaHistorica", { sheetsId });
    },

    // --- PPC ---
    obtenerDatosPPC(sheetsId, versionBase, semanaEvaluada, rol) {
        return this.ejecutar("obtenerDatosPPC", { sheetsId, versionBase, semanaEvaluada, rol });
    },
    guardarBorradorPPC(sheetsId, versionBase, semanaEvaluada, rol, datosPPC) {
        return this.ejecutar("guardarBorradorPPC", { sheetsId, versionBase, semanaEvaluada, rol, datosPPC });
    },
    guardarVersionPPC(sheetsId, comentario, idUsuario, semanaEvaluada, rolUsuario, versionBase, jsonFolderIdPPC) {
        return this.ejecutar("guardarVersionPPC", { sheetsId, comentario, idUsuario, semanaEvaluada, rolUsuario, versionBase, jsonFolderIdPPC });
    },
    obtenerListaVersionesPPC(sheetsId) {
        return this.ejecutar("obtenerListaVersionesPPC", { sheetsId });
    },
    leerJSONPPC(archivoId) {
        return this.ejecutar("leerJSONPPC", { archivoId });
    },
    generarPDFDesdeTabla(pdfFolderId, nombreArchivo, valores, fondos, textos) {
        return this.ejecutar("generarPDFDesdeTabla", { pdfFolderId, nombreArchivo, tablaValores: valores, tablaFondos: fondos, tablaTextos: textos });
    },

    // --- CONTROL DIARIO ---
    obtenerDatosDiario(sheetsId) {
        return this.ejecutar("obtenerDatosDiario", { sheetsId });
    },
    guardarRegistroDiario(sheetsId, registro) {
        return this.ejecutar("guardarDiario", { sheetsId, registro });
    },

    // --- RESTRICCIONES ---
    obtenerRestricciones(sheetsId) {
        return this.ejecutar("obtenerRestricciones", { sheetsId });
    },
    guardarRestriccion(sheetsId, restriccion) {
        return this.ejecutar("guardarRestriccion", { sheetsId, restriccion });
    }
};