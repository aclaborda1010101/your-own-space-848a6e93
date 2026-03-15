const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900 px-6 py-12 max-w-3xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-2">Política de Privacidad</h1>
      <p className="text-sm text-gray-500 mb-8">Última actualización: 15 de marzo de 2026</p>

      <section className="space-y-6 text-[15px] leading-relaxed">
        <div>
          <h2 className="text-xl font-semibold mb-2">1. Responsable del tratamiento</h2>
          <p>
            JARVIS ("nosotros", "la aplicación") es una plataforma de productividad personal y gestión empresarial.
            Esta política describe cómo recopilamos, usamos y protegemos la información de los usuarios que interactúan
            con nuestros servicios, incluyendo la integración con WhatsApp a través de la API de Meta (Facebook).
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">2. Datos que recopilamos</h2>
          <p>Cuando utilizas JARVIS y sus integraciones, podemos recopilar:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Nombre y número de teléfono proporcionados a través de WhatsApp.</li>
            <li>Contenido de los mensajes enviados y recibidos mediante la integración de WhatsApp Business API.</li>
            <li>Datos de uso y analíticas básicas (páginas visitadas, acciones realizadas).</li>
            <li>Dirección de correo electrónico utilizada para el registro.</li>
            <li>Información del dispositivo y navegador (user agent, IP).</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">3. Uso de los datos</h2>
          <p>Utilizamos la información recopilada para:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Procesar y responder mensajes recibidos a través de WhatsApp.</li>
            <li>Gestionar tareas, comunicaciones y proyectos del usuario.</li>
            <li>Mejorar la funcionalidad y experiencia de la aplicación.</li>
            <li>Enviar notificaciones relevantes solicitadas por el usuario.</li>
          </ul>
          <p className="mt-2">No vendemos ni compartimos datos personales con terceros con fines publicitarios.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">4. Integración con WhatsApp y Meta</h2>
          <p>
            JARVIS utiliza la API de WhatsApp Business proporcionada por Meta Platforms, Inc. Los datos intercambiados
            a través de esta integración se procesan de acuerdo con las políticas de Meta y esta política de privacidad.
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Solo accedemos a los datos necesarios para el funcionamiento del servicio.</li>
            <li>Los mensajes se procesan para ejecutar acciones solicitadas por el usuario.</li>
            <li>No almacenamos datos de WhatsApp más allá de lo necesario para el servicio.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">5. Almacenamiento y seguridad</h2>
          <p>
            Los datos se almacenan en servidores seguros proporcionados por Supabase con cifrado en reposo y en tránsito.
            Implementamos medidas técnicas y organizativas para proteger la información contra acceso no autorizado,
            pérdida o alteración.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">6. Retención de datos</h2>
          <p>
            Conservamos los datos personales mientras la cuenta del usuario esté activa o sea necesario para prestar
            el servicio. El usuario puede solicitar la eliminación de sus datos en cualquier momento.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">7. Derechos del usuario</h2>
          <p>De acuerdo con la normativa aplicable, tienes derecho a:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Acceder a tus datos personales.</li>
            <li>Rectificar datos inexactos.</li>
            <li>Solicitar la eliminación de tus datos.</li>
            <li>Oponerte al tratamiento de tus datos.</li>
            <li>Solicitar la portabilidad de tus datos.</li>
            <li>Revocar el consentimiento en cualquier momento.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">8. Eliminación de datos</h2>
          <p>
            Para solicitar la eliminación de tus datos, puedes hacerlo desde la sección de Ajustes de la aplicación
            o contactándonos directamente. Procesaremos tu solicitud en un plazo máximo de 30 días.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">9. Cambios en esta política</h2>
          <p>
            Podemos actualizar esta política de privacidad periódicamente. Notificaremos cualquier cambio significativo
            a través de la aplicación. El uso continuado del servicio tras la publicación de cambios constituye
            la aceptación de la política actualizada.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">10. Contacto</h2>
          <p>
            Para cualquier consulta relacionada con esta política de privacidad o el tratamiento de tus datos,
            puedes contactarnos en: <strong>privacy@jarvis-app.com</strong>
          </p>
        </div>
      </section>

      <footer className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-400">
        © {new Date().getFullYear()} JARVIS. Todos los derechos reservados.
      </footer>
    </div>
  );
};

export default PrivacyPolicy;
