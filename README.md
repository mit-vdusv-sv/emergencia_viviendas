# Atención Fenomeno del Niño

Dashboard local para seguir soluciones habitacionales a entregarse, atención de vivienda y contexto climático en Ecuador. La vivienda ocupa la pantalla principal. La paleta usa azul, amarillo y rojo sobre blanco.

## Abrir

Requiere Node.js 22 o posterior. En Windows abre `iniciar.cmd`, o ejecuta desde esta carpeta:

```sh
node scripts/server.mjs
```

Abre **http://127.0.0.1:4173** y mantén la terminal abierta. El servidor escucha solo en la computadora local. La variable `PORT` permite escoger otro puerto. No hace falta instalar paquetes ni usar claves de API.

## Pantallas

- **Resumen:** soluciones habitacionales a entregarse como indicador principal, provincias con soluciones, reparaciones menores, mapa y modalidades de atención. El resumen no incluye el panel de contexto climático. La sección Clima continúa disponible.
- **Vivienda:** tabla completa, búsqueda, filtros, detalle por provincia y exportación CSV.
- **Clima:** avisos por zona, anomalías NOAA, último informe ERFEN y exposición territorial SNGR. Las explicaciones se despliegan al solicitarlas.
- **Datos y fuentes:** importación de CSV propio, copias disponibles y observaciones de calidad.

## Actualización automática

**Vivienda: conexión directa con Google Sheets.** El navegador consulta el CSV público de la hoja al abrir, al volver a la pestaña y cada tres segundos mientras está visible. Usa una URL distinta en cada lectura y desactiva la caché. No consulta el JSON publicado ni el servidor Node para obtener los datos actuales. Cuando cambia la hoja, actualiza el mapa, los filtros y los indicadores sin publicar otra versión en GitHub.

El indicador **Sheets · directo** confirma que la última lectura de Google fue válida. Su descripción muestra la hora de comprobación con segundos. Una conexión fallida cambia a **Vivienda · respaldo**, conserva los datos y reintenta con espera progresiva. No se superponen solicitudes. La lectura se pausa al ocultar la pestaña y se retoma inmediatamente al volver. Los datos que no cambian no vuelven a dibujar toda la pantalla.

La comprobación es de tres segundos después de terminar la solicitud anterior, más la latencia y propagación de Google. Es sincronización directa en pocos segundos, no una notificación push de cada edición. No se garantiza una demora de cero segundos. La hoja debe conservar acceso público de lectura. No se escriben datos ni se envían credenciales a Google.

Un CSV propio importado se conserva. **Usar Google Sheets** vuelve a activar la conexión directa. La última lectura válida se guarda en el navegador y el paquete también incluye un respaldo para abrir el dashboard si Google no responde.

**Fuentes institucionales:** GitHub Actions consulta INAMHI cada cinco minutos; NOAA, ERFEN y SNGR se consultan a diario, junto con un respaldo de vivienda. El navegador revisa las copias institucionales publicadas cada cinco minutos. Estos ciclos son independientes: una consulta externa lenta no detiene la lectura directa de Google Sheets. En local se utiliza la API Node para las fuentes institucionales; vivienda sigue usando la conexión directa.

