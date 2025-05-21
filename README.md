# SVG-HPGL

A node package for converting SVG to HP-GL. Splits curves into small segments.

## ToDo

-   Add preview HPGL as SVG path function (need not be rastered canvas)

## Versions

### 0.13.0 (250521)

-   Added support for SVG path command: A

### 0.12.0 (250521)

-   Added support for SVG path commands: Q and T

### 0.11.0-1 (250520)

-   Added support for CSS styles for strokes in SVG
    -   Presentation attribute syntax is no longer required
-   BREAKING CHANGES
    -   Replaced PenSelectors with PenSelector[]
    -   Removed PenSelector['selector']
    -   PenSelector['stroke'] is now required
    -   Selecting all stroked elements is now done by passing `true` for PenSelector['stroke'] instead of omitting it
    -   Colors are now in the unified syntax of: `rgb(0, 0, 0)`
        -   Any other syntax will not select anything
        -   getSVGStrokeColors() will return only this syntax

### 0.10.0 (250520)

-   Added support for SVG polygon element

### 0.9.0 (250520)

-   Added support for implicit L after M position in SVG path
-   Switched from NPM to Bun
-   Updated dependencies

### 0.8.0 (250313)

-   Added mirror feature (x and y)
-   Updated dependencies

### 0.7.0 (250305)

-   Added GitHub Action for deploying to GitHub Packages, so it can be consumed properly

### 0.6.0 (241115)

-   Stroke for pen selector now accepts array of stroke colors
-   Allowed for custom commands that run after tool selection
-   Removed output of tool selector when tool is not used

### 0.5.0 (241108)

-   Added support for nested SVGs

### 0.4.2 (241015)

-   Fixed too thin lines in canvas output on big dimensions
-   Changed canvas background to white
-   Fixed missing type export

### 0.4.1 (241015)

-   Compiled to dist

### 0.4.0 (241015)

-   Added rotation
-   Improved test html page with inputs

### 0.3.0 (241011)

-   Added scale and offset

### 0.2.0 (241010)

-   Restructured conversion function to
    -   support different pens using querySelector
    -   respect original element order
-   Added utility function to retrieve all stroke colors in SVG for use with different pens
-   Removed JSDOM, instead consumer should supply SVGSVGElement directly

### 0.1.1 (241009)

-   Removed dist from gitignore, so repo can be used as package directly

### 0.1.0 (241009)

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
