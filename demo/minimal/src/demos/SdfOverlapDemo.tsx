import { useEffect, useRef, useState } from 'react'
import {
  Frame,
  Glass,
  GlassContainer,
  Html,
  LayoutCanvas,
  Transform,
  ZStack,
} from 'liquid-glass-dom/react'
import {
  deleteStoredBackgroundImage,
  loadStoredBackgroundImage,
  saveStoredBackgroundImage,
} from './backgroundImageStore'

const GLASS_WIDTH = 220
const GLASS_HEIGHT = 132
const INITIAL_DISTANCE = -44
const INITIAL_CONTAINER_SPACING = 34
const INITIAL_BLUR = 7
const INITIAL_BEZEL_WIDTH = 18
const INITIAL_DISPLACEMENT_BLUR = 8
const INITIAL_CORNER_RADIUS = 42
const INITIAL_TINT_HEX = '#cfcfcf'
const INITIAL_TINT_OPACITY = 62
const INITIAL_SHADOW_HEX = '#000000'
const INITIAL_SHADOW_OPACITY = 32
const INITIAL_SHADOW_OFFSET_X = 0
const INITIAL_SHADOW_OFFSET_Y = 22
const INITIAL_SHADOW_BLUR = 34
const INITIAL_SHADOW_SPREAD = 0

