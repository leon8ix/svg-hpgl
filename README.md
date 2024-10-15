# SVG-HPGL

A node package for converting SVG to HP-GL. Splits curves into small segments.

## ToDo

-   Support for SVG path features: Q, T, A

## Versions

### 0.4.2

-   Fixed too thin lines in canvas output on big dimensions
-   Changed canvas background to white
-   Fixed missing type export

### 0.4.1

-   Compiled to dist

### 0.4.0

-   Added rotation
-   Improved test html page with inputs

### 0.3.0

-   Added scale and offset

### 0.2.0

-   Restructured conversion function to
    -   support different pens using querySelector
    -   respect original element order
-   Added utility function to retrieve all stroke colors in SVG for use with different pens
-   Removed JSDOM, instead consumer should supply SVGSVGElement directly

### 0.1.1

-   Removed dist from gitignore, so repo can be used as package directly

### 0.1.0

-   First commit, basic functionality working
-   Outputs HP-GL commands:
    -   PU
    -   PD
    -   PA
-   Supported SVG features:
    -   Line
    -   Polyline
    -   Circle
    -   Ellipse
    -   Rect
    -   Path (M, L, H, V, C, S, Z)
