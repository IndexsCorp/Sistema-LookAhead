const AppConfig = {
    // Configuración de Entorno
    env: 'production', // 'development' o 'production'
    
    // Configuración de Roles
    roles: {
        ADMIN: 'Administrador total',
        RESIDENTE: 'Visualización y edición de su programación',
        STAFF: 'Llenado de control diario propio',
        SUPERVISION: 'Visualización y validación',
        SC: 'Subcontrata - Solo vista y reporte de control diario',
        RUBRO: 'Encargado - Solo vista y reporte de control diario'
    },

    // IDs Maestros
    driveFolders: {
        lookahead: null,
        ppc: null
    }
};

window.AppConfig = AppConfig;
