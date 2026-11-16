# Fuentes verificadas y vías de integración

Consulta realizada el **14 de noviembre de 2026**, zona America/Guayaquil. Las fechas UTC almacenadas pueden corresponder al 15 de noviembre.

## Integradas en esta versión

| Fuente | Acceso comprobado | Información consumida | Límite |
|---|---|---|---|
| Google Sheets proporcionado | [CSV de la pestaña](https://docs.google.com/spreadsheets/d/1WoxZ11c5MAoZ6nhcRymTvVK6GkV6kBOG/export?format=csv&gid=1128467625) | 24 provincias, hogares, 5 modalidades y observaciones | Fecha de corte vacía y totales por conciliar |
| INAMHI CAP | [RSS público](https://cap-sources.s3.amazonaws.com/ec-inamhi-es/rss.xml), enlazado por el código del [sitio oficial](https://servicios.inamhi.gob.ec/) | Mensajes XML: severidad, área, emisión, inicio, expiración e instrucciones | Varios mensajes pueden corresponder al mismo fenómeno; se contabilizan como mensajes |
| INAMHI advertencias | [Endpoint público](https://servicios.inamhi.gob.ec/wp-json/inamhi/v1/advertencias) | Boletines estructurados y diagnóstico de lectura de PDF | En la prueba, el diagnóstico de un PDF no pudo extraer fenómeno/vigencia. La interfaz indica cobertura parcial |
| NOAA CPC | [sstoi.indices](https://www.cpc.ncep.noaa.gov/data/indices/sstoi.indices) | Anomalías mensuales Niño 1+2 y Niño 3.4 | Es OISST mensual, no ONI/RONI, ni clasificación automática de fase ENOS |
| INAMHI / ERFEN / INOCAR | [Índice El Niño](https://servicios.inamhi.gob.ec/fenomeno-el-nino/) | Enlace más reciente localizado a un informe de INOCAR | Se identifica fecha del nombre del archivo. No se interpreta automáticamente el PDF |
| SNGR / Alertas Ecuador | [Zonas expuestas](https://alertasecuador.gob.ec/el_nino/zonas-expuestas/) y [servicio de población](https://sgrportal.gestionderiesgos.gob.ec/server/rest/services/Hosted/POB_VIV_MM_INU_PARR_STATIS_C1500/FeatureServer/0?f=pjson) | Población potencialmente expuesta por parroquia, agregada por provincia | 483 parroquias de 16 provincias, análisis hasta 1.500 m. No representa incidentes en tiempo real |

La [discusión de diagnóstico ENSO de NOAA](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml) permite complementar la interpretación técnica. El dashboard no deriva una declaratoria nacional a partir de los índices oceánicos.

## Investigación del geovisor enlazado

El [portal El Niño](https://alertasecuador.gob.ec/el_nino/) incrusta [Alístate Ecuador](https://script.google.com/macros/s/AKfycbz6HA9kKLeksqm49YYPD7i3A40mMK6JwmoDc50vaiv4myVTk0lFYswqnE4IbJXmr9Lm/exec). Su HTML utiliza Google Apps Script, con funciones como `obtenerDatosMapa`, `obtenerEventosElNino`, `obtenerAlojamientosTemporales`, `obtenerBodegasSNGR`, `obtenerCOEActivados`, `obtenerMonitoreoLluviasFuertes` y `obtenerContextoTerritorialGad`.

Estas llamadas usan `google.script.run`, ligado al contexto de su aplicación. No se verificó una API REST/JSON independiente para dichas funciones. No se emula su protocolo interno ni se copian tokens de sesión. La integración sostenible de esas funciones requiere una exportación pública documentada por la entidad, o un endpoint JSON/CSV publicado por quien administra el visor. Se deja el enlace al visor en la interfaz.

La sección Zonas Expuestas sí ofrece dos dashboards ArcGIS públicos:

- [Inundaciones](https://sgrportal.gestionderiesgos.gob.ec/portal/apps/dashboards/1ec9311119484344b58ecc53d6f3a41f), WebMap `5bc948fe800a463e94126893ef60f865`.
- [Movimientos en masa](https://sgrportal.gestionderiesgos.gob.ec/portal/apps/dashboards/74b925b1cfe049eea959943adf224744), WebMap `90f34e30966c4e1a8cacdaba774235de`.

Se leyeron sus configuraciones públicas mediante `portal/sharing/rest/content/items/{id}/data?f=json`, y las referencias de los WebMaps permitieron localizar las capas.

Ambos dashboards consultan la misma capa parroquial de población/vivienda:

```text
https://sgrportal.gestionderiesgos.gob.ec/server/rest/services/Hosted/POB_VIV_MM_INU_PARR_STATIS_C1500/FeatureServer/0
```

La aplicación consulta `/query` con `where=1=1`, `returnGeometry=false`, `outFields` explícitos, orden por `objectid` y hasta 2.000 registros. Una consulta independiente `returnCountOnly=true` confirma que no faltan filas. Si hay truncamiento o cambian los campos, no se reemplaza el respaldo.

Los widgets originales usan estos campos, que se preservan:

| Significado en el visor | Campo |
|---|---|
| Población inundación alta + media | `pob_inu_alt_med` |
| Población inundación alta | `pob_inu_alta` |
| Población inundación media | `pob_inu_media` |
| Población movimientos en masa muy alta + alta | `pob_mm_ma_alt` |
| Población movimientos en masa muy alta | `pob_mm_muy_alta` |
| Población movimientos en masa alta | `pob_mm_alta` |
| Nombre de provincia | `dpa_despro` |

La consulta de estadísticas agrupadas de ArcGIS respondió con error de conexión. La lectura directa de las 483 filas sí funcionó; los agregados se calculan localmente. Los campos combinados publicados se mantienen tal cual y no se sustituyen por la suma de componentes.

La capa también publica campos de vivienda expuesta (`viv_inu_alt_med`, `viv_mm_ma_alt_med`, `tot_viv_ma_alt`, entre otros). Están identificados, pero esta versión consume población para evitar confundir vivienda expuesta con los hogares afectados de la base principal.

También se localizaron los servicios de polígonos:

- [Zonas susceptibles a inundaciones](https://sgrportal.gestionderiesgos.gob.ec/server/rest/services/Hosted/ZONAS_SUSCEPTIBLES_INUNDACIONES_CT1500_t/MapServer?f=pjson).
- [Susceptibilidad a movimientos en masa](https://sgrportal.gestionderiesgos.gob.ec/server/rest/services/Hosted/SUSCEPTIBILIDAD_MOV_MASAS_CT1500/FeatureServer/0?f=pjson).

No se descargaron todos los polígonos ni se muestran como si fueran eventos observados. El mapa local usa los agregados provinciales del servicio de población, sobre la cartografía incluida.

## Otras integraciones posibles

- [Visor hidrometeorológico INAMHI](https://inamhi.gob.ec/info/): observaciones de estaciones meteorológicas e hidrológicas. Falta verificar un contrato público estable, unidades, códigos de estación y condiciones de uso para automatizar la lectura.
- [GeoGlows INAMHI](https://inamhi.geoglows.org/apps): pronósticos de caudal. La [documentación de GEOGLOWS](https://geoglows.readthedocs.io/en/v1.7.1/api-documentation/data.html) ofrece estadísticas de ensambles por identificador de tramo. Antes de integrarlas hay que seleccionar y validar los tramos ecuatorianos; no se insertaron pronósticos de ríos inventados.
- [Predicciones climáticas INAMHI](https://servicios.inamhi.gob.ec/clima/): boletines y archivos TIF. Son productos periódicos que requieren procesar ráster y conservar fecha, período y unidades.
- [Boletines CIIFEN](https://ciifen.org/el-nino-la-nina-ciifen/): síntesis regional mensual, útil como contexto; no sustituye alertas locales.

## Continuidad

El dashboard incluye sus propios JSON, cartografía local y soporte de CSV. Los cinco conectores se ejecutan de forma independiente; no hay condición que exija una respuesta de terceros para mostrar la base. El acceso externo ocurre en el servidor local o en GitHub Actions para no depender de CORS. El workflow consulta vivienda y alertas cada cinco minutos y las cinco fuentes a diario; guarda y publica los cambios. La vista estática revisa las copias publicadas cada cinco minutos. La programación de GitHub puede retrasarse; una consulta fallida conserva su respaldo.

La preparación de GitHub Pages sigue el [flujo oficial de GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). No se publicó nada durante la creación local.
