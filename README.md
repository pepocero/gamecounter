# GameScore

Marcador deportivo en el navegador con estilo de transmisión en vivo: **fútbol** y **baloncesto**. Pensado para móvil y usable como **PWA** (instalable).

Los datos se guardan **solo en tu dispositivo** (localStorage); no hay servidor ni cuenta.

## Funcionalidades

- **Partidos en vivo**: marcador, cronómetro de juego, anotaciones con jugador y tiempo (si indicas plantilla).
- **Fútbol**: goles. **Baloncesto**: puntos +1, +2, +3.
- **Equipos guardados**: nombre, color, escudo, plantilla de jugadores y **cántico o himno** (audio); reutilizables al crear partidos.
- **Próximos partidos**: programar y arrancar el marcador cuando toque.
- **Historial y estadísticas**; pantalla de **compartir** al finalizar (incl. imagen resumen).
- **Exportar / importar** copia de seguridad en JSON (partidos y equipos, con imágenes y audio en Base64).
- **Tema oscuro / claro** (Configuración).
- **Actualización PWA**: desde Configuración, *Buscar actualizaciones* o *Cargar última versión* si la app instalada no muestra la última build.

## Requisitos

- [Node.js](https://nodejs.org/) 18+ (recomendado LTS)

## Desarrollo

```bash
npm install
npm run dev
```

Abre la URL que indique Vite (normalmente `http://localhost:5173`).

## Build de producción

```bash
npm run build
```

La salida queda en `dist/`. Para previsualizar el build:

```bash
npm run preview
```

Despliega el contenido de `dist/` en tu hosting estático (p. ej. Cloudflare Pages, Netlify, etc.). Si usas cabeceras de caché para `sw.js` e `index.html`, revisa `public/_headers` o la configuración equivalente en el panel.

## Stack técnico

- [Vite](https://vitejs.dev/) 5
- JavaScript (ES modules), sin framework
- Estilos en CSS
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (service worker y manifest)

## Versión

La versión del proyecto está en `package.json` y se usa en la configuración de Workbox (`cacheId`) para facilitar las actualizaciones de la PWA.

---

*GameScore / gamecounter*
