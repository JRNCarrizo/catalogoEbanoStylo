insert into public.products (
  id,
  name,
  section,
  description,
  details,
  price,
  previous_price,
  show_price,
  image,
  images,
  image_public_ids,
  tag,
  image_layout
)
values
  (
    'sillon-nube',
    'Sillón Nube',
    'Sillones',
    'Bouclé suave · tono marfil · producto de demostración',
    '',
    485000,
    560000,
    true,
    'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=82',
    array['https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=82'],
    array[''],
    'DEMO',
    'standard'
  ),
  (
    'silla-nordica',
    'Silla Nórdica',
    'Sillas',
    'Roble claro · asiento tapizado · producto de demostración',
    '',
    128000,
    null,
    true,
    'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=82',
    array['https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=82'],
    array[''],
    'DEMO',
    'standard'
  )
on conflict (id) do nothing;
