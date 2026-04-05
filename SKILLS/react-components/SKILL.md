---
name: react-components
description: Patrones de componentes React para LegalDoc VE. Cubre el sistema de diseño HSL, componentes reutilizables, animaciones Framer Motion, manejo de estado y convenciones de estructura de componentes.
---

# Skill: React Components — LegalDoc VE

## 1. SISTEMA DE DISEÑO (CSS Variables HSL)

El sistema de diseño está en `src/assets/styles/global.css`. Usar siempre estas variables:

```css
/* Colores principales */
var(--color-primary)        /* Violeta principal */
var(--color-primary-light)  /* Violeta claro (hover) */
var(--color-accent)         /* Verde compliance */
var(--color-danger)         /* Rojo riesgo crítico */
var(--color-warning)        /* Amarillo alerta */
var(--color-success)        /* Verde éxito */

/* Fondos y superficie */
var(--bg-primary)           /* Fondo principal oscuro */
var(--bg-secondary)         /* Fondo tarjeta */
var(--bg-glass)             /* Fondo glassmorphism */

/* Texto */
var(--text-primary)         /* Texto principal */
var(--text-secondary)       /* Texto secundario/descriptivo */
var(--text-muted)           /* Texto atenuado */

/* Bordes */
var(--border-color)         /* Borde estándar */
var(--border-glass)         /* Borde glassmorphism */
```

---

## 2. CLASES CSS REUTILIZABLES

```css
/* Tarjetas */
.premium-card               /* Card base con glassmorphism */

/* Botones */
.btn-primary                /* Botón principal con gradiente violeta */
.btn-secondary              /* Botón secundario outline */
.btn-danger                 /* Botón de acción destructiva */
.btn-ghost                  /* Botón sin fondo */

/* Badges de estado */
.status-badge               /* Badge base */
.status-draft               /* Gris — borrador */
.status-in-review           /* Azul — en revisión */
.status-approved            /* Verde — aprobado */
.status-published           /* Violeta — publicado */
.status-archived            /* Naranja oscuro — archivado */
.status-expired             /* Rojo — expirado */

/* Indicadores de riesgo */
.risk-low                   /* Verde */
.risk-medium                /* Amarillo */
.risk-high                  /* Naranja */
.risk-critical              /* Rojo pulsante */

/* Layout */
.page-container             /* Contenedor principal de página */
.section-header             /* Header de sección con título y acciones */
.grid-cards                 /* Grid responsive de cards */
```

---

## 3. ESTRUCTURA ESTÁNDAR DE UN COMPONENTE DE VISTA (LIST VIEW)

```typescript
// modules/[modulo]/[Entidad]ListView.tsx
import React, { useState, useEffect } from 'react';
import { authService } from '../../core/auth.service.ts';
import { entidadService } from './entidad.service.ts';
import type { Entidad } from './types.ts';

export const EntidadListView: React.FC = () => {
  const user = authService.getCurrentUser();
  const [items, setItems] = useState<Entidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await entidadService.getAll(user!.organizationId!);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-spinner">Cargando...</div>;
  if (error)   return <div className="error-message">{error}</div>;

  return (
    <div className="page-container">
      <div className="section-header">
        <h1>Título de la Vista</h1>
        {authService.hasPermission(user, 'create_doc') && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Nueva Entidad
          </button>
        )}
      </div>

      <div className="grid-cards">
        {items.map(item => (
          <div key={item.id} className="premium-card">
            {/* Contenido de la card */}
          </div>
        ))}
      </div>

      {showForm && (
        <EntidadForm
          onSave={() => { setShowForm(false); loadItems(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
};
```

---

## 4. ESTRUCTURA ESTÁNDAR DE UN FORMULARIO (MODAL)

```typescript
// modules/[modulo]/[Entidad]Form.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EntidadFormProps {
  initial?: Partial<Entidad>;  // Para modo edición
  onSave: (item: Entidad) => void;
  onCancel: () => void;
}

export const EntidadForm: React.FC<EntidadFormProps> = ({ initial, onSave, onCancel }) => {
  const [formData, setFormData] = useState({ /* defaults */ });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await entidadService.create(formData);
      onSave(result);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      />
      {/* Modal */}
      <motion.div
        className="modal-container"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <form onSubmit={handleSubmit}>
          {/* Campos del formulario */}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  );
};
```

---

## 5. ANIMACIONES FRAMER MOTION — PATRONES ESTÁNDAR

### Entrada de lista con stagger:
```typescript
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.div key={item.id} variants={itemVariants}>
      {/* card content */}
    </motion.div>
  ))}
</motion.div>
```

### Hover en card:
```typescript
<motion.div
  className="premium-card"
  whileHover={{ scale: 1.02, y: -4 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
>
```

---

## 6. NAVEGACIÓN (PATTERN SIN ROUTER)

La navegación se hace via prop `onChangeView` del `MainLayout`. **No usar** `window.location` ni `react-router-dom`.

```typescript
// Desde un componente hijo que necesita navegar
interface Props {
  onChangeView?: (view: string) => void;
}

// Luego:
<button onClick={() => onChangeView?.('contracts')}>Ver Contratos</button>
```

---

## 7. MANEJO DE PERMISOS EN UI

```typescript
const user = authService.getCurrentUser();

// Mostrar/ocultar elementos según permiso
{authService.hasPermission(user, 'approve_contracts') && (
  <button onClick={handleApprove}>Aprobar Contrato</button>
)}

// Deshabilitar input según rol
<input
  disabled={!authService.hasPermission(user, 'edit_doc')}
/>
```

---

## 8. CONVENCIONES DE NOMENCLATURA

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes | PascalCase | `ContractListView` |
| Hooks custom | camelCase + `use` | `useContractData` |
| Servicios | camelCase singleton | `contractService` |
| Tipos/Interfaces | PascalCase | `ContractStatus` |
| Constantes | camelCase o SCREAMING | `DocumentType`, `MAX_ITEMS` |
| Archivos | camelCase o PascalCase.tsx | `contract.service.ts` |

---

*Última actualización: 21/03/2026*
