const AppState = {
    // Session and Routing
    currentSheetsId: "",
    rolGlobalReal: "RESIDENTE",
    rolRenderizadoActual: "RESIDENTE",
    puedeEditarSectores: true,
    puedeEditarEstructura: true,
    
    // Project Data
    memoriaCache: [],           // Actividades
    memoriaProgramacion: [],    // Programación
    fechasSemanales: [],        // Cabeceras de fechas
    fechasRangoActivo: [],
    configProyecto: { fechaLunesBase: null, semanaInicio: 1 },
    
    // Versioning & UI State
    memoriaHistorial1: null,
    memoriaHistorial2: null,
    listaVersionesGlobal: [],
    modoComparativoActivo: false,
    isDraggingSelect: false,
    dragSelectValue: true,
    sortableInstancia: null
};

window.AppState = AppState;
