# Simon Game

Juego vibecodeado para probar [preview environments](https://github.com/gbassa8/preview-environments)
## Docker

Build + run:

```bash
docker build -t simon-game .
docker run --rm -p 8080:8080 --env-file .env simon-game
```

## CI

El CI del repo:

- construye y publica la imagen en `GHCR`
- crea el schema del preview al abrir o actualizar un PR
- elimina el schema preview al cerrar el PR
- en `main`, publica la imagen de producción, crea `public` si no existe y actualiza el tag en el repo de infra
