# SVG-HPGL

A node package for converting SVG to HP-GL. Splits curves into small segments.

## Versions

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
-   TODO: Support for SVG path features: Q, T, A
-   TODO: Scale, offset
