-- O bucket `avatars` é público e não tinha limites: o máximo de 5 MB e o "só imagens" existiam só
-- no frontend (profileDb.js), por isso qualquer conta autenticada podia, pela API, carregar
-- ficheiros de qualquer tamanho ou tipo (incluindo SVG com script) para um URL público.
-- O recorte do avatar gera sempre JPEG; aceitam-se ainda PNG/WebP/GIF por compatibilidade.

update storage.buckets
   set file_size_limit = 5242880, -- 5 MB, o mesmo limite do frontend
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'avatars';
