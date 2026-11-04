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
- `SUPABASE_URL`: URL base del proyecto, por ejemplo `https://tu-proyecto.supabase.co` (sin `/rest/v1`).
- `SUPABASE_SECRET_KEY`: clave secreta de Supabase para el servidor. Si ya la guardaste como `SUPABASE_SERVICE_ROLE_KEY`, también es compatible. No uses la clave pública ni la compartas.

La tabla `public.products` debe tener RLS activado y permisos para el rol `service_role`. Si al crear el proyecto desactivaste la exposición automática de tablas, ejecutá este SQL en Supabase para permitir el acceso desde la función del servidor:

```sql
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.products to service_role;
```

Los productos y sus URL de imágenes se guardan en Supabase; las fotos se cargan en Cloudinary. Las funciones de Netlify permiten leer el catálogo y protegen las operaciones de escritura con la sesión de administrador. El WhatsApp y las secciones vacías todavía se guardan en el navegador.

La vista previa servida con `python -m http.server` no ejecuta Netlify Functions. Para probar login y cargas localmente, usá Netlify CLI con `netlify dev`.