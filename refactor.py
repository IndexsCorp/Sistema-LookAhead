import re
import os

target_file = r'h:\Unidades compartidas\6. SISTEMAS & APPS\2. LOOK AHEAD, PROGRAM DIAR Y PPC\0. CODIGO V2 - copia\2. Repositorio GitHub (Frontend)\assets\js\core\lookahead.js'

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

variables = [
    'currentSheetsId', 'memoriaCache', 'memoriaProgramacion', 'fechasSemanales', 
    'fechasRangoActivo', 'sortableInstancia', 'configProyecto', 'memoriaHistorial1', 
    'memoriaHistorial2', 'listaVersionesGlobal', 'modoComparativoActivo', 
    'rolGlobalReal', 'puedeEditarSectores', 'puedeEditarEstructura', 
    'rolRenderizadoActual', 'isDraggingSelect', 'dragSelectValue'
]

# Remove the let declarations at the top of the file
lines = content.split('\n')
new_lines = []
in_decl_block = True
for line in lines:
    if in_decl_block and line.strip().startswith('let '):
        is_var = False
        for v in variables:
            if line.strip().startswith(f'let {v}'):
                is_var = True
                break
        if is_var:
            continue
    if 'PERMISOS GLOBALES' in line:
        continue
    new_lines.append(line)
    
content = '\n'.join(new_lines)

# Replace variable usage with AppState.variable
for v in variables:
    # Match variable as whole word
    pattern = r'\b' + v + r'\b'
    content = re.sub(pattern, f'AppState.{v}', content)

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done replacing in lookahead.js')
