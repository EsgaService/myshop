/**
 * Generic legal documents for MyShop (Colombia).
 * NOTE: these texts are generic. A review by a lawyer is recommended before scaling the business.
 */
export type LegalSection = { heading: string; body: string[] };
export type LegalDocument = { title: string; sections: LegalSection[] };

export const LEGAL_LAST_UPDATED = "12 de octubre de 2026";
export const LEGAL_CONTACT_EMAIL = "victorup1902@gmail.com";

const EMAIL = LEGAL_CONTACT_EMAIL;

export const PRIVACY: LegalDocument = {
  title: "Política de privacidad y tratamiento de datos personales",
  sections: [
    {
      heading: "1. Responsable del tratamiento",
      body: [
        "MyShop, disponible en myshop.lat, es el responsable del tratamiento de los datos personales que recopila a través de la plataforma.",
        `Para cualquier consulta, solicitud o reclamo sobre tus datos puedes escribirnos a ${EMAIL}.`,
      ],
    },
    {
      heading: "2. Marco legal",
      body: [
        "El tratamiento de datos personales se rige por el artículo 15 de la Constitución Política de Colombia, la Ley 1581 de 2012, el Decreto 1377 de 2013 y el Decreto 1074 de 2015 (Decreto Único Reglamentario del Sector Comercio, Industria y Turismo), así como por las normas que los modifiquen o complementen.",
      ],
    },
    {
      heading: "3. Datos que recopilamos",
      body: [
        "Datos de tu cuenta de Google cuando inicias sesión: nombre, correo electrónico y foto de perfil. El inicio de sesión se hace únicamente con Google; no almacenamos contraseñas.",
        "Datos de perfil que decidas agregar, como tu nombre visible.",
        "Si eres vendedor: los datos de tu tienda (nombre, enlace, descripción e imágenes), los archivos PDF que subes, los recetarios generados a partir de ellos y los datos de la cuenta donde recibes tus pagos.",
        "Registros de compras y suscripciones: producto, valor en pesos colombianos (COP), fecha y estado del pago.",
        "Los datos de tarjetas y medios de pago son tratados directamente por la pasarela de pago. MyShop no los recibe ni los almacena.",
        "Datos técnicos y cookies estrictamente necesarios para mantener tu sesión y la seguridad del servicio.",
      ],
    },
    {
      heading: "4. Finalidades del tratamiento",
      body: [
        "Crear y administrar tu cuenta y autenticarte en la plataforma.",
        "Procesar compras y suscripciones, entregar los productos digitales y mantener el historial de tu biblioteca.",
        "Permitir a los vendedores publicar sus productos y convertir sus PDF en recetarios interactivos mediante inteligencia artificial.",
        "Atender consultas, peticiones, quejas y reclamos, y enviarte comunicaciones necesarias sobre el servicio.",
        "Prevenir fraudes, garantizar la seguridad de la plataforma y cumplir obligaciones legales.",
      ],
    },
    {
      heading: "5. Autorización",
      body: [
        "Al iniciar sesión y usar la plataforma nos autorizas de manera previa, expresa e informada para tratar tus datos conforme a esta política. Puedes revocar la autorización en cualquier momento, salvo cuando exista un deber legal o contractual de conservar la información.",
      ],
    },
    {
      heading: "6. Encargados del tratamiento y transferencias",
      body: [
        "Para operar el servicio compartimos datos con terceros que actúan como encargados del tratamiento y solo los usan para prestarnos su servicio:",
        "Google: autenticación e inicio de sesión.",
        "Supabase: base de datos, autenticación y almacenamiento de archivos.",
        "Anthropic: procesamiento con inteligencia artificial del contenido de los PDF que suben los vendedores.",
        "Pasarelas de pago de terceros: procesamiento de pagos y suscripciones.",
        "Vercel: alojamiento de la aplicación.",
        "Algunos de estos encargados pueden tratar datos en servidores ubicados fuera de Colombia, lo que implica una transferencia o transmisión internacional. Exigimos a estos proveedores niveles adecuados de protección y confidencialidad.",
        "No vendemos tus datos personales.",
      ],
    },
    {
      heading: "7. Derechos del titular",
      body: [
        "Como titular de los datos tienes derecho a:",
        "Conocer, actualizar y rectificar tus datos personales.",
        "Solicitar prueba de la autorización otorgada.",
        "Ser informado sobre el uso que se ha dado a tus datos.",
        "Revocar la autorización y solicitar la supresión de tus datos cuando no se respeten los principios y garantías legales.",
        "Acceder de forma gratuita a tus datos personales.",
        "Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la normativa, una vez agotado el trámite de consulta o reclamo ante nosotros.",
      ],
    },
    {
      heading: "8. Procedimiento para consultas y reclamos",
      body: [
        `Consultas: escríbenos a ${EMAIL} indicando tu nombre y el correo asociado a tu cuenta. Responderemos en un máximo de diez (10) días hábiles contados desde la recepción. Si no podemos hacerlo en ese plazo, te informaremos los motivos y la nueva fecha, que no superará cinco (5) días hábiles adicionales.`,
        `Reclamos: si consideras que tus datos deben ser corregidos, actualizados o suprimidos, o que hay un incumplimiento de la ley, envía tu reclamo a ${EMAIL} con la descripción de los hechos y los datos de contacto. Lo resolveremos en un máximo de quince (15) días hábiles; si necesitamos más tiempo, te lo informaremos con los motivos y la nueva fecha, que no superará ocho (8) días hábiles adicionales.`,
        "Si tu reclamo está incompleto, te pediremos que lo subsanes dentro de los cinco (5) días siguientes a su recepción.",
      ],
    },
    {
      heading: "9. Seguridad de la información",
      body: [
        "Aplicamos medidas técnicas, humanas y administrativas razonables para proteger tus datos contra acceso no autorizado, pérdida o alteración, incluyendo conexiones cifradas, control de acceso por roles y reglas de seguridad a nivel de base de datos. Ningún sistema es completamente invulnerable, por lo que no podemos garantizar seguridad absoluta.",
      ],
    },
    {
      heading: "10. Conservación de los datos",
      body: [
        "Conservamos tus datos mientras mantengas tu cuenta y durante el tiempo necesario para cumplir las finalidades descritas y las obligaciones legales, contables y tributarias. Cuando solicites la supresión, eliminaremos o anonimizaremos tus datos, salvo los que debamos conservar por mandato legal o para atender reclamaciones.",
      ],
    },
    {
      heading: "11. Cookies",
      body: [
        "Usamos cookies y tecnologías similares estrictamente necesarias para iniciar y mantener tu sesión y proteger el servicio. No las usamos para publicidad de terceros. Puedes bloquearlas desde tu navegador, pero algunas funciones de la plataforma dejarían de funcionar.",
      ],
    },
    {
      heading: "12. Menores de edad",
      body: [
        "La plataforma está dirigida a personas mayores de 18 años. Los menores de edad solo pueden usarla con la supervisión y autorización de su padre, madre o representante legal. Si detectamos datos de un menor tratados sin esa autorización, los suprimiremos.",
      ],
    },
    {
      heading: "13. Cambios a esta política",
      body: [
        "Podemos actualizar esta política para reflejar cambios legales o del servicio. Publicaremos la versión vigente en esta página con su fecha de actualización y, si el cambio es sustancial, te lo informaremos por medios razonables.",
      ],
    },
    {
      heading: "14. Vigencia",
      body: [
        `Esta política rige desde el ${LEGAL_LAST_UPDATED} y permanece vigente mientras MyShop trate datos personales.`,
      ],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: "Términos y condiciones de uso",
  sections: [
    {
      heading: "1. Aceptación de los términos",
      body: [
        "Estos términos regulan el uso de MyShop (myshop.lat). Al crear una cuenta, comprar, vender o navegar en la plataforma aceptas estos términos y la política de privacidad. Si no estás de acuerdo, no uses el servicio.",
        "La aceptación se realiza por medios electrónicos y tiene plena validez conforme a la Ley 527 de 1999 sobre comercio electrónico y mensajes de datos.",
      ],
    },
    {
      heading: "2. Descripción del servicio",
      body: [
        "MyShop es un marketplace en el que vendedores (creadores) publican productos digitales, concretamente recetarios interactivos generados con inteligencia artificial a partir de sus propios PDF, y compradores los adquieren para consulta personal.",
        "MyShop actúa como intermediario tecnológico. El contenido de cada producto es responsabilidad del vendedor que lo publica.",
      ],
    },
    {
      heading: "3. Cuentas y roles",
      body: [
        "El acceso se realiza únicamente con una cuenta de Google. Debes ser mayor de 18 años o contar con la autorización de tu representante legal.",
        "Cada cuenta tiene un rol exclusivo, comprador o vendedor, que se define al crear la cuenta y no puede cambiarse después. Un vendedor no puede comprar con su cuenta de vendedor.",
        "Eres responsable de la actividad realizada desde tu cuenta y de mantener la seguridad de tu cuenta de Google.",
      ],
    },
    {
      heading: "4. Obligaciones del vendedor",
      body: [
        "Declaras ser titular de los derechos sobre los archivos y contenidos que subes, o contar con la autorización necesaria para usarlos y comercializarlos.",
        "No puedes subir contenido que infrinja derechos de terceros, sea ilegal, engañoso, ofensivo o que contenga datos personales de terceros sin autorización.",
        "Los recetarios se generan con inteligencia artificial y pueden contener errores. Antes de publicar, debes revisar que el resultado sea fiel y adecuado; esa revisión es tu responsabilidad.",
        "Tú defines el precio de tus productos, en pesos colombianos (COP), dentro de los límites que muestre la plataforma. Eres responsable de tus obligaciones tributarias y legales como vendedor.",
      ],
    },
    {
      heading: "5. Suscripción del vendedor",
      body: [
        "Para subir PDF, generar recetarios y mantener productos publicados, el vendedor debe tener una suscripción activa de 50.000 COP al mes.",
        "La suscripción se paga por periodos mensuales y se renueva mientras se mantenga activa. Si el periodo vence sin renovarse, tus productos dejan de mostrarse en el marketplace y no podrás recibir nuevas ventas hasta que renueves.",
        "Los compradores que ya adquirieron un producto conservan el acceso a él aunque la suscripción del vendedor venza.",
      ],
    },
    {
      heading: "6. Compras y pagos",
      body: [
        "El precio de cada producto se muestra en pesos colombianos (COP) antes de que realices el pago.",
        "Los pagos se procesan a través de pasarelas de pago de terceros, que tratan directamente tus datos de pago. MyShop no almacena datos de tarjetas.",
        "Al tratarse de un producto digital, la entrega consiste en el acceso inmediato al recetario desde tu biblioteca una vez confirmado el pago.",
      ],
    },
    {
      heading: "7. Licencia de uso para el comprador",
      body: [
        "Al comprar un producto obtienes una licencia personal, no exclusiva e intransferible para consultarlo y usarlo para fines propios.",
        "No puedes copiar, redistribuir, revender, compartir tu acceso ni publicar el contenido, total o parcialmente, sin autorización del titular de los derechos.",
      ],
    },
    {
      heading: "8. Derecho de retracto",
      body: [
        "Conforme al artículo 47 de la Ley 1480 de 2011 (Estatuto del Consumidor), el derecho de retracto aplica en los casos previstos por la ley y tiene las excepciones que ella establece.",
        `Si consideras que te asiste el derecho de retracto, puedes solicitarlo por escrito a ${EMAIL} dentro de los cinco (5) días hábiles siguientes a la entrega del producto, indicando tu nombre, el correo de tu cuenta y el producto comprado.`,
        "En los productos de contenido digital cuyo acceso ya se ha iniciado, el derecho de retracto puede no ser procedente, en los términos que la ley permite. Evaluaremos cada solicitud de forma individual y te responderemos por correo.",
        "Si el retracto procede, la devolución del dinero se hará por el mismo medio de pago, dentro de los plazos legales.",
      ],
    },
    {
      heading: "9. Reembolsos, garantía y reclamaciones",
      body: [
        "Los productos están cubiertos por la garantía legal prevista en la Ley 1480 de 2011 cuando el contenido no corresponda a lo ofrecido o presente fallas que impidan su uso.",
        `Puedes presentar peticiones, quejas y reclamos (PQR) en ${EMAIL}. Te daremos respuesta en un plazo razonable y, en todo caso, dentro de los términos de ley.`,
        "Si tu reclamo no se resuelve, puedes acudir a la Superintendencia de Industria y Comercio (SIC) como autoridad de protección al consumidor.",
      ],
    },
    {
      heading: "10. Propiedad intelectual",
      body: [
        "Los derechos sobre la marca, el diseño y el software de MyShop pertenecen a MyShop. Los derechos sobre el contenido de cada producto pertenecen al vendedor o a sus licenciantes.",
        "El vendedor nos concede una licencia limitada y no exclusiva para almacenar, procesar, transformar con inteligencia artificial y mostrar su contenido con el único fin de operar el servicio.",
      ],
    },
    {
      heading: "11. Contenido generado con inteligencia artificial",
      body: [
        "Los recetarios se generan mediante sistemas de inteligencia artificial de terceros a partir de los PDF del vendedor. Estos sistemas pueden producir resultados inexactos o incompletos.",
        "MyShop no garantiza la exactitud de recetas, cantidades, tiempos ni indicaciones de alérgenos o de salud. Consulta siempre a un profesional ante restricciones alimentarias o condiciones médicas.",
      ],
    },
    {
      heading: "12. Conductas prohibidas",
      body: [
        "Está prohibido usar la plataforma para actividades ilegales o fraudulentas, vulnerar su seguridad, acceder a cuentas ajenas, extraer datos de forma automatizada sin autorización, suplantar identidades, subir malware o interferir con el funcionamiento del servicio.",
      ],
    },
    {
      heading: "13. Suspensión y terminación",
      body: [
        "Podemos suspender o cerrar tu cuenta, o retirar contenido, si incumples estos términos, infringes derechos de terceros o pones en riesgo la plataforma.",
        `Puedes dejar de usar el servicio y solicitar el cierre de tu cuenta en cualquier momento escribiendo a ${EMAIL}. Las obligaciones ya causadas se mantienen.`,
      ],
    },
    {
      heading: "14. Limitación de responsabilidad",
      body: [
        "MyShop presta el servicio tal como está disponible, sin garantizar que sea ininterrumpido o libre de errores. En la medida permitida por la ley, MyShop no responde por el contenido publicado por los vendedores, por fallas de terceros (pasarelas de pago, proveedores de nube o de inteligencia artificial) ni por daños indirectos.",
        "Lo anterior no limita los derechos irrenunciables que la ley reconoce a los consumidores.",
      ],
    },
    {
      heading: "15. Modificaciones",
      body: [
        "Podemos modificar estos términos. La versión vigente será la publicada en esta página con su fecha de actualización. Si continúas usando el servicio después del cambio, se entiende que lo aceptas.",
      ],
    },
    {
      heading: "16. Ley aplicable y jurisdicción",
      body: [
        "Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia se someterá a los jueces y autoridades competentes de Colombia, sin perjuicio de las competencias de la Superintendencia de Industria y Comercio en materia de consumo.",
      ],
    },
    {
      heading: "17. Contacto",
      body: [`Para cualquier duda sobre estos términos escríbenos a ${EMAIL}.`],
    },
  ],
};
