---
name: testing
description: Protocolo de pruebas de integridad para LegalDoc VE. Cubre pruebas funcionales, de seguridad (RLS), de flujo de datos, multi-tenant y de regresión. Debe ejecutarse antes de cualquier deploy o cambio estructural en la BD.
---

# Skill: Testing e Integridad del Sistema — LegalDoc VE

> **Ejecutar este protocolo ANTES de cualquier deploy a producción o migración de base de datos.**

---

## 1. CATEGORÍAS DE PRUEBA

```
NIVEL 1 — Smoke Tests        : Verificar que el sistema arranca y carga
NIVEL 2 — Funcionales        : Verificar cada módulo y sus flujos
NIVEL 3 — Seguridad (RLS)    : Verificar aislamiento de datos por organización
NIVEL 4 — Integridad de BD   : Verificar constraints, índices, relaciones
NIVEL 5 — Regresión          : Verificar que cambios no rompan funciones previas
NIVEL 6 — Performance        : Verificar tiempos de respuesta aceptables
```

---

## 2. SMOKE TESTS (Nivel 1) — 5 minutos

### 2.1 Verificación de arranque
```bash
# El sistema debe compilar sin errores
npm run build

# El servidor de desarrollo debe arrancar
npm run dev
```

**Criterio de éxito**: Sin errores TypeScript, sin warnings críticos

### 2.2 Check de conectividad Supabase
```sql
-- Ejecutar desde Supabase SQL Editor
SELECT NOW() as tiempo_servidor, version() as postgres_version;
SELECT COUNT(*) FROM organizations;  -- Debe retornar > 0
SELECT COUNT(*) FROM profiles;       -- Debe retornar > 0
```

### 2.3 Check de variables de entorno
```typescript
// Verificar en consola del navegador:
console.log(import.meta.env.VITE_SUPABASE_URL);     // No debe ser undefined
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY); // No debe ser undefined
```

---

## 3. PRUEBAS FUNCIONALES (Nivel 2)

### 3.1 Módulo de Autenticación (IAM)

| Prueba | Pasos | Resultado esperado |
|---|---|---|
| Login válido | Ingresar email y password correcto | Redirige al dashboard |
| Login inválido | Ingresar password incorrecto | Mensaje de error, no redirige |
| Logout | Clic en cerrar sesión | Redirige a pantalla de login |
| Sesión persistente | Cerrar tab y reabrir URL | Mantiene sesión activa |
| Crear usuario | Completar formulario con datos válidos | Usuario aparece en la lista |
| Cambiar contraseña | Activar sección "Cambiar Contraseña" | Cambia correctamente |

### 3.2 Módulo de Gestión Documental

| Prueba | Pasos | Resultado esperado |
|---|---|---|
| Crear documento | Completar formulario, guardar | Aparece en lista con estado DRAFT |
| Adjuntar PDF | Subir archivo < 10MB | URL de archivo almacenado en Supabase Storage |
| Cambiar estado | DRAFT → IN_REVIEW | Estado actualizado, audit_log creado |
| Filtrar por tipo | Seleccionar categoría en dropdown | Lista filtrada correctamente |
| Búsqueda | Escribir en campo de búsqueda | Resultados en tiempo real |
| Análisis IA | Clic en "Analizar con IA" | Muestra análisis del contenido |
| Editar documento | Modificar y guardar | Cambios persisten |
| Eliminar documento | Confirmar eliminación | Desaparece de lista, audit_log creado |

### 3.3 Módulo de Contratos

| Prueba | Pasos | Resultado esperado |
|---|---|---|
| Crear contrato | Completar formulario c/ partes y fecha | Aparece en lista con estado DRAFT |
| Vincular documento | Seleccionar doc del repositorio | document_id persiste en BD |
| Herencia de archivo | Vincular doc sin archivo propio | file_url hereda del documento vinculado |
| Editor de texto | Abrir editor, escribir contenido | Content_draft guardado en BD |
| Filtrar por estado | Seleccionar estado en dropdown | Lista filtrada correctamente |
| Filtrar por tipo | Seleccionar tipo en dropdown | Lista filtrada correctamente |
| Ver detalles | Clic en card de contrato | Modal con información completa |
| Calcular vencimiento | Contrato con end_date < HOY | Badge "Vencido" visible |

