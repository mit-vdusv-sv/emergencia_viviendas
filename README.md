# Atención Fenomeno del Niño

Dashboard local para seguir beneficiarios pre calificados, atención de vivienda y contexto climático en Ecuador. La vivienda ocupa la pantalla principal. La paleta usa azul, amarillo y rojo sobre blanco.

## Abrir

Requiere Node.js 22 o posterior. En Windows abre `iniciar.cmd`, o ejecuta desde esta carpeta:

```sh
node scripts/server.mjs
```

Abre **http://127.0.0.1:4173** y mantén la terminal abierta. El servidor escucha solo en la computadora local. La variable `PORT` permite escoger otro puerto. No hace falta instalar paquetes ni usar claves de API.

## Pantallas

- **Resumen:** beneficiarios pre calificados como indicador principal, provincias con afectación, reparaciones menores, mapa y modalidades de atención. El clima aparece como complemento.
- **Vivienda:** tabla completa, búsqueda, filtros, detalle por provincia y exportación CSV.
- **Clima:** avisos por zona, anomalías NOAA, último informe ERFEN y exposición territorial SNGR. Las explicaciones se despliegan al solicitarlas.
- **Datos y fuentes:** importación de CSV propio, copias disponibles y observaciones de calidad.

## Actualización automática

**En GitHub Pages:** el workflow incluido consulta vivienda y alertas cada cinco minutos y las cinco fuentes una vez al día. Si cambia el contenido, guarda los JSON en el repositorio y vuelve a publicar. Funciona aunque tu computadora y el dashboard estén apagados. La pestaña abierta revisa los JSON publicados cada cinco minutos, sin recargar la página.

**En local:** la aplicación consulta vivienda y alertas cada cinco minutos con el servidor Node activo. Su caché también es de cinco minutos. Las demás fuentes se consultan al abrir y con **Actualizar fuentes**, con las cachés indicadas abajo.

El indicador **Auto · 5 min** identifica el servidor local y **Copias · 5 min** la revisión de archivos publicados. Si falla la conexión, se conserva la última copia válida. Al recuperar Internet o volver a una pestaña suspendida, se retoma la actualización. No se superponen dos ciclos del navegador. Una pestaña cerrada no consulta, pero las tareas de GitHub siguen su programación.