export default function SdfOverlapDemo() {
  const [distance, setDistance] = useState(INITIAL_DISTANCE)
  const [containerSpacing, setContainerSpacing] = useState(INITIAL_CONTAINER_SPACING)
  const [blur, setBlur] = useState(INITIAL_BLUR)
  const [bezelWidth, setBezelWidth] = useState(INITIAL_BEZEL_WIDTH)
  const [displacementBlur, setDisplacementBlur] = useState(INITIAL_DISPLACEMENT_BLUR)
  const [cornerRadius, setCornerRadius] = useState(INITIAL_CORNER_RADIUS)
  const [tintHex, setTintHex] = useState(INITIAL_TINT_HEX)
  const [tintOpacity, setTintOpacity] = useState(INITIAL_TINT_OPACITY)
  const [shadowHex, setShadowHex] = useState(INITIAL_SHADOW_HEX)
  const [shadowOpacity, setShadowOpacity] = useState(INITIAL_SHADOW_OPACITY)
  const [shadowOffsetX, setShadowOffsetX] = useState(INITIAL_SHADOW_OFFSET_X)
  const [shadowOffsetY, setShadowOffsetY] = useState(INITIAL_SHADOW_OFFSET_Y)
  const [shadowBlur, setShadowBlur] = useState(INITIAL_SHADOW_BLUR)
  const [shadowSpread, setShadowSpread] = useState(INITIAL_SHADOW_SPREAD)
  const [showCheckerboard, setShowCheckerboard] = useState(true)
  const [debugDisplacement, setDebugDisplacement] = useState(false)
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null)
  const [backgroundImageName, setBackgroundImageName] = useState('')
  const backgroundImageUrlRef = useRef<string | null>(null)
  const centerOffset = (GLASS_WIDTH + distance) / 2
  const tintColor = hexToRgb(tintHex)
  const shadowColor = hexToRgb(shadowHex)

  useEffect(() => {
    let isMounted = true

    loadStoredBackgroundImage()
      .then((storedImage) => {
        if (!isMounted || !storedImage) {
          return
        }

        setBackgroundImage(storedImage.blob, storedImage.name)
      })
      .catch((error: unknown) => {
        console.error(error)
      })

    return () => {
      isMounted = false
      clearBackgroundImageUrl()
    }
  }, [])

  const clearBackgroundImageUrl = () => {
    if (backgroundImageUrlRef.current) {
      URL.revokeObjectURL(backgroundImageUrlRef.current)
      backgroundImageUrlRef.current = null
    }
  }

  const setBackgroundImage = (blob: Blob, name: string) => {
    const nextUrl = URL.createObjectURL(blob)
    clearBackgroundImageUrl()
    backgroundImageUrlRef.current = nextUrl
    setBackgroundImageUrl(nextUrl)
    setBackgroundImageName(name)
  }

  const updateBackgroundImage = (file: File) => {
    setBackgroundImage(file, file.name)
    saveStoredBackgroundImage(file, file.name).catch((error: unknown) => {
      console.error(error)
    })
  }

  const clearBackgroundImage = () => {
    clearBackgroundImageUrl()
    setBackgroundImageUrl(null)
    setBackgroundImageName('')
    deleteStoredBackgroundImage().catch((error: unknown) => {
      console.error(error)
    })
  }

  return (
    <section className="sdf-overlap-demo">
      <LayoutCanvas className="canvas-shell sdf-overlap-canvas-shell" canvasClassName="demo-canvas">
        <ZStack alignment="center">
          {showCheckerboard ? (
            <Html zIndex={-2} sizing="fill">
              <div className="sdf-overlap-checkerboard" />
            </Html>
          ) : null}

          {backgroundImageUrl ? (
            <Html zIndex={-1} sizing="fill">
              <img
                alt=""
                className="sdf-overlap-background-image"
                src={backgroundImageUrl}
              />
            </Html>
          ) : null}

          <Frame maxWidth={Infinity} maxHeight={Infinity}>
            <GlassContainer
              blur={blur}
              spacing={containerSpacing}
              bezelWidth={bezelWidth}
              displacementBlur={displacementBlur}
              thickness={86}
              contentDepth={18}
              debugDisplacement={debugDisplacement}
              tint={{ ...tintColor, a: tintOpacity / 100 }}
              shadowColor={{ ...shadowColor, a: shadowOpacity / 100 }}
              shadowOffsetX={shadowOffsetX}
              shadowOffsetY={shadowOffsetY}
              shadowBlur={shadowBlur}
              shadowSpread={shadowSpread}
              specularOpacity={0.7}
            >
              <ZStack alignment="center">
                <Transform x={-centerOffset}>
                  <OverlapGlass cornerRadius={cornerRadius} />
                </Transform>
                <Transform x={centerOffset}>
                  <OverlapGlass cornerRadius={cornerRadius} />
                </Transform>
              </ZStack>
            </GlassContainer>
          </Frame>
        </ZStack>
      </LayoutCanvas>

      <aside className="panel sdf-overlap-controls">
        <Control
          id="sdf-overlap-distance"
          label="Edge distance"
          value={distance}
          min={-GLASS_WIDTH}
          max={180}
          unit="px"
          onChange={setDistance}
        />
        <Control
          id="sdf-container-spacing"
          label="Container spacing"
          value={containerSpacing}
          min={0}
          max={90}
          unit="px"
          onChange={setContainerSpacing}
        />
        <Control
          id="sdf-blur"
          label="Blur"
          value={blur}
          min={0}
          max={80}
          unit="px"
          onChange={setBlur}
        />
        <Control
          id="sdf-bezel-width"
          label="Bezel width"
          value={bezelWidth}
          min={0}
          max={80}
          unit="px"
          onChange={setBezelWidth}
        />
        <Control
          id="sdf-corner-radius"
          label="Corner radius"
          value={cornerRadius}
          min={0}
          max={120}
          unit="px"
          onChange={setCornerRadius}
        />
        <Control
          id="sdf-displacement-blur"
          label="Displacement blur"
          value={displacementBlur}
          min={0}
          max={32}
          unit="px"
          onChange={setDisplacementBlur}
        />
        <TintControl
          color={tintHex}
          opacity={tintOpacity}
          onColorChange={setTintHex}
          onOpacityChange={setTintOpacity}
        />
        <ColorOpacityControl
          id="sdf-shadow"
          label="Shadow color"
          color={shadowHex}
          opacity={shadowOpacity}
          onColorChange={setShadowHex}
          onOpacityChange={setShadowOpacity}
        />
        <Control
          id="sdf-shadow-offset-x"
          label="Shadow X"
          value={shadowOffsetX}
          min={-120}
          max={120}
          unit="px"
          onChange={setShadowOffsetX}
        />
        <Control
          id="sdf-shadow-offset-y"
          label="Shadow Y"
          value={shadowOffsetY}
          min={-120}
          max={160}
          unit="px"
          onChange={setShadowOffsetY}
        />
        <Control
          id="sdf-shadow-blur"
          label="Shadow blur"
          value={shadowBlur}
          min={0}
          max={120}
          unit="px"
          onChange={setShadowBlur}
        />
        <Control
          id="sdf-shadow-spread"
          label="Shadow spread"
          value={shadowSpread}
          min={-80}
          max={120}
          unit="px"
          onChange={setShadowSpread}
        />
        <Toggle
          id="sdf-checkerboard"
          label="Checkerboard"
          checked={showCheckerboard}
          onChange={setShowCheckerboard}
        />
        <Toggle
          id="sdf-debug-displacement"
          label="Debug displacement"
          checked={debugDisplacement}
          onChange={setDebugDisplacement}
        />
        <BackgroundImageControl
          imageName={backgroundImageName}
          onChange={updateBackgroundImage}
          onClear={clearBackgroundImage}
        />
      </aside>
    </section>
  )
}

