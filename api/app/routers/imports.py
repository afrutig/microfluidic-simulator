from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter()


class DXFImportResponse(BaseModel):
    shapes: list[dict[str, Any]]
    warnings: list[str] = []
    layers: list[str] = []


@router.post("/import/dxf", response_model=DXFImportResponse)
async def import_dxf(
    file: UploadFile = File(...),
    default_width: float = Form(10.0),
    scale: float = Form(1.0),
    layer_widths: str | None = Form(None),  # JSON mapping: {"LAYER_NAME": width}
    layer_types: str | None = Form(None),  # JSON mapping: {"LAYER_NAME": "inlet"|"outlet"|"rect"}
):
    try:
        import ezdxf  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DXF support unavailable: {e}")

    if not file.filename or not file.filename.lower().endswith(".dxf"):
        raise HTTPException(status_code=400, detail="Please upload a .dxf file")

    data = await file.read()
    try:
        import os as _os
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        doc = ezdxf.readfile(tmp_path)
        try:
            _os.unlink(tmp_path)
        except Exception:
            pass
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read DXF: {e}")

    msp = doc.modelspace()
    shapes: list[dict[str, Any]] = []
    warnings: list[str] = []
    layers_set: set[str] = set()
    lw_map: dict[str, float] = {}
    lt_map: dict[str, str] = {}
    import json as _json

    try:
        if layer_widths:
            lw_map = {str(k): float(v) for k, v in _json.loads(layer_widths).items()}
    except Exception as ex:
        warnings.append(f"Invalid layer_widths: {ex}")
    try:
        if layer_types:
            lt_map = {str(k): str(v) for k, v in _json.loads(layer_types).items()}
    except Exception as ex:
        warnings.append(f"Invalid layer_types: {ex}")

    # Lines → channels with default width
    for ent in msp.query("LINE"):
        try:
            layer = str(ent.dxf.layer)
            layers_set.add(layer)
            x1, y1, x2, y2 = (
                float(ent.dxf.start.x),
                float(ent.dxf.start.y),
                float(ent.dxf.end.x),
                float(ent.dxf.end.y),
            )
            w = float(lw_map.get(layer, default_width))
            x = min(x1, x2) * scale
            y = min(y1, y2) * scale
            length = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5 * scale
            stype = lt_map.get(layer, "rect")
            shapes.append(
                {
                    "id": None,
                    "type": stype,
                    "x": x,
                    "y": y,
                    "width": max(length, w),
                    "height": w,
                    "layer": layer,
                }
            )
        except Exception as ex:
            warnings.append(f"Skipping LINE: {ex}")

    # LWPOLYLINE as bounding boxes
    for ent in msp.query("LWPOLYLINE"):
        try:
            layer = str(ent.dxf.layer)
            layers_set.add(layer)
            points = [(float(p[0]) * scale, float(p[1]) * scale) for p in ent.get_points()]
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            if xs and ys:
                x, y, w, h = min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys)
                stype = lt_map.get(layer, "rect")
                shapes.append(
                    {
                        "id": None,
                        "type": stype,
                        "x": x,
                        "y": y,
                        "width": w or default_width,
                        "height": h or default_width,
                        "layer": layer,
                    }
                )
        except Exception as ex:
            warnings.append(f"Skipping LWPOLYLINE: {ex}")

    # TODO: Handle CIRCLE/ARC if needed

    return DXFImportResponse(shapes=shapes, warnings=warnings, layers=sorted(layers_set))