El intervalo de GitHub es aproximado: puede retrasar u omitir ejecuciones en períodos de carga. A la consulta se suman el tiempo de publicación y hasta cinco minutos de revisión del navegador. No es tiempo real garantizado. Consulta las ejecuciones en **Actions**; la fecha visible corresponde a la copia conservada, no a cada comprobación sin cambios, y no sustituye la fecha de corte. Los repositorios públicos sin actividad durante 60 días pueden tener sus tareas programadas deshabilitadas. [Límites de las tareas programadas](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Una base de vivienda importada se conserva: el ciclo automático actualiza las alertas y no sobrescribe el CSV propio. **Restaurar copia** vuelve al JSON incluido y permite consultar de nuevo la hoja de Google.

| Fuente | Caché del servidor | Frecuencia del contenido |
|---|---:|---|
| Hoja de vivienda | 5 min | Depende de quien completa la hoja |
| Alertas INAMHI | 5 min | Emisión de mensajes y boletines |
| NOAA OISST | 6 horas | Serie mensual |
| Índice ERFEN | 24 horas | Boletines periódicos |
| SNGR ArcGIS | 24 horas | Análisis de exposición |

Las cinco fuentes se consultan de forma independiente. Un fallo no reemplaza un respaldo válido ni impide visualizar la base. La cartografía está incluida localmente.

Para renovar los archivos desde la terminal:

```sh
node scripts/refresh.mjs
```

## Datos de vivienda

La base procede de la [hoja suministrada](https://docs.google.com/spreadsheets/d/1WoxZ11c5MAoZ6nhcRymTvVK6GkV6kBOG/edit?gid=1128467625). La aplicación no modifica esa hoja.

La interfaz usa el rótulo **Beneficiarios pre calificados**. El indicador conserva los valores de la columna B de la hoja, cuya unidad original es hogares.

La captura inicial reporta 331 hogares en la columna B, frente a 379 en el resumen amarillo y rojo. Las modalidades pueden coincidir en un hogar y no se suman como casos únicos. Se conservan los ceros y los vacíos: un vacío es información pendiente. Los calificados forman parte de los identificados; no se calcula una tasa si no están registrados. La fecha de corte inicial está vacía.

Las observaciones textuales no se transforman en casos. La mención de 48 viviendas en Manabí no reemplaza el 0 de la columna de hogares. Los subtotales rojos de la fuente se mantienen en el detalle con sus observaciones de calidad.

La importación admite el CSV original de la hoja o una plantilla de 24 provincias. Se guarda solo en el navegador. La exportación refleja el filtro actual; para importar una base completa se requieren las 24 provincias.

`data/hoja-original.csv` conserva la captura inicial para trazabilidad y pruebas; no se reescribe al actualizar los JSON.

## Contexto climático

Las tarjetas agrupan mensajes CAP por área, fenómeno y expiración, con la severidad máxima publicada. El detalle conserva todos los mensajes originales y recomendaciones. No se cuentan como eventos independientes. Los fallos parciales del lector de boletines se muestran como cobertura parcial.

Los índices NOAA son anomalías OISST mensuales de Niño 1+2 y Niño 3.4; no son ONI/RONI ni una declaratoria local. ERFEN es periódico y se debe revisar el período del PDF.

La exposición SNGR es población potencialmente expuesta hasta 1.500 m. La captura inicial cubre 483 parroquias de 16 provincias. No equivale a afectados, las dos amenazas no se suman y se preservan los campos combinados publicados.

## Preparar para GitHub

Consulta [GUIA-GITHUB.md](GUIA-GITHUB.md) para subir el contenido del paquete y publicar el dashboard.

No se creó ni publicó un repositorio remoto. Tras subir el proyecto a la rama predeterminada, selecciona **Settings → Pages → Source → GitHub Actions** y ejecuta **Publicar y actualizar dashboard**. También se ejecuta al subir cambios a esa rama. La programación automática queda definida en `.github/workflows/pages.yml`; GitHub debe tener Actions habilitado y permitir al workflow guardar los JSON.

```sh
node --test tests/*.test.mjs
node scripts/build.mjs
```

La vista estática queda en `dist/`, con rutas relativas para subcarpetas de GitHub Pages.

**GitHub Actions ejecuta los conectores Node y GitHub Pages sirve los resultados.** No se necesita mantener un backend ni una computadora encendida. Solo se guardan cambios reales de contenido, evitando commits por cada hora de consulta. Si todas las fuentes solicitadas fallan, esa ejecución falla y el sitio anterior sigue disponible. No se usan proxies públicos para evadir CORS.

## Código y fuentes

```text
app.mjs, index.html, styles.css  Interfaz y navegación
src/surfaces.mjs                Vistas de vivienda, clima y fuentes
src/auto-refresh.mjs            Ciclo de cinco minutos y recuperación
src/data-refresh.mjs            Lectura de API o copias publicadas sin caché
src/model.mjs                   CSV, cálculos, filtros y validaciones
src/connectors.mjs              Lectura de cinco fuentes públicas
scripts/                       Servidor, actualización y construcción
data/                          Copias incluidas y cartografía
tests/                         Cálculos, respaldo y actualización automática
FUENTES.md                     Investigación y alcance de cada fuente
```

La cartografía es [geoBoundaries ECU ADM1](https://www.geoboundaries.org/api/current/gbOpen/ECU/ADM1/), CC0, límites de 2011. Galápagos aparece en otra escala. Consulta [FUENTES.md](FUENTES.md) para los endpoints y sus límites.
