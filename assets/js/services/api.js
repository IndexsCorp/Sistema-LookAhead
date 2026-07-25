// 🟢 Pega aquí la URL que termine en /exec que te dio Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbwe8Jj4R0BLMdor0eTsMi7NpyRKEw4DXDvZdSlwLUhmi2V9EzukiZB2QGw-B3A16jLo/exec";

const API = {
    async ejecutar(action, payload = {}) {
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ action, ...payload })
            });
            return await response.json();
        } catch (error) {
            console.error(`Error en API [${action}]:`, error);
            return { success: false, message: "Error de conexión con el servidor." };
        }
    },

    // --- AUTENTICACIÓN Y PROYECTOS ---
    validarLogin(email, password) {
        return this.ejecutar("login", { email, password });
    },
    obtenerProyectos(idUsuario, rol) {
        return this.ejecutar("obtenerProyectos", { idUsuario, rol });
    },

    // --- LOOK-AHEAD ---
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