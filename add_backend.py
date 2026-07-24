import os

target_file = r'h:\Unidades compartidas\6. SISTEMAS & APPS\2. LOOK AHEAD, PROGRAM DIAR Y PPC\0. CODIGO V2 - copia\1. Google Apps Script (Backend)\db_project.gs'

code_to_add = '''
// =========================================================================================
// ??? BLOQUE 3: CONTROL DIARIO
// =========================================================================================

function backendGetDatosDiario(sheetsId) {
  try {
    const ss = SpreadsheetApp.openById(sheetsId);
    let sheet = ss.getSheetByName("DB_DIARIO");
    if (!sheet) {
        // Create if doesn't exist
        sheet = ss.insertSheet("DB_DIARIO");
        sheet.appendRow(["ID_Diario", "ID_Actividad", "Fecha", "Sector", "Avance_Metrado", "Personal_HH", "Equipos_Usados", "Hallazgos_Problemas", "Estado_Aprobacion", "Rol_Reporte", "Timestamp"]);
    }
    
    const data = sheet.getDataRange().getValues();
    let registros = [];
    for (let i = 1; i < data.length; i++) {
        registros.push({
            id: String(data[i][0]).trim(),
            idActividad: String(data[i][1]).trim(),
            fecha: String(data[i][2]).trim(),
            sector: String(data[i][3]).trim(),
            avance: String(data[i][4]).trim(),
            personalHH: String(data[i][5]).trim(),
            equipos: String(data[i][6]).trim(),
            hallazgos: String(data[i][7]).trim(),
            estado: String(data[i][8]).trim(),
            rolReporte: String(data[i][9]).trim(),
            timestamp: String(data[i][10]).trim()
        });
    }
    return { success: true, diario: registros };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function backendGuardarDiario(sheetsId, registro) {
  try {
    const ss = SpreadsheetApp.openById(sheetsId);
    const sheet = ss.getSheetByName("DB_DIARIO");
    if (!sheet) throw new Error("La hoja DB_DIARIO no existe.");
    
    const timestamp = new Date().toISOString();
    // Assuming 'registro' has the properties
    const newId = "DIA" + new Date().getTime();
    
    sheet.appendRow([
        newId, 
        registro.idActividad, 
        registro.fecha, 
        registro.sector, 
        registro.avance, 
        registro.personalHH, 
        registro.equipos, 
        registro.hallazgos, 
        "PENDIENTE", 
        registro.rolReporte, 
        timestamp
    ]);
    
    return { success: true, newId: newId };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// =========================================================================================
// ??? BLOQUE 4: RESTRICCIONES
// =========================================================================================

function backendGetRestricciones(sheetsId) {
  try {
    const ss = SpreadsheetApp.openById(sheetsId);
    let sheet = ss.getSheetByName("DB_RESTRICCIONES");
    if (!sheet) {
        // Create if doesn't exist
        sheet = ss.insertSheet("DB_RESTRICCIONES");
        sheet.appendRow(["ID_Restriccion", "ID_Actividad", "Descripcion", "Fecha_Solicitud", "Responsable", "Fecha_Requerida", "Estado", "Observacion"]);
    }
    
    const data = sheet.getDataRange().getValues();
    let registros = [];
    for (let i = 1; i < data.length; i++) {
        registros.push({
            id: String(data[i][0]).trim(),
            idActividad: String(data[i][1]).trim(),
            descripcion: String(data[i][2]).trim(),
            fechaSolicitud: String(data[i][3]).trim(),
            responsable: String(data[i][4]).trim(),
            fechaRequerida: String(data[i][5]).trim(),
            estado: String(data[i][6]).trim(),
            observacion: String(data[i][7]).trim()
        });
    }
    return { success: true, restricciones: registros };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

function backendGuardarRestriccion(sheetsId, restriccion) {
  try {
    const ss = SpreadsheetApp.openById(sheetsId);
    const sheet = ss.getSheetByName("DB_RESTRICCIONES");
    if (!sheet) throw new Error("La hoja DB_RESTRICCIONES no existe.");
    
    // If it has an ID, we update, else append
    if (restriccion.id) {
       const data = sheet.getDataRange().getValues();
       for(let i=1; i<data.length; i++) {
           if(String(data[i][0]).trim() === restriccion.id) {
               sheet.getRange(i+1, 2, 1, 7).setValues([[
                   restriccion.idActividad,
                   restriccion.descripcion,
                   restriccion.fechaSolicitud,
                   restriccion.responsable,
                   restriccion.fechaRequerida,
                   restriccion.estado,
                   restriccion.observacion
               ]]);
               return { success: true, id: restriccion.id };
           }
       }
    }
    
    // Create new
    const newId = "RES" + new Date().getTime();
    sheet.appendRow([
        newId, 
        restriccion.idActividad, 
        restriccion.descripcion, 
        restriccion.fechaSolicitud, 
        restriccion.responsable, 
        restriccion.fechaRequerida, 
        restriccion.estado || "POR INICIAR", 
        restriccion.observacion
    ]);
    
    return { success: true, id: newId };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
'''

with open(target_file, 'a', encoding='utf-8') as f:
    f.write('\n' + code_to_add)

print("Added DB_DIARIO and DB_RESTRICCIONES logic to db_project.gs")
