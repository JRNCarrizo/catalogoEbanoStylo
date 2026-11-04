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

La tabla `public.products` debe tener RLS activado, una columna para los identificadores de imágenes y permisos para el rol `service_role`. Ejecutá este SQL en Supabase para preparar la tabla y permitir el acceso desde las funciones del servidor:

```sql
alter table public.products
  add column if not exists image_public_ids text[] not null default '{}';

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.products to service_role;
```

Los productos, las URL y los identificadores de imágenes se guardan en Supabase. Las fotos se cargan en Cloudinary. Al reemplazar o borrar productos, Netlify elimina de Cloudinary las fotos que ya no se usan; las imágenes cargadas antes de guardar sus identificadores no pueden borrarse automáticamente. Las funciones de Netlify protegen las operaciones de escritura con la sesión de administrador. El WhatsApp y las secciones vacías todavía se guardan en el navegador.

Para cargar los dos productos de demostración (Sillón Nube y Silla Nórdica), ejecutá una vez el contenido de [`supabase/seed-demo.sql`](./supabase/seed-demo.sql) en **Supabase → SQL Editor**. Están marcados como `DEMO`, usan fotos de muestra y precios ilustrativos. La carga no duplica ni sobrescribe filas existentes con esos IDs.

La vista previa servida con `python -m http.server` no ejecuta Netlify Functions. Para probar login y cargas localmente, usá Netlify CLI con `netlify dev`.