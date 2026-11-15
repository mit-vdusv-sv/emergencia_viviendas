# Subir Atención Fenomeno del Niño a GitHub

## 1. Subir los archivos

1. Descomprime el archivo ZIP.
2. Crea un repositorio en GitHub o abre el repositorio donde guardarás el dashboard.
3. Sube **el contenido descomprimido**, no el ZIP, a la raíz de la rama principal.
4. Incluye la carpeta `.github` y confirma los cambios.

La raíz del repositorio debe contener esta estructura:

```text
.github/workflows/pages.yml
.gitignore
assets/
data/
scripts/
src/
tests/
app.mjs
index.html
styles.css
package.json
README.md
FUENTES.md
GUIA-GITHUB.md
iniciar.cmd
```

No es necesario subir una carpeta `dist`: GitHub Actions la genera.

## 2. Publicar con GitHub Pages

1. En el repositorio, abre **Settings → Pages**.
2. En **Build and deployment → Source**, selecciona **GitHub Actions**.
3. Comprueba que **Settings → Actions → General** permite ejecutar workflows y que las reglas del repositorio permiten al workflow escribir en la rama principal. El archivo solicita `contents: write` para guardar las copias.
4. Abre **Actions → Publicar y actualizar dashboard → Run workflow**.
5. Selecciona la rama predeterminada y ejecuta el flujo.
6. El enlace publicado aparecerá al terminar la tarea `deploy` y en **Settings → Pages**.

El flujo consulta las fuentes antes de publicar. Cada fuente fallida conserva su respaldo; si ninguna fuente solicitada responde, la ejecución falla y la publicación anterior continúa disponible. Revisa el registro de **Consultar fuentes y conservar respaldos** en Actions.

El workflow valida los cálculos, construye los archivos estáticos y los publica. No necesita claves externas de API. Su permiso de publicación usa el token que proporciona GitHub Actions.

Configuración basada en la [documentación oficial de workflows para GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## 3. Actualización de datos

**Sí hay actualización automática sin dejar encendida tu computadora.** El archivo `.github/workflows/pages.yml` incluye:

- Cada cinco minutos: consulta la hoja de vivienda y las alertas INAMHI.
- Cada día a las 00:19 de Ecuador continental: consulta también NOAA, ERFEN y exposición SNGR.
- Cuando cambia el contenido: guarda los JSON y vuelve a publicar GitHub Pages. Si solo cambia la hora de consulta, evita otra publicación.
- Con la pestaña abierta: el navegador revisa los archivos publicados cada cinco minutos y muestra los nuevos datos automáticamente. Un CSV propio importado se conserva en ese navegador.

La programación se ejecuta solo en la rama predeterminada. En un repositorio creado como fork, habilita también los workflows programados en **Actions**. Si el workflow no puede guardar los JSON por reglas de protección de rama o políticas de la organización, la ejecución mostrará el error; hay que permitir esa escritura para completar el circuito automático.

**Cinco minutos es la frecuencia programada, no una garantía de tiempo real.** GitHub puede retrasar u omitir tareas durante alta carga. Después de consultar, hay que publicar y esperar la siguiente revisión del navegador. Las fuentes también tienen sus propias frecuencias de publicación. La fecha de la copia se conserva si no cambió su contenido; cada intento de consulta queda en Actions. [Documentación de programación y límites](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

En repositorios públicos, GitHub puede deshabilitar la programación tras 60 días sin actividad. Revisa Actions y vuelve a habilitar el workflow si ocurre. La frecuencia de cinco minutos implica hasta 288 ejecuciones diarias más la consulta diaria: revisa los minutos disponibles de tu plan si el repositorio es privado. Puedes cambiar el cron en el workflow.

Para forzar una consulta y publicación, ejecuta **Publicar y actualizar dashboard → Run workflow**. No se requieren claves de las fuentes externas; se usa el token que proporciona GitHub para guardar y publicar.

Para usar todas las consultas automáticas en la computadora:

```sh
node scripts/server.mjs
```

Después abre http://127.0.0.1:4173 y mantén el servidor activo. En Windows también puedes ejecutar `iniciar.cmd`.
