# 🏗️ ARCHITECTURE.md — Arquitectura Técnica: LegalDoc VE

> Documento de referencia técnica para desarrolladores y agentes IA.

---

## 1. DIAGRAMA GENERAL

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO FINAL                            │
│                   (Browser — React SPA)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (SPA)                              │
│           React 18 + Vite + TypeScript + Framer Motion          │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │Dashboard │  │Documents │  │Contracts │  │  Compliance  │   │
│  │  View    │  │  Center  │  │  Editor  │  │  & Risks     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐  │
│  │  Legal   │  │   IAM    │  │    Core Services              │  │
│  │  Team    │  │ Users/   │  │  auth.service.ts              │  │
│  │          │  │  Login   │  │  supabase.ts (client)         │  │
│  └──────────┘  └──────────┘  └──────────────────────────────┘  │
└──────────────┬────────────────────────┬────────────────────────┘
               │                        │
               │ Supabase JS SDK        │ OpenAI REST API
               ▼                        ▼
┌──────────────────────────┐  ┌─────────────────────┐
│        SUPABASE           │  │    OPENAI API        │
│                           │  │                     │
│  ┌─────────────────────┐ │  │  gpt-4o / gpt-4o-   │
│  │   Postgres DB        │ │  │  mini para análisis  │
│  │   (con RLS activo)   │ │  │  de contratos y      │
│  └─────────────────────┘ │  │  jurisdiccional       │
│  ┌─────────────────────┐ │  └─────────────────────┘
│  │   Supabase Auth      │ │
│  │   (JWT + Sessions)   │ │
│  └─────────────────────┘ │
│  ┌─────────────────────┐ │
│  │   Supabase Storage   │ │
│  │   (PDFs, Contratos)  │ │
│  └─────────────────────┘ │
│  ┌─────────────────────┐ │
│  │   Edge Functions     │ │
│  │   (Deno Runtime)     │ │
│  │   - Tasas BCV        │ │
│  │   - Notificaciones   │ │
│  └─────────────────────┘ │
└──────────────────────────┘

⚠️  LEGACY (Pendiente eliminar):
┌──────────────────────────┐
│  server/ — Express+Node   │
│  Prisma ORM + SQLite      │
│  Puerto 3000              │
│  Estado: DEPRECADO        │
└──────────────────────────┘
```

---

## 2. FLUJO DE AUTENTICACIÓN

```
Usuario → LoginView.tsx
    │
    ├─→ authService.login(email, password)
    │       │
    │       ├─[password=MasterLegal2026]→ Bypass EMERGENCY (⚠️ eliminar)
    │       │       └─→ Query directa a tabla `profiles` en Supabase
    │       │
    │       └─[password normal]→ supabase.auth.signInWithPassword()
    │               └─→ Query a tabla `profiles` por auth.user.id
    │
    ├─→ User persisted: localStorage['legal_user']
    │
    └─→ App.tsx: setUser(user) → renderiza MainLayout
```

---

## 3. FLUJO DE DATOS (CRUD TÍPICO)

```
Vista React (e.g. DocumentListView)
    │
    ├─→ documents.service.ts
    │       └─→ supabase.from('documents').select(...)
    │               .eq('organization_id', user.organizationId)
    │               [RLS también filtra por organización]
    │
    ├─→ [On mutation] audit.service.ts
    │       └─→ supabase.from('audit_logs').insert({...})
    │
    └─→ Estado local React (useState / props lifting)
```

---

## 4. MODELO MULTI-TENANT

El sistema es multi-organización (multi-tenant). Cada registro de datos incluye `organization_id`.

```
organizations (tabla maestra)
    │
    ├─→ profiles (usuarios de esa org)
    │       └─→ role: consultor_general | abogado_senior | abogado_junior | ...
    │
    ├─→ documents
    ├─→ contracts
    ├─→ compliance_items
    ├─→ lawyers
    └─→ audit_logs
```

**RLS (Row Level Security)** en Supabase garantiza que los usuarios solo vean datos de su `organization_id`.

---

## 5. SISTEMA DE DISEÑO

### Paleta de colores (HSL Variables):
```css
--primary-hue: 247;           /* Violeta corporativo */
--color-primary: hsl(247, 70%, 60%);
--color-accent: hsl(162, 73%, 46%);   /* Verde compliance */
--color-danger: hsl(0, 72%, 51%);     /* Rojo riesgo crítico */
--color-warning: hsl(38, 92%, 50%);   /* Amarillo alerta */
```

### Clases de utilidad clave:
```css
.premium-card       /* Card con glassmorphism y sombra */
.btn-primary        /* Botón principal con gradiente */
.btn-secondary      /* Botón secundario */
.status-badge       /* Badge de estado con color semántico */
.risk-indicator     /* Indicador visual de nivel de riesgo */
```

---

## 6. NAVEGACIÓN (Sin Router)

La navegación usa un patrón de **Single State Switch** en `App.tsx`:

```typescript
const [currentView, setCurrentView] = useState('dashboard');

// Vistas disponibles:
// 'dashboard' | 'documents' | 'contracts' | 'compliance' | 
// 'risks' | 'lawyers' | 'users'
```

No hay `react-router-dom`. El cambio de vista es via `onChangeView` prop del `MainLayout`.

---

## 7. DEPENDENCIAS CLAVE

```json
{
  "react": "^18.x",
  "typescript": "^5.x",
  "vite": "^6.x",
  "@supabase/supabase-js": "^2.x",
  "framer-motion": "^12.x",
  "axios": "^1.x",
  "quill": "(editor rich-text en ContractEditor)",
  "recharts": "(gráficos en Dashboard y RiskMatrix)"
}
```

---

## 8. VARIABLES DE ENTORNO

| Variable | Requerida | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Clave anon pública de Supabase |

---

## 9. COMANDOS DEL PROYECTO

```bash
# Desarrollo
npm run dev                  # Frontend en http://localhost:5173

# Build
npm run build                # Bundle de producción en dist/

# Linting
npm run lint                 # ESLint con TypeScript

# Backend legacy (NO usar para nuevo código)
cd server && npm run dev     # Express en puerto 3000
```

---

*Última actualización: 21/03/2026 | Mantenido por: Antigravity*
