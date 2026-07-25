import os
import re

directory = r'h:\Unidades compartidas\6. SISTEMAS & APPS\2. LOOK AHEAD, PROGRAM DIAR Y PPC\0. CODIGO V2 - copia\2. Repositorio GitHub (Frontend)\assets\js'

variables = [
    'currentSheetsId', 'memoriaCache', 'memoriaProgramacion', 'fechasSemanales', 
    'fechasRangoActivo', 'sortableInstancia', 'configProyecto', 'memoriaHistorial1', 
    'memoriaHistorial2', 'listaVersionesGlobal', 'modoComparativoActivo', 
    'rolGlobalReal', 'puedeEditarSectores', 'puedeEditarEstructura', 
    'rolRenderizadoActual', 'isDraggingSelect', 'dragSelectValue'
]

# We need to replace these variables in all files EXCEPT lookahead.js (already done) and state.js
for root, dirs, files in os.walk(directory):
    for file in files:
        if file.endswith('.js') and file not in ['lookahead.js', 'state.js', 'config.js']:
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            for v in variables:
                # Match whole word, but don't replace if it's already AppState.v
                # We can just replace \b(v)\b if it's not preceded by AppState.
                # Regex negative lookbehind: (?<!AppState\.)\bvar\b
                pattern = r'(?<!AppState\.)\b' + v + r'\b'
                content = re.sub(pattern, f'AppState.{v}', content)
            
            if content != original_content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f'Replaced in {file}')

print('Refactoring all other files done.')
