# n8n Multi-Client Manager — Contexto del Proyecto

## Quién soy
Soy dueño de una **agencia de automatización con inteligencia artificial**. Vendo principalmente a **clínicas**, aunque también hago otros desarrollos. Soy experto en construir workflows en n8n, pero **no sé programar ni usar la consola** — esas tareas las hace Claude. Siempre responderme en **español simple y no técnico**, explicando claramente qué se hizo y qué sigue.

## Para qué sirve este proyecto
Es mi asistente personal de desarrollo en n8n. Me permite gestionar múltiples instancias de n8n (una por cliente) desde un solo lugar:
- Ver y buscar workflows
- Activar / desactivar workflows
- Revisar ejecuciones recientes y errores
- Agregar o quitar clientes (instancias de n8n)

---

## Dashboard web (interfaz visual)

**Cómo abrirlo:**
```
n8n-manager dashboard
```
Se abre automáticamente en el navegador en: **http://localhost:3456**

Para usar un puerto diferente:
```
n8n-manager dashboard --port 4000
```

---

## Bot de Telegram (asistente por chat)

**Cómo iniciarlo:**
```
n8n-manager telegram start
```

**Configurar el token (primera vez):**
```
n8n-manager telegram setup
```

El token actual está guardado en `telegram.json` en la raíz del proyecto.

---

## Clientes conectados actualmente

| Nombre   | URL del n8n                                          |
|----------|------------------------------------------------------|
| walter   | https://walter-n8n.xn1onk.easypanel.host/            |
| Javi     | https://javi-clinica-n8n.xn1onk.easypanel.host/      |
| Humberto | https://humberto-clinica-n8n.xn1onk.easypanel.host/  |

Los datos (URL + API Key) se guardan en `clients.json` en la raíz del proyecto.

---

## Comandos CLI disponibles

### Clientes
```bash
n8n-manager client list                          # ver todos los clientes
n8n-manager client add                           # agregar nuevo cliente (interactivo)
n8n-manager client remove --name <nombre>        # eliminar cliente
```

### Workflows
```bash
n8n-manager workflow list --client <nombre>              # listar workflows
n8n-manager workflow get --client <nombre> --id <id>     # obtener workflow como JSON
n8n-manager workflow create --client <nombre> --file wf.json
n8n-manager workflow update --client <nombre> --id <id> --file wf.json
n8n-manager workflow copy --from <cliente> --id <id> --to <cliente>
n8n-manager workflow activate --client <nombre> --id <id>
n8n-manager workflow deactivate --client <nombre> --id <id>
n8n-manager workflow delete --client <nombre> --id <id>
```

### Ejecuciones
```bash
n8n-manager execution list --client <nombre>             # ver ejecuciones recientes
n8n-manager execution get --client <nombre> --id <id>    # detalle de una ejecución
n8n-manager execution errors --client <nombre>           # solo los que fallaron
```

### Flujo para editar un workflow
```bash
n8n-manager workflow get --client Javi --id 123 > wf.json
# (editar wf.json)
n8n-manager workflow update --client Javi --id 123 --file wf.json
```

---

## Estructura del proyecto

```
n8n_claude_code/
├── bin/n8n-manager.js          ← punto de entrada del CLI
├── src/
│   ├── api/client.js           ← llamadas a la API de n8n (apiRequest, fetchAllPages)
│   ├── commands/
│   │   ├── client.js           ← comandos client add/list/remove
│   │   ├── workflow.js         ← comandos workflow *
│   │   └── execution.js        ← comandos execution *
│   ├── config/
│   │   ├── store.js            ← lee/guarda clients.json
│   │   └── paths.js            ← ruta del archivo clients.json
│   ├── server/
│   │   ├── index.js            ← servidor Express del dashboard
│   │   └── routes.js           ← rutas API del dashboard (/api/clients, /api/.../workflows, etc.)
│   ├── telegram/
│   │   ├── bot.js              ← lógica del bot de Telegram
│   │   └── config.js           ← carga/guarda telegram.json
│   └── utils/
│       ├── output.js           ← printTable, printJson, printSuccess, printError
│       ├── prompt.js           ← selectClient(), selectWorkflow() (menús interactivos)
│       └── errors.js           ← ClientNotFoundError, ApiError, handleCommandError
├── public/index.html           ← dashboard web (HTML+JS en un solo archivo)
├── templates/blank-workflow.json
├── clients.json                ← credenciales de clientes (gitignored)
├── telegram.json               ← token del bot de Telegram
└── package.json
```

---

## Datos técnicos importantes

- **API de n8n:** base `{url}/api/v1`, header `X-N8N-API-KEY`
- **Paginación:** usa cursor (`data.nextCursor` o `data.cursor`)
- **Campos readonly** que se eliminan antes de crear/actualizar: `id`, `active`, `createdAt`, `updatedAt`, `versionId`
- **Stack:** Node.js ESM, commander, axios, chalk v5, @inquirer/prompts, cli-table3, ora v8, express
- `clients.json` está en el `.gitignore` para no exponer las API keys

---

## Reglas para Claude

1. **Siempre responder en español**, en términos simples y no técnicos.
2. El usuario **no toca código ni consola** — Claude hace esas tareas.
3. El usuario **es experto en n8n** — se puede preguntar cómo haría algo en n8n para guiar la implementación.
4. Antes de modificar cualquier archivo, **leerlo primero**.
5. Para revisar bases de datos de proyectos, **siempre hacerlo desde n8n con un nodo de Postgres**.
6. Al terminar una tarea, explicar **qué se hizo** y **cuál es el siguiente paso**.
7. Si hay dudas sobre la lógica de negocio, **preguntar al usuario** antes de asumir.
