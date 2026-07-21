/**
 * Lógica de la pantalla V0_Login conectada al backend real
 */
document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault(); 
    
    const btnLogin = document.getElementById('btnLogin');
    const txtEmail = document.getElementById('txtEmail').value.trim();
    const txtPassword = document.getElementById('txtPassword').value;
    const msgError = document.getElementById('msgError');

    // 1. UI en modo de espera
    msgError.classList.add('hidden');
    btnLogin.innerText = "Verificando...";
    btnLogin.disabled = true;
    btnLogin.classList.add('opacity-75', 'cursor-not-allowed');

    try {
        // 2. Llamada real al servidor a través de nuestro archivo api.js
        const respuesta = await API.validarLogin(txtEmail, txtPassword);
        
        if (respuesta && respuesta.success) {
            // ¡ÉXITO! Guardamos la sesión en la memoria del navegador
            sessionStorage.setItem('usuarioActivo', JSON.stringify(respuesta));
            
            // 3. Transición Visual: Ocultar V0 (Login) y Mostrar V1 (Dashboard)
            document.getElementById('v0-login').classList.add('hidden');
            
            // Cambiamos la alineación del fondo
            document.body.classList.remove('items-center', 'justify-center');
            document.body.classList.add('items-start'); 

            // Mostramos el contenedor V1 y actualizamos el texto
            const v1 = document.getElementById('v1-dashboard');
            v1.classList.remove('hidden');
            v1.classList.add('flex'); 
            
            document.getElementById('lblUsuarioActivo').innerText = `Bienvenido, ${respuesta.nombre} (${respuesta.rol})`;

            // ¡AQUÍ ENCENDEMOS EL MOTOR DE PROYECTOS! 🚀
            renderizarProyectos();

            // Restauramos el botón en segundo plano
            btnLogin.innerText = "Ingresar";
            btnLogin.disabled = false;
            btnLogin.classList.remove('opacity-75', 'cursor-not-allowed');
            
        } else {
            // Error de credenciales
            msgError.innerText = respuesta ? respuesta.message : "Error desconocido.";
            msgError.classList.remove('hidden');
            
            // Restauramos el botón
            btnLogin.innerText = "Ingresar";
            btnLogin.disabled = false;
            btnLogin.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    } catch (error) {
        // AHORA MOSTRARÁ EL ERROR REAL DE GOOGLE EN PANTALLA
        msgError.innerText = "Error: " + (error.message || error);
        msgError.classList.remove('hidden');
        console.error("Error capturado en el frontend:", error);
        
        btnLogin.innerText = "Ingresar";
        btnLogin.disabled = false;
        btnLogin.classList.remove('opacity-75', 'cursor-not-allowed');
    }
});

/**
 * Lógica para cerrar sesión
 */
document.getElementById('btnLogout').addEventListener('click', function() {
    sessionStorage.removeItem('usuarioActivo');
    window.top.location.reload(); 
});