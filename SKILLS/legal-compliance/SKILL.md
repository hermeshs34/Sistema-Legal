---
name: legal-compliance
description: Contexto legal venezolano e internacional para LegalDoc VE. Cubre marcos regulatorios, organismos de control, requisitos de compliance, legislación laboral, fiscal y societaria aplicable a las empresas venezolanas.
---

# Skill: Legal Compliance Venezolano

## 1. MARCOS REGULATORIOS PRINCIPALES (VENEZUELA)

### Derecho Societario y Mercantil:
- **Código de Comercio de Venezuela**: Rige sociedades mercantiles, contratos comerciales
- **Código Civil**: Contratos civiles, obligaciones, servidumbres
- **Ley de Mercado de Valores**: Para empresas que cotizan en bolsa

### Derecho Laboral:
- **LOTTT** (Ley Orgánica del Trabajo, los Trabajadores y las Trabajadoras): Contratos de trabajo, vacaciones, liquidaciones, inamovilidad
- **LOPCYMAT** (Ley Orgánica de Prevención, Condiciones y Medio Ambiente de Trabajo): Salud ocupacional, INPSASEL
- **IVSS** (Instituto Venezolano de los Seguros Sociales): Cotizaciones obligatorias
- **LPH** (Ley del Régimen Prestacional de Empleo)

### Derecho Fiscal:
- **ISLR** (Impuesto sobre la Renta): Declaración anual, retenciones
- **IVA** (Impuesto al Valor Agregado): 16% tasa general
- **IGTF** (Impuesto a las Grandes Transacciones Financieras): Para operaciones en divisas
- **SENIAT**: Servicio autónomo de administración tributaria (ente regulador)

### Derecho Regulatorio por Sector:
- **SUNDEA** (Superintendencia Nacional de Actividades Económicas): Registro de empresas, licencias
- **SUDEBAN** (Superintendencia de Bancos): Sector financiero
- **CNV** (Comisión Nacional de Valores): Mercado de capitales
- **INPSASEL**: Higiene y seguridad laboral
- **CONATEL**: Telecomunicaciones
- **MPPAT**: Registros y notarías

---

## 2. DOCUMENTOS LEGALES COMUNES EN VENEZUELA

### Contratos Corporativos:
| Tipo | Descripción | Requisito especial |
|---|---|---|
| Contrato de Servicios | Prestación de servicios profesionales | Registro ante SENIAT si supera ciertos montos |
| Contrato Laboral | Empleado-empleador | Debe cumplir LOTTT; registro en IVSS |
| NDA / Confidencialidad | Protección de información | Válido sin registro notarial, pero recomendado |
| Contrato de Arrendamiento | Inmuebles comerciales | Registro ante el Registro Inmobiliario |
| Contrato de Asociación | Joint ventures, consorcios | Poder notariado si es con extranjeros |

### Documentos Regulatorios:
- **Actas Constitutivas**: Documento de creación de la empresa (SAREN)
- **RIF** (Registro de Información Fiscal): Obligatorio para toda actividad comercial
- **Patente Municipal**: Licencia de actividad económica local
- **Declaraciones SENIAT**: ISLR anual, IVA mensual

---

## 3. NÚMERO DE INPREABOGADO

Todo abogado venezolano habilitado debe estar inscrito en el **INPREABOGADO** (Instituto de Previsión Social del Abogado).

- **Formato**: Número numérico, entre 4 y 6 dígitos (e.g., 12.345 → se guarda como "12345")
- **Validación**: Verificable en el portal del INPREABOGADO
- **Obligatoriedad**: Todo escrito legal en Venezuela debe llevar el número de INPREABOGADO del firmante
- **En el sistema**: Se guarda en el campo `inpreabogado` de la tabla `lawyers`

---

## 4. ÁREAS DE COMPLIANCE Y SUS OBLIGACIONES TÍPICAS

