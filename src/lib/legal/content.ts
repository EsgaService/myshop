/**
 * Placeholder legal copy. NOT final: both documents must be reviewed by a lawyer
 * before launch (see README / CLAUDE.md).
 */
export type LegalSection = { heading: string; body: string[] };
export type LegalDocument = { title: string; sections: LegalSection[] };

export const LEGAL_REVIEW_NOTICE = "Documento en revisión legal";

export const PRIVACY: LegalDocument = {
  title: "Política de privacidad",
  sections: [
    {
      heading: "Marco legal",
      body: [
        "El tratamiento de datos personales en esta plataforma se rige por la Ley 1581 de 2012 y sus decretos reglamentarios en Colombia.",
      ],
    },
    {
      heading: "Datos que recopilamos",
      body: [
        "Datos de tu cuenta de Google (nombre, correo y foto) cuando inicias sesión, y los datos de perfil que decidas agregar.",
        "Si eres vendedor, los datos de tu tienda y los archivos PDF que subes.",
      ],
    },
    {
      heading: "Finalidad del tratamiento",
      body: [
        "Crear y administrar tu cuenta, gestionar compras y suscripciones, y convertir los PDF de los vendedores en recetarios interactivos.",
      ],
    },
    {
      heading: "Tus derechos",
      body: [
        "Puedes conocer, actualizar, rectificar y solicitar la supresión de tus datos, así como revocar la autorización otorgada.",
      ],
    },
    {
      heading: "Contacto",
      body: ["Los canales para ejercer tus derechos se publicarán en la versión final de este documento."],
    },
  ],
};

export const TERMS: LegalDocument = {
  title: "Términos y condiciones",
  sections: [
    {
      heading: "Uso de la plataforma",
      body: [
        "La plataforma permite a vendedores publicar recetarios digitales y a compradores adquirirlos para consulta personal.",
      ],
    },
    {
      heading: "Cuentas y roles",
      body: [
        "Cada cuenta es de comprador o de vendedor, no ambas. El rol se define al crear la cuenta.",
      ],
    },
    {
      heading: "Compras y suscripción de vendedor",
      body: [
        "Los pagos se procesan a través de pasarelas de pago. La suscripción de vendedor se renueva por periodos y define si tus productos se muestran en el marketplace.",
      ],
    },
    {
      heading: "Contenido de los vendedores",
      body: [
        "El vendedor declara tener los derechos sobre los archivos que sube y es responsable de su contenido.",
      ],
    },
    {
      heading: "Cambios",
      body: ["Estos términos pueden actualizarse; la versión vigente será la publicada en esta página."],
    },
  ],
};
