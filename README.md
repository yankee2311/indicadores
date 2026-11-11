# Indicadores | Oficina de Automatización

Plataforma web de prueba de concepto (PoC) para administrar solicitudes, proyectos, tareas, avances diarios, activos de automatización, riesgos, autorizaciones, ejecuciones, incidencias, documentación y KPIs.

**Stack:** HTML5, CSS3, JavaScript vanilla, Node.js >=22.16 y SQLite integrado a Node 22. Sin dependencias externas.

> Repositorio público: el código no contiene archivos internos de Grupo ATC, datos de colaboradores ni credenciales. Los catálogos iniciales son ficticios.

## Ejecución local

Requiere Node.js 22.16 o superior. No es necesario ejecutar npm install.

Primera ejecución en PowerShell:

    $env:BOOTSTRAP_ADMIN_PASSWORD='CambiarPorUnaClaveUnica2026!'
    npm start

En macOS/Linux:

    BOOTSTRAP_ADMIN_PASSWORD='CambiarPorUnaClaveUnica2026!' npm start

Abrir **http://localhost:3000** y entrar con el usuario \`admin\` y la clave creada. Retirar inmediatamente la variable de contraseña después de generar la cuenta; la contraseña no se volverá a necesitar para arrancar.

La base de datos se conserva en \`data/indicadores.sqlite\` y está excluida del control de versiones. Configuración opcional en \`.env.example\` (variables de entorno, no se carga automáticamente un .env). Ejecutar pruebas con \`npm test\`.

## Módulos

| Sección | Capacidades |
|---|---|
| Ejecutivo | KPIs de demanda, operación, beneficios, eficiencia y actividad |
| Solicitudes | Intake, tecnología, modalidad no-code/low-code/tradicional y scoring |
| Proyectos | Asignación, fechas, bloqueos, hitos, costo y seguimiento |
| Tareas | Compromisos, responsables, avance ponderado y cumplimiento |
| OnePage | Captura diaria con horas, avances, siguiente actividad, impedimento y evidencia |
| Inventario | Activos, propietario funcional/técnico, tecnologías, riesgo y controles |
| Gobierno | Evaluaciones de riesgo, autorizaciones y bloqueo de liberación |
| Operación | Ejecuciones, incidencias, raíz del problema y estado |
| Documentos | Referencias web a PDD, SDD, pruebas, manuales y liberaciones |
| Administración | Empresas, usuarios con roles y bitácora de auditoría |

**Reglas de producción:** antes de liberar una automatización, el backend verifica registro, responsable funcional y técnico, NHI, PAM, rotación, logs, suspensión inmediata, reversión, continuidad manual, pruebas, documentación, evaluación de riesgo y aprobaciones. Riesgo alto requiere comité de seguridad; medio requiere negocio y Ciberseguridad; bajo requiere jefatura y registro. Riesgo inaceptable está bloqueado.

**Indicadores:** éxito = ejecuciones correctas / ejecuciones totales; compromisos = tareas aceptadas dentro de fecha / tareas vencidas; avance ponderado = peso terminado / peso total; ahorro neto mensual = horas × costo horario − costo operativo. Sin observaciones, las tasas se presentan como N/D.

## API

Autenticación: \`POST /api/login\`, \`POST /api/logout\`, \`GET /api/me\`.

Catálogos: \`GET /api/meta\`, \`POST /api/companies\`, \`POST /api/users\`.

Analítica: \`GET /api/dashboard\`, \`GET /api/onepage\`, \`GET /api/audit\`.

Registros con \`GET\`, \`POST\`, \`PATCH\` según permisos: \`/api/requests\`, \`/api/projects\`, \`/api/tasks\`, \`/api/daily_updates\`, \`/api/assets\`, \`/api/executions\`, \`/api/incidents\`, \`/api/documents\`.

Gobierno: \`POST /api/risk-reviews\`, \`POST /api/approvals\`, \`GET /api/assets/:id/readiness\`.

Perfiles: administrador, PM, desarrollador, Ciberseguridad, ejecutivo y consulta. La API valida los permisos, independientemente de la interfaz.

## Seguridad y límites de esta versión

Se usan contraseñas scrypt, sesiones HttpOnly SameSite=Strict, expiración de sesiones, controles de cabeceras, CSP, validaciones de entrada y auditoría. El rol administrador puede simular autorizaciones para evaluar la PoC.

**No es un producto listo para producción corporativa.** Antes de su despliegue se requiere integrar SSO y revisión real de autoridades, aislamiento de información por empresa, vínculos y firma de evidencias, Openser, PAM, SIEM, repositorio documental, gestión de backups, secretos y controles de redes, monitoreo y pruebas de seguridad. Los checks de seguridad actualmente son controles declarativos y no validan técnicamente PAM ni SIEM. SQLite es apropiado solo para esta etapa de baja concurrencia; Node 22 marca su módulo SQLite como experimental.

Los documentos se guardan como metadatos y URLs, no como archivos. No se almacenan secretos de bots ni datos operativos reales. El código de autorización aplica el marco del documento corporativo analizado, sin suponer que el código sustituya el proceso formal.

## Estructura

- \`server.js\`: API, SQLite, roles, riesgo, aprobación y métricas.
- \`public/\`: SPA responsive HTML/CSS/JS.
- \`tests/\`: pruebas integradas de seguridad y flujo completo.
- \`.github/workflows/ci.yml\`: test automático.
- \`data/\`: información local excluida de Git.

Licencia: no declarada.
