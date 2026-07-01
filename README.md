# ACME Waters · Cyber Portal

Sitio web estático para consulta ejecutiva del **Plan Integral de Ciberseguridad de ACME Waters**.  
Versión revisada con rutas relativas, vídeo local y fondo WebGL dinámico.

## Funcionalidad

- Visor único de PDFs basado en **PDF.js** con:
  - carga por defecto de `ACME_Waters_Resumen_Ejecutivo.pdf`;
  - alternancia sin recarga hacia `ACME_Waters_Anexos_Tecnicos.pdf`;
  - botones de navegación, zoom y descarga;
  - fallback automático a visor nativo del navegador cuando PDF.js no esté disponible.
- Reproductor local de vídeo desde `./assets/video/el-escudo-ciberfisico.mp4`.
- Interfaz responsive inspirada en Frutiger Aero/Y2K modernizado:
  - paneles glassmorphism;
  - brillos líquidos;
  - diagramas SVG translúcidos;
  - fondo 3D dinámico con WebGL nativo.
- Accesibilidad:
  - skip link;
  - foco visible;
  - etiquetas ARIA;
  - contraste alto;
  - compatibilidad con `prefers-reduced-motion`.
- Footer con licencia, créditos y enlaces de descarga.

## Estructura

```text
acme-waters-cyber-portal-v2/
├── index.html
├── style.css
├── main.js
├── README.md
├── LICENSE
├── assets/
│   ├── docs/
│   │   ├── ACME_Waters_Resumen_Ejecutivo.pdf
│   │   └── ACME_Waters_Anexos_Tecnicos.pdf
│   ├── icons/
│   │   ├── acme-drop-shield.svg
│   │   └── video-poster.svg
│   ├── textures/
│   │   └── noise.svg
│   └── video/
│       └── el-escudo-ciberfisico.mp4
└── gl/
    ├── ethereal-field.js
    ├── field.vert
    └── field.frag
```

## Ejecución recomendada

Las rutas de documentos y vídeo son relativas (`./assets/...`). Para máxima compatibilidad con PDF.js, sirve la carpeta con un servidor estático:

```bash
cd acme-waters-cyber-portal-v2
python3 -m http.server 8080
```

Después abre:

```text
http://localhost:8080/
```

También puede abrirse `index.html` directamente en navegador. En ese modo algunos navegadores bloquean la lectura de PDFs por PDF.js desde `file://`; la página activa entonces el fallback nativo automáticamente.

## Librerías y licencias de terceros

- **PDF.js 3.11.174** mediante CDN de cdnjs. Licencia: Apache-2.0.  
  Se usa para renderizar los documentos PDF en canvas.
- **WebGL nativo** del navegador. Sin librerías externas para la escena 3D.
- No se usa Three.js en esta versión porque la escena WebGL se resuelve con shaders propios y reduce dependencias.

## Notas sobre vídeo

El vídeo se carga desde la carpeta local `assets/video/`.  
Se han aplicado controles de mitigación de descarga (`controlsList="nodownload"`, bloqueo de menú contextual y sin descarga desde la interfaz). En un sitio 100 % estático no es técnicamente posible impedir de forma absoluta que un usuario avanzado descargue un recurso servido al navegador.

## Revisión interna

- PDF principal definido como documento por defecto.
- Ambos PDFs usan rutas relativas y tienen botón de descarga dedicado.
- Vídeo local servido desde `./assets/video/`.
- Shaders WebGL cargan desde `./gl/` y tienen fallback interno si el navegador bloquea `fetch()` local.
- Diseño probado para ancho mínimo de 320 px mediante CSS responsive.
- Animación WebGL reducida automáticamente con `prefers-reduced-motion`.
- Sin `console.log()` de producción.