Los trabajos programados de GitHub pueden retrasarse; esto afecta las copias institucionales y el respaldo, no la lectura directa de vivienda. [Límites de programación](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Para renovar manualmente los respaldos desde la terminal:

```sh
node scripts/refresh.mjs
```

## Datos de vivienda

La base procede de la [hoja suministrada](https://docs.google.com/spreadsheets/d/1WoxZ11c5MAoZ6nhcRymTvVK6GkV6kBOG/edit?gid=1128467625). La aplicación no modifica esa hoja.

El indicador principal es **Soluciones habitacionales a entregarse** y toma el total nacional directamente de **N8**. La columna B ya no se usa ni se valida para el dashboard. En las vistas filtradas se suman los valores de N de las provincias seleccionadas.

El mapa, la tabla, el detalle y su orden predeterminado usan la columna N. El contador incluye solo provincias con N mayor que cero. Un 0 es un dato registrado y una celda vacía sigue pendiente. Si N8 difiere de la suma provincial, el indicador nacional conserva el valor de N8 y las observaciones de calidad permiten revisar la diferencia.

Los campos originales de atención y sus valores se conservan. El nombre interno heredado de N es `combinedReported`; el campo `affected` se mantiene vacío solo para compatibilidad con las plantillas CSV anteriores.

La importación admite el CSV original de la hoja o una plantilla de 24 provincias. Se guarda solo en el navegador. La exportación refleja el filtro actual; para importar una base completa se requieren las 24 provincias.

`data/hoja-original.csv` conserva la captura inicial para trazabilidad y pruebas; no se reescribe al actualizar los JSON.

## Contexto climático

Las tarjetas agrupan mensajes CAP por área, fenómeno y expiración, con la severidad máxima publicada. El detalle conserva todos los mensajes originales y recomendaciones. No se cuentan como eventos independientes. Los fallos parciales del lector de boletines se muestran como cobertura parcial.

Los índices NOAA son anomalías OISST mensuales de Niño 1+2 y Niño 3.4; no son ONI/RONI ni una declaratoria local. ERFEN es periódico y se debe revisar el período del PDF.

La exposición SNGR es población potencialmente expuesta hasta 1.500 m. La captura inicial cubre 483 parroquias de 16 provincias. No equivale a afectados, las dos amenazas no se suman y se preservan los campos combinados publicados.


## Símbolos animados de lluvia y movimientos en masa

En **Resumen → mapa principal**, el selector **Animaciones** permite distinguir dos fuentes:

- **Exposición SNGR (predeterminada):** nubes con gotas representan provincias con población potencialmente expuesta a inundaciones; las piedras representan exposición a movimientos en masa. **No implica que esté lloviendo, haya una inundación o esté ocurriendo un deslizamiento en ese momento**. Solo se señalan las provincias cubiertas por el servicio publicado. Las pestañas Inundaciones y Mov. en masa muestran únicamente la amenaza seleccionada.
- **Avisos INAMHI:** anima exclusivamente avisos vigentes con provincias mencionadas expresamente. Los avisos regionales que no identifican provincias no se distribuyen arbitrariamente. Las alertas caducadas no aparecen. La copia CAP incluida en este ZIP no contiene avisos vigentes al 16 de noviembre de 2026; el origen se actualiza con el mecanismo existente. Las piedras solo aparecen si un aviso identifica explícitamente movimientos en masa; **el proyecto no dispone actualmente de un registro en tiempo real de deslizamientos ocurridos**.

Las animaciones son SVG y CSS, no descargan gráficos de terceros, respetan la preferencia de movimiento reducido y no bloquean la selección de provincias ni los filtros. La capa animada está en `src/map-effects.mjs`, los estilos en `styles.css` y las pruebas en `tests/map-effects.test.mjs`.

## Preparar para GitHub

Consulta [GUIA-GITHUB.md](GUIA-GITHUB.md) para subir el contenido del paquete y publicar el dashboard.

El dashboard está publicado en https://mit-vdusv-sv.github.io/emergencia_viviendas/. Para otra publicación, tras subir el proyecto a la rama predeterminada, selecciona **Settings → Pages → Source → GitHub Actions** y ejecuta **Publicar y actualizar dashboard**. También se ejecuta al subir cambios a esa rama. La programación automática queda definida en `.github/workflows/pages.yml`; GitHub debe tener Actions habilitado y permitir al workflow guardar los JSON.

```sh
node --test tests/*.test.mjs
node scripts/build.mjs
```

La vista estática queda en `dist/`, con rutas relativas para subcarpetas de GitHub Pages.

**GitHub Pages sirve la aplicación y el navegador lee vivienda directamente de Google Sheets. GitHub Actions ejecuta los conectores institucionales y renueva los respaldos.** No se necesita mantener un backend ni una computadora encendida. Solo se guardan cambios reales de contenido, evitando commits por cada hora de consulta. Si todas las fuentes solicitadas fallan, esa ejecución falla y el sitio anterior sigue disponible. La conexión directa utiliza el acceso público de lectura que ofrece Google; no se usan proxies públicos.

## Código y fuentes

```text
app.mjs, index.html, styles.css  Interfaz y navegación
src/surfaces.mjs                Vistas de vivienda, clima y fuentes
src/auto-refresh.mjs            Ciclo de cinco minutos y recuperación
src/data-refresh.mjs            Lectura de API o copias institucionales sin caché
src/housing-live.mjs            Conexión directa con Google Sheets cada 3 segundos
src/model.mjs                   CSV, cálculos, filtros y validaciones
src/connectors.mjs              Lectura de cinco fuentes públicas
scripts/                       Servidor, actualización y construcción
data/                          Copias incluidas y cartografía
tests/                         Cálculos, respaldo y actualización automática
FUENTES.md                     Investigación y alcance de cada fuente
```

La cartografía es [geoBoundaries ECU ADM1](https://www.geoboundaries.org/api/current/gbOpen/ECU/ADM1/), CC0, límites de 2011. Galápagos aparece en otra escala. Consulta [FUENTES.md](FUENTES.md) para los endpoints y sus límites.
