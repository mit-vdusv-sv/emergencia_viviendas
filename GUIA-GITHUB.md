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

**Vivienda ya no espera una publicación de GitHub.** El dashboard consulta la hoja directamente al abrir, al volver a la pestaña y cada tres segundos mientras está visible. El indicador **Sheets · directo** confirma la conexión. Los cambios suelen reflejarse en segundos, según la respuesta de Google. No es un canal push ni una garantía de demora cero.

La hoja debe mantener acceso público de lectura; el navegador no modifica la hoja ni necesita claves. Si Google falla, conserva la copia válida del navegador o la incluida. Si se importó un CSV, usa **Datos y fuentes → Usar Google Sheets** para volver a la conexión directa.

La tarea de GitHub queda para INAMHI cada cinco minutos y las demás fuentes institucionales a diario. También conserva un respaldo diario de vivienda para continuidad. El navegador revisa esas copias institucionales cada cinco minutos. Las consultas institucionales no bloquean las lecturas directas de vivienda.

Los cron se ejecutan solo en la rama predeterminada. En forks hay que habilitar los workflows. Las reglas del repositorio deben permitir guardar los respaldos con el token de Actions. GitHub puede retrasar tareas o desactivarlas tras inactividad; consulta Actions. [Documentación de programación](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Para renovar y publicar los respaldos manualmente, ejecuta **Publicar y actualizar dashboard → Run workflow**. Los cambios de vivienda se muestran directamente aunque no se ejecute esa tarea.

Para abrirlo en la computadora, ejecuta `node scripts/server.mjs` o `iniciar.cmd` y abre http://127.0.0.1:4173.