### 3.4 Módulo de Compliance

| Prueba | Pasos | Resultado esperado |
|---|---|---|
| Crear ítem | Completar formulario de riesgo | Aparece en matriz de riesgos |
| Cambiar nivel de riesgo | Editar ítem, cambiar nivel | Color de badge actualizado |
| Filtrar por área | Seleccionar área en dropdown | Lista filtrada |
| Ítem CRITICAL | Crear ítem con nivel CRITICAL | Aparece resaltado en rojo |

### 3.5 Módulo de Equipo Legal

| Prueba | Pasos | Resultado esperado |
|---|---|---|
| Registrar abogado | INPREABOGADO entre 4-6 dígitos | Guardado correctamente |
| INPREABOGADO duplicado | Ingresar número ya existente | Error de validación |
| INPREABOGADO inválido | Ingresar número con 7+ dígitos | Error de validación |
| Ver dossier | Clic en abogado | Modal con historial y casos |

---

## 4. PRUEBAS DE SEGURIDAD — RLS (Nivel 3)

### 4.1 Aislamiento Multi-Tenant

```sql
-- CRÍTICO: Ejecutar para cada organización de prueba

-- Verificar que un usuario de Org A no puede ver datos de Org B
-- Esto debe retornar 0 filas si RLS está bien configurado
SELECT COUNT(*) 
FROM documents 
WHERE organization_id != (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid()
);

-- Verificar RLS en contratos
SELECT COUNT(*) 
FROM contracts_new 
WHERE organization_id != (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid()
);
```

### 4.2 Verificación de Políticas RLS

```sql
-- Listar todas las políticas RLS activas
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Tablas que DEBEN tener RLS activo:**
- [ ] `documents`
- [ ] `contracts_new`  
- [ ] `compliance_items`
- [ ] `lawyers`
- [ ] `profiles`
- [ ] `audit_logs`
- [ ] `document_analysis`

### 4.3 Verificación de Roles

| Rol | Puede crear doc | Puede aprobar | Puede ver auditoría | Puede gestionar usuarios |
|---|---|---|---|---|
| `consultor_general` | ✅ | ✅ | ✅ Total | ✅ |
| `abogado_senior` | ✅ | ✅ | ✅ Parcial | ❌ |
| `consultor_principal` | ❌ | ❌ | ✅ Parcial | ❌ |
| `abogado_junior` | ✅ Solo asignados | ❌ | ❌ | ❌ |
| `aprendiz` | ❌ | ❌ | ❌ | ❌ |

---

## 5. PRUEBAS DE INTEGRIDAD DE BD (Nivel 4)

### 5.1 Verificar constraints y relaciones

```sql
-- 1. Todo documento debe tener organization_id válido
SELECT COUNT(*) FROM documents d
LEFT JOIN organizations o ON d.organization_id = o.id
WHERE o.id IS NULL;
-- Resultado esperado: 0

-- 2. Todo contrato debe tener organization_id válido
SELECT COUNT(*) FROM contracts_new c
LEFT JOIN organizations o ON c.organization_id = o.id
WHERE o.id IS NULL;
-- Resultado esperado: 0

-- 3. Contrato con document_id debe apuntar a documento existente
SELECT COUNT(*) FROM contracts_new c
LEFT JOIN documents d ON c.document_id = d.id::text
WHERE c.document_id IS NOT NULL AND d.id IS NULL;
-- Resultado esperado: 0

-- 4. Todo perfil debe tener usuario en auth.users
SELECT COUNT(*) FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;
-- Resultado esperado: 0

-- 5. INPREABOGADO no debe tener duplicados por organización
SELECT inpreabogado, organization_id, COUNT(*) 
FROM lawyers 
GROUP BY inpreabogado, organization_id 
HAVING COUNT(*) > 1;
-- Resultado esperado: 0 filas

