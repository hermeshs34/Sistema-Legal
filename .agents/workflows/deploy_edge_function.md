---
description: Cómo desplegar una Edge Function de Supabase para LegalDoc VE (ej. actualización de tasas BCV, análisis IA)
---

# Workflow: Deploy de Edge Function (Supabase)

Las Edge Functions son funciones serverless en Deno que corren en la infraestructura de Supabase. Úsalas para: lógica de servidor, llamadas a APIs externas con claves secretas, crons automáticos.

## Cuándo usar una Edge Function

- Llamadas a OpenAI con API Key (nunca desde el frontend en producción)
- Actualización de tasas de cambio BCV
- Envío de notificaciones por correo
- Operaciones con Service Role Key (bypasear RLS)
- Webhooks externos

## Paso 1: Diseñar la función

Definir claramente:
- **Nombre**: en kebab-case (e.g., `update-exchange-rates`, `analyze-document`)
- **Trigger**: HTTP request, cron, webhook
- **Input**: body JSON esperado
- **Output**: JSON de respuesta
- **¿Require JWT?**: Sí si es endpoint del usuario; No si es cron/webhook con API key propia

## Paso 2: Escribir el código de la función

```typescript
// Función de ejemplo: proxy de análisis IA
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Autenticar al usuario (si verify_jwt = true, Supabase lo hace automáticamente)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Obtener datos del request
    const { documentId } = await req.json();

    // 3. Lógica principal (ej. llamar a OpenAI con clave segura)
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    // ... lógica aquí

    // 4. Responder
    return new Response(
      JSON.stringify({ success: true, result: {} }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
```

## Paso 3: Desplegar con el MCP de Supabase

```
mcp_supabase-mcp-server_deploy_edge_function
  project_id: [ID del proyecto]
  name: [nombre-funcion]          ← kebab-case
  entrypoint_path: index.ts
  verify_jwt: true                ← true si requiere auth de usuario
  files: [
    {
      name: "index.ts",
      content: "[código de la función]"
    }
  ]
```

## Paso 4: Configurar variables de entorno (secretos)

Los secretos de las Edge Functions NO van en el `.env` del proyecto. Se configuran en **Supabase Dashboard → Edge Functions → [función] → Secrets**.

Variables que típicamente se necesitan:
- `OPENAI_API_KEY` — Para funciones de análisis IA
- `SENDGRID_API_KEY` — Para notificaciones por correo
- `BCV_API_URL` — Para actualización de tasas

> Las variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` están disponibles automáticamente.

## Paso 5: Llamar a la Edge Function desde el frontend

```typescript
// En el servicio correspondiente del frontend
const { data, error } = await supabase.functions.invoke('nombre-funcion', {
  body: { documentId: '...' }
});

if (error) throw new Error(error.message);
```

## Paso 6: Verificar el despliegue

```
mcp_supabase-mcp-server_list_edge_functions
  project_id: [ID]
```

## Paso 7: Monitorear logs

Si la función falla:
```
mcp_supabase-mcp-server_get_logs
  project_id: [ID]
  service: edge-function
```

## Edge Functions planeadas para LegalDoc VE

| Función | Trigger | Propósito | Estado |
|---|---|---|---|
| `analyze-document` | HTTP | Análisis IA con OpenAI | 🔜 Pendiente |
| `update-exchange-rates` | Cron diario | Tasas BCV/BCE | 🔜 Pendiente |
| `send-compliance-alerts` | Cron diario | Alertas de vencimiento | 🔜 Pendiente |
| `expire-documents` | Cron diario | Marcar docs expirados | 🔜 Pendiente |
| `generate-pdf-report` | HTTP | Exportar PDF certificado | 🔜 Pendiente |

## Errores comunes

| Error | Causa | Solución |
|---|---|---|
| `FunctionsFetchError` | URL incorrecta o función no desplegada | Verificar `list_edge_functions` |
| `401 Unauthorized` | JWT no enviado o expirado | Verificar `Authorization` header |
| `500 Internal Server Error` | Error en código de la función | Revisar `get_logs` |
| `CORS error` | Falta handler de OPTIONS | Agregar respuesta a `req.method === 'OPTIONS'` |