function OverlapGlass({ cornerRadius }: { cornerRadius: number }) {
  return (
    <Glass cornerRadius={cornerRadius}>
      <Frame width={GLASS_WIDTH} height={GLASS_HEIGHT} />
    </Glass>
  )
}

type ControlProps = {
  id: string
  label: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (value: number) => void
}

function Control({ id, label, value, min, max, unit, onChange }: ControlProps) {
  const [draftValue, setDraftValue] = useState(String(value))

  useEffect(() => {
    setDraftValue(String(value))
  }, [value])

  const updateValue = (nextValue: number) => {
    const clampedValue = Math.min(max, Math.max(min, nextValue))
    onChange(clampedValue)
  }

  return (
    <label className="layout-control sdf-overlap-control" htmlFor={id}>
      <span>{label}</span>
      <output htmlFor={id}>{value}{unit}</output>
      <div className="sdf-overlap-control-row">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step="1"
          value={value}
          onChange={(event) => updateValue(Number(event.currentTarget.value))}
        />
        <input
          aria-label={label}
          className="sdf-overlap-number"
          type="number"
          min={min}
          max={max}
          step="1"
          value={draftValue}
          onBlur={() => setDraftValue(String(value))}
          onChange={(event) => {
            const nextDraftValue = event.currentTarget.value
            setDraftValue(nextDraftValue)

            if (nextDraftValue === '' || nextDraftValue === '-') {
              return
            }

            const nextValue = Number(nextDraftValue)
            if (Number.isFinite(nextValue)) {
              updateValue(nextValue)
            }
          }}
        />
      </div>
    </label>
  )
}

type ToggleProps = {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ id, label, checked, onChange }: ToggleProps) {
  return (
    <label className="sdf-overlap-toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

type TintControlProps = {
  color: string
  opacity: number
  onColorChange: (color: string) => void
  onOpacityChange: (opacity: number) => void
}

function TintControl({ color, opacity, onColorChange, onOpacityChange }: TintControlProps) {
  return (
    <ColorOpacityControl
      id="sdf-tint"
      label="Glass tint"
      color={color}
      opacity={opacity}
      onColorChange={onColorChange}
      onOpacityChange={onOpacityChange}
    />
  )
}

type ColorOpacityControlProps = {
  id: string
  label: string
  color: string
  opacity: number
  onColorChange: (color: string) => void
  onOpacityChange: (opacity: number) => void
}

function ColorOpacityControl({
  id,
  label,
  color,
  opacity,
  onColorChange,
  onOpacityChange,
}: ColorOpacityControlProps) {
  const labelId = `${id}-label`
  const colorId = `${id}-color`
  const opacityId = `${id}-opacity`

  return (
    <div className="layout-control sdf-overlap-color-control">
      <span id={labelId}>{label}</span>
      <output htmlFor={`${colorId} ${opacityId}`}>{color} / {opacity}%</output>
      <div className="sdf-overlap-color-row">
        <input
          id={colorId}
          type="color"
          value={color}
          aria-labelledby={labelId}
          onChange={(event) => onColorChange(event.currentTarget.value)}
        />
        <input
          id={opacityId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={opacity}
          aria-label="Tint opacity"
          onChange={(event) => onOpacityChange(Number(event.currentTarget.value))}
        />
        <input
          aria-label="Tint opacity"
          className="sdf-overlap-number"
          type="number"
          min={0}
          max={100}
          step={1}
          value={opacity}
          onChange={(event) => {
            const nextValue = Number(event.currentTarget.value)

            if (Number.isFinite(nextValue)) {
              onOpacityChange(Math.min(100, Math.max(0, nextValue)))
            }
          }}
        />
      </div>
    </div>
  )
}

type BackgroundImageControlProps = {
  imageName: string
  onChange: (file: File) => void
  onClear: () => void
}

function BackgroundImageControl({ imageName, onChange, onClear }: BackgroundImageControlProps) {
  return (
    <div className="layout-control sdf-overlap-image-control">
      <span id="sdf-background-image-label">Background image</span>
      <output htmlFor="sdf-background-image">{imageName || 'None'}</output>
      <div className="sdf-overlap-image-row">
        <input
          id="sdf-background-image"
          type="file"
          accept="image/*"
          aria-labelledby="sdf-background-image-label"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''

            if (file) {
              onChange(file)
            }
          }}
        />
        <button type="button" onClick={onClear} disabled={!imageName}>
          Clear
        </button>
      </div>
    </div>
  )
}

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16)

  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  }
}
