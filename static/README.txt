# Estáticos locales (origen para S3 + CloudFront)
#
# Estructura:
#   static/icons/favicon.png
#   static/images/spa-kira-logo.png   ← PONÉ EL LOGO AQUÍ
#   static/robots.txt
#
# Vite sirve esta carpeta en local (publicDir = "static").
# En prod: sync `static/` → S3 y CloudFront; las URLs siguen siendo /images/... /icons/...
#
# Logo: copiá tu PNG como:
#   static/images/spa-kira-logo.png