### LEGAL
- Actualización de documentos corporativos (Actas)
- Vigencia de poderes notariales
- Cumplimiento de compromisos contractuales
- Gestión de litigios activos

### TAX (SENIAT)
- Declaración anual de ISLR (marzo de cada año)
- Declaración mensual de IVA (primeros 15 días del mes siguiente)
- Retenciones de IVA e ISLR a proveedores
- Precios de transferencia (si hay operaciones con relacionadas en el exterior)

### LABOR (LOTTT / LOPCYMAT)
- Inscripción de trabajadores en IVSS
- Dotación de implementos de seguridad (LOPCYMAT)
- Registro ante INPSASEL
- Cumplimiento de beneficios: cesta ticket, utilidades, vacaciones
- Inamovilidad laboral: restricciones para despedir sin causa

### REGULATORY
- Licencias sectoriales vigentes (SUNDEA, SUDEBAN, etc.)
- Reportes periódicos a entes reguladores
- Auditorías externas requeridas por reguladores

### ENVIRONMENTAL
- Estudios de impacto ambiental (para sectores industriales)
- Planes de manejo ambiental
- Reportes al MPPAT

### OPERATIONAL
- Políticas internas de la empresa
- Certificaciones ISO (si aplican)
- Controles internos y gobierno corporativo

---

## 5. NIVELES DE RIESGO EN EL CONTEXTO VENEZOLANO

| Nivel | Ejemplos concretos |
|---|---|
| `CRITICAL` | Deuda tributaria con SENIAT > 3 meses; Litigio laboral con sentencia firme; Multa de regulador |
| `HIGH` | Contrato vencido sin renovar; Empleado sin IVSS; Declaración de IVA atrasada |
| `MEDIUM` | Poder notarial próximo a vencer; Acta constitutiva sin actualizar > 2 años |
| `LOW` | Revisión preventiva de contratos; Actualización de políticas internas |

---

## 6. CONSIDERACIONES MULTI-REGIÓN

### Venezuela → España:
- Los contratos entre partes venezolanas y españolas deben especificar la ley aplicable
- Se recomienda cláusula de arbitraje en CIADI o CCI
- Apostilla para documentos que deben surtir efecto en España
- RGPD aplica si hay tratamiento de datos de ciudadanos europeos

### Venezuela → USA:
- OFAC compliance: verificar que las partes no estén en listas de sanciones
- FCPA: aplica si la empresa tiene conexión con EE. UU.
- Contratos en inglés con jurisdicción en Delaware o NY son comunes

---

## 7. CALENDARIOS REGULATORIOS (Venezuela)

| Obligación | Frecuencia | Ente |
|---|---|---|
| Declaración IVA | Mensual (días 1-15) | SENIAT |
| Retencion IVA | Quincenal | SENIAT |
| Declaración ISLR | Anual (antes del 31/03) | SENIAT |
| Cotización IVSS | Mensual | IVSS |
| IGTF | Mensual | SENIAT |
| Informe INPSASEL | Anual | INPSASEL |
| Memoria y Cuenta | Anual (AGO) | Socios/Junta |

---

## 8. TERMINOLOGÍA CLAVE (Español Venezolano)

| Término | Significado |
|---|---|
| RIF | Registro de Información Fiscal (equivalente a NIF en España) |
| INPREABOGADO | Colegio de Abogados venezolano (registro obligatorio) |
| SAREN | Servicio Autónomo de Registros y Notarías |
| Apostilla | Validación internacional de documentos (Convenio de La Haya) |
| AGO | Asamblea General Ordinaria de socios |
| AGE | Asamblea General Extraordinaria |
| Acta Constitutiva | Documento de incorporación de empresa |
| Cesta Ticket | Beneficio alimentario obligatorio para empleados |
| Utilidades | Participación de trabajadores en las ganancias (15-120 días/año) |

---

*Última actualización: 21/03/2026*
