# Catalogo Ebano Stylo

Sitio estatico para Netlify. La carga de fotos usa Cloudinary con firmas generadas por Netlify Functions; las credenciales privadas no deben agregarse al repositorio.

## Configuracion de Netlify

En el panel de Netlify, agregá estas variables privadas en **Site configuration → Environment variables** y volvé a desplegar:

- `ADMIN_USERNAME`: usuario del administrador, por ejemplo `admin`.
- `ADMIN_PASSWORD`: contraseña nueva y segura. No reutilices `admin123`.
- `SESSION_SECRET`: secreto aleatorio largo para firmar las sesiones.
- `CLOUDINARY_CLOUD_NAME`: nombre de nube de Cloudinary.
- `CLOUDINARY_API_KEY`: API key de Cloudinary.
- `CLOUDINARY_API_SECRET`: API secret de Cloudinary. No lo compartas por chat ni lo guardes en GitHub.
- `CLOUDINARY_FOLDER`: opcional; carpeta de destino de las imágenes.

Las fotos se cargan en Cloudinary y los productos guardan sus URL en el navegador. La información de productos todavía no está sincronizada entre dispositivos; para eso hace falta conectar una base de datos.

La vista previa servida con `python -m http.server` no ejecuta Netlify Functions. Para probar login y cargas localmente, usá Netlify CLI con `netlify dev`.