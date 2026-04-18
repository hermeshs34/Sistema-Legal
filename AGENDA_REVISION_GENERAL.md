# 📋 Agenda de Revisión General — LegalDoc-VE

Esta agenda resume los puntos críticos a validar para asegurar que la transición al sistema multi-moneda sea robusta y cumpla con todos los estándares legales y contables del despacho.

## 1. Integridad Financiera y Conversiones
- [ ] **Validación de Asuntos:** Verificar que el presupuesto nominal (EUR/VES) se guarde correctamente y su equivalente en USD sea preciso según la tasa del día.
- [ ] **Bitácora de Horas:** Probar registros en diferentes divisas y confirmar que el cálculo de `amountUsd` e `isInvoiced` funcione sin errores.
- [ ] **Gastos:** Revisar que los gastos pagados por el despacho vs. pagados por el cliente se visualicen correctamente en la moneda de presentación.

## 2. Auditoría de Reportes PDF
- [ ] **Símbolos y Divisas:** Generar reportes consolidando en USD, EUR y VES para asegurar que el símbolo (`$`, `€`, `Bs.`) aparezca correctamente en cada caso.
- [ ] **Cálculos de Totales:** Verificar que la suma de facturas pendientes y cobradas en el PDF coincida exactamente con lo mostrado en el Dashboard.
- [ ] **Trazabilidad:** Confirmar que los reportes de gastos incluyan la columna "Monto Nominal" para mantener el respaldo de la factura original.

## 3. Experiencia de Usuario (UI/UX)
- [ ] **Consistencia de Símbolos:** Revisar que no queden signos `$` hardcodeados en ninguna parte del Dashboard.
- [ ] **Selectores de Divisa:** Validar que los modales de "Nuevo Asunto" y "Registro de Tiempo" bloqueen o adviertan si falta definir la moneda o la tasa de cambio.
- [ ] **Gráficos:** Confirmar que las barras de "Facturación vs Cobro" se escalen correctamente al cambiar de moneda global.

## 4. Estabilidad y Despliegue
- [ ] **Netlify Check:** Verificar que el sitio cargue correctamente y no haya errores de "Chunk Load" tras las optimizaciones de `vite.config.ts`.
- [ ] **Sincronización:** Asegurar que el botón "Sincronizar" en la vista de honorarios traiga los datos más recientes de Supabase sin duplicados.

---
**Próxima Sesión:** Revisión paso a paso de estos puntos y ajuste fino según el feedback de uso real. ⚖️📈🚀
