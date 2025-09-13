import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Paper, Stack, Typography, Button, Select, MenuItem, FormControl, InputLabel, FormControlLabel, Switch, Slider } from '@mui/material'
import { artifactDownloadUrl } from '../api/client'

declare global { interface Window { vtk?: any } }

async function ensureVtkLoaded(): Promise<any> {
  if (window.vtk) return window.vtk
  const inject = (src: string) => new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
  // Try local copy first; if it loads but window.vtk is missing (SPA fallback), fallback to CDN
  try {
    await inject('/vtkjs/vtk.js')
    if (!window.vtk) throw new Error('Local vtk.js did not initialize (likely SPA fallback)')
  } catch (_localErr) {
    await inject('https://unpkg.com/@kitware/vtk.js@29.7.1/dist/vtk.js')
  }
  if (!window.vtk) throw new Error('vtk.js did not initialize')
  return window.vtk
}

export default function VtkViewer() {
  const [params] = useSearchParams()
  const job = params.get('job') || params.get('jobId')
  const name = params.get('name')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const grwRef = useRef<any>(null)
  const actorRef = useRef<any>(null)
  const mapperRef = useRef<any>(null)
  const [arrays, setArrays] = useState<string[]>([])
  const [colorBy, setColorBy] = useState<string>('p')
  const [showArrows, setShowArrows] = useState<boolean>(false)
  const [glyphScale, setGlyphScale] = useState<number>(0.1)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  useEffect(() => {
    (async () => {
      try {
        if (!job || !name) return
        const url = artifactDownloadUrl(job, name)
        const container = containerRef.current
        if (!container) return
        const vtk = await ensureVtkLoaded()
        const grw = vtk.Rendering.Misc.GenericRenderWindow.newInstance({ background: [0.97, 0.98, 0.99] })
        grw.setContainer(container)
        const renderer = grw.getRenderer()
        const renderWindow = grw.getRenderWindow()
        const mapper = vtk.Rendering.Core.Mapper.newInstance()
        const actor = vtk.Rendering.Core.Actor.newInstance()
        actor.setMapper(mapper)
        renderer.addActor(actor)
        grwRef.current = grw
        actorRef.current = actor
        mapperRef.current = mapper

        const reader = vtk.IO.XML.XMLUnstructuredGridReader.newInstance()
        const ab = await fetch(url).then((r) => r.arrayBuffer())
        reader.parseAsArrayBuffer(ab)
        const ds = reader.getOutputData(0)
        mapper.setInputData(ds)
        const pd = ds.getPointData()
        const arrs: string[] = []
        const all = pd.getArrays() || []
        all.forEach((a: any) => { if (a?.getName) arrs.push(a.getName()) })
        if (pd.hasArray('u')) {
          const u = pd.getArrayByName('u')
          const data = u.getData() as Float32Array | number[]
          const ncomp = u.getNumberOfComponents ? u.getNumberOfComponents() : 3
          const npts = (data.length / ncomp) | 0
          const mag = new Float32Array(npts)
          const vec3 = new Float32Array(npts * 3)
          for (let i = 0; i < npts; i++) {
            const x = (data as any)[i * ncomp + 0] || 0
            const y = (data as any)[i * ncomp + 1] || 0
            const z = (data as any)[i * ncomp + 2] || 0
            mag[i] = Math.sqrt(x * x + y * y + z * z)
            vec3[i * 3 + 0] = x
            vec3[i * 3 + 1] = y
            vec3[i * 3 + 2] = 0
          }
          const uMag = vtk.Common.Core.DataArray.newInstance({ name: 'u_mag', numberOfComponents: 1, values: mag })
          pd.addArray(uMag)
          if (!pd.hasArray('u3')) {
            const u3 = vtk.Common.Core.DataArray.newInstance({ name: 'u3', numberOfComponents: 3, values: vec3 })
            pd.addArray(u3)
          }
          arrs.push('u_mag')
        }
        setArrays(arrs)
        if (arrs.includes('p')) {
          mapper.setScalarModeToUsePointFieldData()
          mapper.setColorByArrayName('p')
          mapper.setScalarVisibility(true)
          setColorBy('p')
        } else if (arrs.includes('u_mag')) {
          mapper.setScalarModeToUsePointFieldData()
          mapper.setColorByArrayName('u_mag')
          mapper.setScalarVisibility(true)
          setColorBy('u_mag')
        } else {
          mapper.setScalarVisibility(false)
        }
        const b = ds.getBounds()
        if (b) {
          const dx = Math.abs(b[1] - b[0]) || 1
          const dy = Math.abs(b[3] - b[2]) || 1
          const dim = Math.max(dx, dy)
          setGlyphScale(dim * 0.02)
        }
        renderer.resetCamera()
        renderWindow.render()
      } catch (e: any) {
        setError(e?.message || 'Failed to render VTU')
        console.error(e)
      }
    })()
    return () => {
      try { grwRef.current?.delete?.() } catch {}
      grwRef.current = null
      actorRef.current = null
      mapperRef.current = null
    }
  }, [job, name])

  function onChangeColorBy(val: string) {
    const mapper: any = mapperRef.current
    if (!mapper) return
    if (val) {
      mapper.setScalarModeToUsePointFieldData()
      mapper.setColorByArrayName(val)
      mapper.setScalarVisibility(true)
    } else {
      mapper.setScalarVisibility(false)
    }
    grwRef.current?.getRenderWindow().render()
    setColorBy(val)
  }

  useEffect(() => {
    const grw = grwRef.current
    const mapper = mapperRef.current
    if (!grw || !mapper || !(window as any).vtk) return
    const vtk = (window as any).vtk
    const ren = grw.getRenderer()
    const rw = grw.getRenderWindow()
    let glyphActor: any | null = null
    let glyphMapper: any | null = null
    let arrowSrc: any | null = null

    if (showArrows) {
      try {
        glyphMapper = vtk.Rendering.Core.Glyph3DMapper.newInstance()
        glyphMapper.setInputData((mapper as any).getInputData())
        glyphMapper.setOrientationArray('u3')
        glyphMapper.setOrientationModeToDirection()
        glyphMapper.setScaleArray('u_mag')
        glyphMapper.setScaleFactor(glyphScale || 1.0)
        glyphMapper.setScalarVisibility(false)

        arrowSrc = vtk.Filters.Sources.ArrowSource.newInstance({
          tipResolution: 12,
          shaftResolution: 8,
          tipLength: 0.35,
          tipRadius: 0.1,
          shaftRadius: 0.03,
        })
        ;(glyphMapper as any).setInputConnection(arrowSrc.getOutputPort(), 1)

        glyphActor = vtk.Rendering.Core.Actor.newInstance()
        glyphActor.setMapper(glyphMapper)
        glyphActor.getProperty().setColor(0.15, 0.15, 0.15)
        ren.addActor(glyphActor)
        rw.render()
      } catch (e) {
        console.error('Glyph setup failed', e)
      }
    }
    return () => {
      if (glyphActor) {
        try { ren.removeActor(glyphActor) } catch {}
      }
      try { glyphMapper?.delete?.() } catch {}
      try { arrowSrc?.delete?.() } catch {}
      rw.render()
    }
  }, [showArrows, glyphScale])

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6">VTU Preview</Typography>
          <Typography color="text.secondary">{job} / {name}</Typography>
          <Button variant="outlined" onClick={() => { grwRef.current?.getRenderer().resetCamera(); grwRef.current?.getRenderWindow().render() }}>Reset Camera</Button>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="colorby-label">Color by</InputLabel>
            <Select labelId="colorby-label" value={colorBy} label="Color by" onChange={(e) => onChangeColorBy(String(e.target.value))}>
              {arrays.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel control={<Switch checked={showArrows} onChange={(e) => setShowArrows(e.target.checked)} />} label="Show arrows" />
          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 200 }}>
            <Typography variant="body2">Scale</Typography>
            <Slider size="small" value={glyphScale} min={0} max={1} step={0.01} onChange={(_, v) => setGlyphScale(Number(v))} />
          </Stack>
          <Button onClick={() => nav(-1)}>Back</Button>
        </Stack>
        {error && <Typography color="error">{error}</Typography>}
        <div ref={containerRef} style={{ width: '100%', height: 600, background: '#eef2f7', borderRadius: 4 }} />
      </Stack>
    </Paper>
  )
}
