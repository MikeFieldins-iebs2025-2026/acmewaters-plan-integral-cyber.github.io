# ACME Waters · Cyberphysical Shield

Portal web estático para el **Plan Integral de Ciberseguridad de ACME Waters**. Está diseñado para comité de dirección y socios, con estética **Frutiger Aero / Y2K** actualizada: superficies vítreas, brillos líquidos, color saturado y una escena WebGL no intrusiva.

## Funcionalidad

- Visor único basado en **PDF.js**.
- Documento principal cargado por defecto: `assets/ACME_Waters_Resumen_Ejecutivo.pdf`.
- Alternancia sin recarga entre:
  - `ACME_Waters_Resumen_Ejecutivo.pdf`
  - `ACME_Waters_Anexos_Técnicos.pdf`
- Botón de descarga dedicado para el PDF activo y enlaces de descarga en el footer.
- Vídeo embebido desde Google Drive en modo `preview`, con carga diferida y `sandbox` sin `allow-downloads`.
- Resumen ejecutivo de 102 palabras, extraído exclusivamente del PDF principal.
- Diagrama SVG de prioridades y roadmap textual trienal.
- Escena WebGL con burbujas translúcidas y elementos retro-futuristas.
- Soporte responsive desde 320 px.
- Controles con foco visible, textos ARIA, `skip-link`, contraste alto y texto extraíble del PDF para lectura accesible.

## Wireframe implementado

```text
[Hero WebGL]
  ├─ Navegación superior: marca + anclas
  ├─ Titular ejecutivo
  └─ CTA: abrir visor / descargar resumen

[Área principal]
  ├─ Visor PDF.js
  │   ├─ Tabs: Resumen / Anexos
  │   ├─ Controles: página, zoom, descarga
  │   └─ Canvas + texto accesible por página
  └─ Panel lateral
      ├─ Resumen ejecutivo ≤ 150 palabras
      ├─ Diagrama SVG de prioridades
      └─ Roadmap Año 1 / Año 2 / Año 3

[Multimedia]
  └─ Iframe Google Drive lazy-loaded y sandboxed

[Footer]
  ├─ Resumen licencia MIT
  ├─ Crédito Mike Fieldins + LinkedIn
  └─ Coedición Lexor + descargas
```

## Arquitectura de carpetas

```text
acme-waters-cyber-portal/
├── index.html
├── style.css
├── main.js
├── README.md
├── LICENSE
├── assets/
│   ├── ACME_Waters_Resumen_Ejecutivo.pdf
│   ├── ACME_Waters_Anexos_Técnicos.pdf
│   ├── icons/
│   │   ├── acme-shield.svg
│   │   └── favicon.svg
│   └── textures/
│       └── aero-grid.svg
└── gl/
    ├── aero-scene.js
    └── shaders/
        ├── bubble.frag
        └── bubble.vert
```

## Librerías externas y licencias de terceros

La web no requiere backend ni base de datos. Las únicas dependencias externas son:

1. **PDF.js 3.11.174**  
   CDN: cdnjs  
   Licencia: Apache License 2.0  
   Uso: renderizado del visor PDF y extracción de texto de la página actual.

2. **Three.js 0.160.0**  
   CDN: unpkg  
   Licencia: MIT  
   Uso: escena WebGL del hero.

No se han usado imágenes generativas ni librerías adicionales.

## Ejecución local

Por restricciones habituales de navegador con `file://`, se recomienda servir la carpeta con un servidor estático:

```bash
cd acme-waters-cyber-portal
python -m http.server 8080
```

Después abre:

```text
http://localhost:8080
```

## Nota sobre descarga del vídeo

En una web 100 % estática no es posible garantizar bloqueo absoluto de descarga si el proveedor remoto permite obtener el recurso. Esta implementación aplica las medidas disponibles en cliente: `sandbox` sin `allow-downloads`, sin `allow-popups`, carga en modo preview y bloqueo de menú contextual local.

## Revisión de calidad realizada

- PDF principal configurado como documento por defecto.
- Alternancia Resumen/Anexos en el mismo visor, sin recarga de página.
- Descarga del PDF activo y descargas del footer verificadas por ruta.
- Vídeo en iframe Google Drive con carga diferida y sandbox restrictivo.
- Animación WebGL desacoplada de la interacción, con `prefers-reduced-motion` y pixel ratio limitado.
- Diseño responsive con breakpoint para panel lateral y controles móviles.
- No hay `console.log()` en producción.
- Resumen ejecutivo: 102 palabras.