-- 6. Audit logs: ningún log debe apuntar a entidad eliminada
-- (verificación de integridad referencial de audit_logs)
SELECT COUNT(*) FROM audit_logs 
WHERE action NOT IN ('login','logout','deleted','created','updated','status_change','exported','password_change');
-- Resultado esperado: 0
```

### 5.2 Verificar índices críticos

```sql
-- Verificar que los índices de performance existen
SELECT indexname, tablename, indexdef 
FROM pg_indexes 
WHERE schemaname = 'public'
AND tablename IN ('documents','contracts_new','audit_logs','profiles')
ORDER BY tablename;
```

---

## 6. PRUEBAS DE AUDITORÍA (Nivel 2 — crítico legal)

```sql
-- Verificar que toda acción genera audit_log
-- Después de crear un documento, debe existir un log:
SELECT * FROM audit_logs 
WHERE action = 'created' 
AND entity_type = 'document'
ORDER BY performed_at DESC 
LIMIT 5;

-- Verificar que los logs son inmutables (no deben tener UPDATE policies)
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'audit_logs' AND cmd IN ('UPDATE','DELETE');
-- Resultado esperado: 0 filas (no debe haber políticas de UPDATE/DELETE)
```

---

## 7. PRUEBAS DE MULTI-REGIÓN (Nivel 2)

| Prueba | Pasos | Resultado esperado |
|---|---|---|
| Cambiar idioma | Seleccionar EN en i18n | Labels cambian a inglés |
| Cambiar región | Seleccionar organización con región ES | Marco regulatorio muestra RGPD, etc. |
| Documento internacional | Crear doc con región "internacional" | No muestra reguladores específicos VE |
| Conversión de moneda | Ver contrato en USD → cambiar a VES | Monto convertido con tasa BCV |

---

## 8. CHECKLIST PRE-DEPLOY

Completar este checklist ANTES de cada deploy a producción:

```
□ Smoke tests pasaron sin errores
□ Compilación sin errores TypeScript (npm run build)
□ RLS activo en todas las tablas críticas
□ No hay datos de prueba en la base de datos de producción
□ Variables de entorno configuradas correctamente
□ Backup de base de datos realizado (Supabase → Point-in-time recovery)
□ Migraciones aplicadas y verificadas
□ Audit logs funcionando (verificar con prueba manual)
□ Password master temporal eliminado (MasterLegal2026)
□ No hay console.log en código de producción
□ Edge Functions desplegadas y con JWT verificado
```

---

## 9. DATOS DE PRUEBA ESTÁNDAR

> ⚠️ Usar SOLO en entorno de desarrollo/staging, NUNCA en producción.

### Organización de prueba:
```sql
INSERT INTO organizations (id, name, plan, region)
VALUES ('test-org-001', 'Empresa Demo S.A.', 'professional', 'VE');
```

### Usuario de prueba por rol:
```
consultor_general:    admin@demo.legaltech.ve       / DemoAdmin2026!
abogado_senior:       senior@demo.legaltech.ve      / DemoSenior2026!
abogado_junior:       junior@demo.legaltech.ve      / DemoJunior2026!
aprendiz:             aprendiz@demo.legaltech.ve    / DemoAprendiz2026!
```

> **Nota**: Los dominios `@demo.legaltech.ve` identifican visualmente las cuentas de prueba.
> Eliminar todos estos usuarios antes de pasar a producción real.

---

## 10. HERRAMIENTAS DE DIAGNÓSTICO RÁPIDO

```sql
-- Estado general del sistema (ejecutar en Supabase SQL Editor)
SELECT 
    (SELECT COUNT(*) FROM organizations) as organizaciones,
    (SELECT COUNT(*) FROM profiles WHERE is_active = true) as usuarios_activos,
    (SELECT COUNT(*) FROM documents) as documentos,
    (SELECT COUNT(*) FROM contracts_new) as contratos,
    (SELECT COUNT(*) FROM compliance_items) as items_compliance,
    (SELECT COUNT(*) FROM lawyers WHERE is_active = true) as abogados,
    (SELECT COUNT(*) FROM audit_logs) as logs_auditoria,
    (SELECT MAX(performed_at) FROM audit_logs) as ultimo_log;
```

---

*Última actualización: 24/03/2026 | Mantenido por: Antigravity*
*Ejecutar revisión del protocolo: trimestralmente o ante cambios mayores*
