import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Image,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Platform,
  useColorScheme,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import Svg, { Polygon, Rect, Defs, Mask, Line } from 'react-native-svg';

// ---------------------------------------------------------------------------
//  Props & ref handle
// ---------------------------------------------------------------------------
export interface ImageCropPopUpProps {
  /** Source image URI to crop */
  imageUri: string | null;
  /** Called with the final cropped URI when the user confirms the crop */
  onComplete: (croppedUri: string) => void;
  /** Called when the user cancels / closes the popup */
  onCancel: () => void;
  /** Optional — called when the user taps "Take New Photo" in the dropdown */
  onTakeNewPhoto?: () => void;
}

export interface ImageCropPopUpRef {
  /** Open the crop popup */
  open: () => void;
  /** Close the crop popup */
  close: () => void;
}

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PREVIEW_MAX_WIDTH = SCREEN_WIDTH - 40;
const PREVIEW_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const HANDLE_HIT_SLOP = 30;
const BRACKET_LENGTH = 20;
const BRACKET_THICKNESS = 3;
const EDGE_TICK_LENGTH = 18;
const EDGE_HIT_THICKNESS = 28;
const MIN_CROP_SIZE = 40;
const ROTATION_HANDLE_DISTANCE = 50;
const SNAP_THRESHOLD = 2;
const SVG_PAD = 120;

// ---------------------------------------------------------------------------
//  Theme colours
// ---------------------------------------------------------------------------
type ThemeColors = typeof LIGHT_COLORS;

const LIGHT_COLORS = {
  background: '#f2f2f2',
  foreground: '#0f172a',
  surface: '#efefef',
  surfaceElevated: '#f2f2f3',
  card: '#f6f6f6',
  primary: '#007aff',
  primaryForeground: '#ffffff',
  secondary: '#6c7d8c',
  mutedForeground: '#393e44',
  border: '#e2e5eb',
  destructive: '#ef4444',
  primaryTint: 'rgba(0, 122, 255, 0.10)',
  overlay: 'rgba(0, 0, 0, 0.45)',
  handleBg: 'rgba(255, 255, 255, 0.85)',
  shadow: '#000',
};

const DARK_COLORS: ThemeColors = {
  background: '#09090b',
  foreground: '#ffffff',
  surface: '#0e1116',
  surfaceElevated: '#06080a',
  card: '#18181b',
  primary: '#007aff',
  primaryForeground: '#ffffff',
  secondary: '#747984',
  mutedForeground: '#9ca3af',
  border: '#131924',
  destructive: '#ef4444',
  primaryTint: 'rgba(0, 122, 255, 0.15)',
  overlay: 'rgba(0, 0, 0, 0.65)',
  handleBg: 'rgba(30, 30, 30, 0.85)',
  shadow: '#000',
};

// ---------------------------------------------------------------------------
//  Types & helpers
// ---------------------------------------------------------------------------
type CropRect = { x: number; y: number; w: number; h: number };
type Point = { x: number; y: number };
type HandleId = 'tl' | 'tr' | 'bl' | 'br' | 'top' | 'bottom' | 'left' | 'right';

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

/** Wrap any angle into the half-open range (-180, 180]. */
function normalizeAngle(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

function snapRotation(deg: number): number {
  const n = normalizeAngle(deg);
  for (const t of [-180, -90, 0, 90, 180])
    if (Math.abs(n - t) <= SNAP_THRESHOLD) return t;
  return n;
}

function rotateVector(dx: number, dy: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad),
    y: dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

function getRotatedCorners(
  rect: CropRect,
  angleDeg: number,
): [Point, Point, Point, Point] {
  const cx = rect.x + rect.w / 2,
    cy = rect.y + rect.h / 2;
  const hw = rect.w / 2,
    hh = rect.h / 2;
  const off: [Point, Point, Point, Point] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  return off.map(({ x, y }) => {
    const r = rotateVector(x, y, angleDeg);
    return { x: cx + r.x, y: cy + r.y };
  }) as [Point, Point, Point, Point];
}

function getRotatedEdgeMidpoint(
  rect: CropRect,
  edge: 'top' | 'bottom' | 'left' | 'right',
  angleDeg: number,
): Point {
  const cx = rect.x + rect.w / 2,
    cy = rect.y + rect.h / 2;
  const local: Point =
    edge === 'top'
      ? { x: 0, y: -rect.h / 2 }
      : edge === 'bottom'
        ? { x: 0, y: rect.h / 2 }
        : edge === 'left'
          ? { x: -rect.w / 2, y: 0 }
          : { x: rect.w / 2, y: 0 };
  const r = rotateVector(local.x, local.y, angleDeg);
  return { x: cx + r.x, y: cy + r.y };
}

function getAnchorOffset(handle: HandleId, rect: CropRect): Point {
  const hw = rect.w / 2,
    hh = rect.h / 2;
  switch (handle) {
    case 'tl':
      return { x: hw, y: hh };
    case 'tr':
      return { x: -hw, y: hh };
    case 'bl':
      return { x: hw, y: -hh };
    case 'br':
      return { x: -hw, y: -hh };
    case 'top':
      return { x: 0, y: hh };
    case 'bottom':
      return { x: 0, y: -hh };
    case 'left':
      return { x: hw, y: 0 };
    case 'right':
      return { x: -hw, y: 0 };
  }
}

function anchorFixup(
  oldRect: CropRect,
  newRect: CropRect,
  handle: HandleId,
  rotation: number,
): CropRect {
  const oldOff = getAnchorOffset(handle, oldRect);
  const newOff = getAnchorOffset(handle, newRect);
  const oldCx = oldRect.x + oldRect.w / 2,
    oldCy = oldRect.y + oldRect.h / 2;
  const oldRot = rotateVector(oldOff.x, oldOff.y, rotation);
  const anchorSx = oldCx + oldRot.x,
    anchorSy = oldCy + oldRot.y;
  const newRot = rotateVector(newOff.x, newOff.y, rotation);
  return {
    x: anchorSx - newRot.x - newRect.w / 2,
    y: anchorSy - newRot.y - newRect.h / 2,
    w: newRect.w,
    h: newRect.h,
  };
}

function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function StrokedLine({
  x1,
  y1,
  x2,
  y2,
  color,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}) {
  return (
    <>
      <Line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke='#fff'
        strokeWidth={BRACKET_THICKNESS + 2}
        strokeLinecap='round'
      />
      <Line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={BRACKET_THICKNESS}
        strokeLinecap='round'
      />
    </>
  );
}

const ALL_HANDLE_IDS: HandleId[] = [
  'tl',
  'tr',
  'br',
  'bl',
  'top',
  'bottom',
  'left',
  'right',
];

function handleLocalOffset(id: HandleId, w: number, h: number): Point {
  const hw = w / 2,
    hh = h / 2;
  switch (id) {
    case 'tl':
      return { x: -hw, y: -hh };
    case 'tr':
      return { x: hw, y: -hh };
    case 'br':
      return { x: hw, y: hh };
    case 'bl':
      return { x: -hw, y: hh };
    case 'top':
      return { x: 0, y: -hh };
    case 'bottom':
      return { x: 0, y: hh };
    case 'left':
      return { x: -hw, y: 0 };
    case 'right':
      return { x: hw, y: 0 };
  }
}

// ---------------------------------------------------------------------------
//  ResizeHandle (corners + edges)
// ---------------------------------------------------------------------------
function ResizeHandle({
  handle,
  cropRect,
  rotation,
  onUpdateRect,
  bounds,
}: {
  handle: HandleId;
  cropRect: CropRect;
  rotation: number;
  onUpdateRect: (r: CropRect) => void;
  bounds: { width: number; height: number };
}) {
  const startRect = useRef<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const cropRef = useLatest(cropRect);
  const boundsRef = useLatest(bounds);
  const cbRef = useLatest(onUpdateRect);
  const rotRef = useLatest(rotation);

  const isCorner = handle.length === 2;
  const adjustsLeft = handle === 'tl' || handle === 'bl' || handle === 'left';
  const adjustsRight = handle === 'tr' || handle === 'br' || handle === 'right';
  const adjustsTop = handle === 'tl' || handle === 'tr' || handle === 'top';
  const adjustsBottom =
    handle === 'bl' || handle === 'br' || handle === 'bottom';

  const cx = cropRect.x + cropRect.w / 2,
    cy = cropRect.y + cropRect.h / 2;
  const local = handleLocalOffset(handle, cropRect.w, cropRect.h);
  const rp = rotateVector(local.x, local.y, rotation);
  const sx = cx + rp.x,
    sy = cy + rp.y;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRect.current = { ...cropRef.current };
      },
      onPanResponderMove: (
        _: GestureResponderEvent,
        g: PanResponderGestureState,
      ) => {
        const lv = rotateVector(g.dx, g.dy, -rotRef.current);
        const r = startRect.current,
          b = boundsRef.current;
        let { x: nx, y: ny, w: nw, h: nh } = r;
        if (adjustsLeft) {
          nx = clamp(r.x + lv.x, 0, r.x + r.w - MIN_CROP_SIZE);
          nw = r.w - (nx - r.x);
        } else if (adjustsRight) {
          nw = clamp(r.x + r.w + lv.x, r.x + MIN_CROP_SIZE, b.width) - r.x;
        }
        if (adjustsTop) {
          const bot = r.y + r.h;
          ny = clamp(r.y + lv.y, 0, bot - MIN_CROP_SIZE);
          nh = bot - ny;
        } else if (adjustsBottom) {
          nh = clamp(r.y + r.h + lv.y, r.y + MIN_CROP_SIZE, b.height) - r.y;
        }
        cbRef.current(
          anchorFixup(
            r,
            { x: nx, y: ny, w: nw, h: nh },
            handle,
            rotRef.current,
          ),
        );
      },
    }),
  ).current;

  if (isCorner) {
    return (
      <View
        style={[
          staticStyles.handleContainer,
          {
            left: sx - HANDLE_HIT_SLOP,
            top: sy - HANDLE_HIT_SLOP,
            width: HANDLE_HIT_SLOP * 2,
            height: HANDLE_HIT_SLOP * 2,
          },
        ]}
        {...panResponder.panHandlers}
      />
    );
  }
  const isVert = handle === 'left' || handle === 'right';
  const hitW = isVert ? EDGE_HIT_THICKNESS : Math.max(cropRect.w * 0.5, 30);
  const hitH = isVert ? Math.max(cropRect.h * 0.5, 30) : EDGE_HIT_THICKNESS;
  return (
    <View
      style={[
        staticStyles.edgeHitArea,
        { left: sx - hitW / 2, top: sy - hitH / 2, width: hitW, height: hitH },
      ]}
      {...panResponder.panHandlers}
    />
  );
}

// ---------------------------------------------------------------------------
//  MoveOriginHandle
// ---------------------------------------------------------------------------
function MoveOriginHandle({
  cropRect,
  onUpdateRect,
  bounds,
  colors,
}: {
  cropRect: CropRect;
  onUpdateRect: (r: CropRect) => void;
  bounds: { width: number; height: number };
  colors: ThemeColors;
}) {
  const startRect = useRef<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const cropRef = useLatest(cropRect);
  const boundsRef = useLatest(bounds);
  const cbRef = useLatest(onUpdateRect);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRect.current = { ...cropRef.current };
      },
      onPanResponderMove: (
        _: GestureResponderEvent,
        g: PanResponderGestureState,
      ) => {
        const r = startRect.current,
          b = boundsRef.current;
        cbRef.current({
          x: clamp(r.x + g.dx, 0, b.width - r.w),
          y: clamp(r.y + g.dy, 0, b.height - r.h),
          w: r.w,
          h: r.h,
        });
      },
    }),
  ).current;

  const cx = cropRect.x + cropRect.w / 2,
    cy = cropRect.y + cropRect.h / 2;
  return (
    <View
      style={[
        staticStyles.moveOriginHitArea,
        {
          left: cx - HANDLE_HIT_SLOP,
          top: cy - HANDLE_HIT_SLOP,
          width: HANDLE_HIT_SLOP * 2,
          height: HANDLE_HIT_SLOP * 2,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          staticStyles.moveOriginKnob,
          { borderColor: colors.primary, backgroundColor: colors.handleBg },
        ]}
      >
        <Text style={[staticStyles.moveOriginIcon, { color: colors.primary }]}>
          {'\u271A'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
//  RotationHandle
// ---------------------------------------------------------------------------
function RotationHandle({
  cropRect,
  rotation,
  onRotationChange,
  previewLayoutRef,
  colors,
}: {
  cropRect: CropRect;
  rotation: number;
  onRotationChange: (deg: number) => void;
  previewLayoutRef: React.MutableRefObject<{ x: number; y: number } | null>;
  colors: ThemeColors;
}) {
  const startAngle = useRef(0),
    startRot = useRef(0);
  const rotRef = useLatest(rotation);
  const cbRef = useLatest(onRotationChange);
  const cropRef = useLatest(cropRect);

  const getCropCenter = (): Point => {
    const layout = previewLayoutRef.current,
      cr = cropRef.current;
    const cx = cr.x + cr.w / 2,
      cy = cr.y + cr.h / 2;
    return layout
      ? { x: layout.x + cx, y: layout.y + cy }
      : { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        startRot.current = rotRef.current;
        const c = getCropCenter();
        startAngle.current = Math.atan2(
          evt.nativeEvent.pageY - c.y,
          evt.nativeEvent.pageX - c.x,
        );
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const c = getCropCenter();
        const cur = Math.atan2(
          evt.nativeEvent.pageY - c.y,
          evt.nativeEvent.pageX - c.x,
        );
        const raw =
          startRot.current + ((cur - startAngle.current) * 180) / Math.PI;
        cbRef.current(snapRotation(raw));
      },
      onPanResponderRelease: () => {
        cbRef.current(normalizeAngle(rotRef.current));
      },
    }),
  ).current;

  const cx = cropRect.x + cropRect.w / 2,
    cy = cropRect.y + cropRect.h / 2;
  const off = rotateVector(
    0,
    cropRect.h / 2 + ROTATION_HANDLE_DISTANCE,
    rotation,
  );
  return (
    <View
      style={[
        staticStyles.rotationHitArea,
        {
          left: cx + off.x - HANDLE_HIT_SLOP,
          top: cy + off.y - HANDLE_HIT_SLOP,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View
        style={[
          staticStyles.rotationKnob,
          {
            backgroundColor: colors.primary,
            borderColor: colors.primaryForeground,
          },
        ]}
      >
        <Text
          style={[
            staticStyles.rotationKnobIcon,
            { color: colors.primaryForeground },
          ]}
        >
          {'\u21BB'}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
//  Main component
// ---------------------------------------------------------------------------
const ImageCropPopUp = forwardRef<ImageCropPopUpRef, ImageCropPopUpProps>(
  function ImageCropPopUp(
    { imageUri, onComplete, onCancel, onTakeNewPhoto },
    ref,
  ) {
    const colorScheme = useColorScheme();
    const colors = colorScheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    const themed = useMemo(() => createThemedStyles(colors), [colorScheme]);

    const [visible, setVisible] = useState(false);
    const onDismissRef = useRef<(() => void) | null>(null);

    useImperativeHandle(ref, () => ({
      open: () => setVisible(true),
      close: () => setVisible(false),
    }));

    const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    const [previewW, setPreviewW] = useState(PREVIEW_MAX_WIDTH);
    const [previewH, setPreviewH] = useState(PREVIEW_MAX_HEIGHT);
    const [previewScale, setPreviewScale] = useState(1);

    const [cropRect, setCropRect] = useState<CropRect>({
      x: 0,
      y: 0,
      w: 100,
      h: 100,
    });
    const [rotation, setRotation] = useState(0);
    const [previewUri, setPreviewUri] = useState<string | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [previewRotation, setPreviewRotation] = useState(0);

    const previewLayoutRef = useRef<{ x: number; y: number } | null>(null);
    const previewRef = useRef<View>(null);

    // Auto-open AND reset state when a new imageUri arrives.
    // We intentionally do NOT depend on `visible` here — `imageUri` becoming
    // truthy is the single trigger that opens the modal and loads dimensions
    // in one effect, avoiding the race where a separate auto-open effect
    // sets visible=true but the reset effect still sees visible=false.
    useEffect(() => {
      if (!imageUri) return;
      setVisible(true);
      setPreviewUri(null);
      setPreviewRotation(0);
      setDropdownOpen(false);
      setRotation(0);
      setImageLoading(true);
      Image.getSize(
        imageUri,
        (w, h) => {
          setImageSize({ width: w, height: h });
          const s = Math.min(PREVIEW_MAX_WIDTH / w, PREVIEW_MAX_HEIGHT / h, 1);
          const pw = w * s,
            ph = h * s;
          setPreviewScale(s);
          setPreviewW(pw);
          setPreviewH(ph);
          setCropRect({ x: 0, y: 0, w: pw, h: ph });
          setImageLoading(false);
        },
        () => {
          Alert.alert('Error', 'Could not load image dimensions.');
          setImageLoading(false);
        },
      );
    }, [imageUri]);

    const handleUseCrop = useCallback(async () => {
      if (!imageUri) return;
      setLoading(true);
      try {
        const actions: ImageManipulator.Action[] = [];
        const rotAngle = -rotation;
        const origW = imageSize.width,
          origH = imageSize.height;
        let canvasW = origW,
          canvasH = origH;

        if (Math.abs(rotAngle) > 0.1) {
          actions.push({ rotate: rotAngle });
          const rad = Math.abs((rotAngle * Math.PI) / 180);
          const cosA = Math.abs(Math.cos(rad)),
            sinA = Math.abs(Math.sin(rad));
          canvasW = Math.round(origW * cosA + origH * sinA);
          canvasH = Math.round(origH * cosA + origW * sinA);
        }

        const cropCx = cropRect.x + cropRect.w / 2,
          cropCy = cropRect.y + cropRect.h / 2;
        const imgCx = previewW / 2,
          imgCy = previewH / 2;
        const dx = cropCx - imgCx,
          dy = cropCy - imgCy;
        const rad = (rotAngle * Math.PI) / 180;
        const rdx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const rdy = dx * Math.sin(rad) + dy * Math.cos(rad);

        const cropWImg = cropRect.w / previewScale,
          cropHImg = cropRect.h / previewScale;
        const canvasCx = canvasW / 2,
          canvasCy = canvasH / 2;
        const cropCxCanvas = canvasCx + rdx / previewScale,
          cropCyCanvas = canvasCy + rdy / previewScale;

        const originX = Math.max(0, Math.round(cropCxCanvas - cropWImg / 2));
        const originY = Math.max(0, Math.round(cropCyCanvas - cropHImg / 2));
        const finalW = Math.max(1, Math.round(cropWImg));
        const finalH = Math.max(1, Math.round(cropHImg));

        actions.push({
          crop: {
            originX,
            originY,
            width: Math.min(finalW, canvasW - originX),
            height: Math.min(finalH, canvasH - originY),
          },
        });

        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          actions,
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        setPreviewUri(result.uri);
      } catch (err: any) {
        Alert.alert('Crop Error', err.message || 'Failed to crop the image.');
      } finally {
        setLoading(false);
      }
    }, [
      imageUri,
      cropRect,
      previewScale,
      imageSize,
      rotation,
      previewW,
      previewH,
    ]);

    const handleConfirmCrop = useCallback(async () => {
      if (!previewUri) return;
      try {
        let finalUri = previewUri;
        if (previewRotation % 360 !== 0) {
          const rotResult = await ImageManipulator.manipulateAsync(
            previewUri,
            [
              {
                rotate: previewRotation % 360,
              },
            ],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
          );
          finalUri = rotResult.uri;
        }
        setVisible(false);
        onComplete(finalUri);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to finalize crop.');
      }
    }, [previewUri, previewRotation, onComplete]);

    const handleCropCancel = useCallback(() => {
      setVisible(false);
      setPreviewUri(null);
      setPreviewRotation(0);
      setDropdownOpen(false);
      onCancel();
    }, [onCancel]);

    const handleEditCrop = useCallback(() => {
      setPreviewUri(null);
      setPreviewRotation(0);
      setDropdownOpen(false);
    }, []);

    const handleTakeNewPhoto = useCallback(() => {
      setPreviewUri(null);
      setPreviewRotation(0);
      setDropdownOpen(false);
      if (Platform.OS === 'ios') {
        // iOS: defer via onDismiss so the modal is fully gone
        onDismissRef.current = () => onTakeNewPhoto?.();
      } else {
        // Android: onDismiss doesn't fire, use a timeout
        setTimeout(() => onTakeNewPhoto?.(), 500);
      }
      setVisible(false);
    }, [onTakeNewPhoto]);

    // --- Render ---
    const renderContent = () => {
      if (!imageUri) {
        return (
          <View style={themed.center}>
            <Text style={themed.errorText}>No image provided.</Text>
            <TouchableOpacity
              style={themed.cancelBtn}
              onPress={handleCropCancel}
            >
              <Text style={themed.cancelBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        );
      }

      if (imageLoading) {
        return (
          <View style={themed.center}>
            <ActivityIndicator size='large' color={colors.primary} />
            <Text style={{ marginTop: 12, color: colors.mutedForeground }}>
              Loading image{'\u2026'}
            </Text>
          </View>
        );
      }

      // --- Preview screen ---
      if (previewUri) {
        return (
          <View style={themed.container}>
            <Text style={themed.title}>Crop Preview</Text>
            <Text style={themed.subtitle}>
              Review the cropped result. Make sure the receipt looks properly
              aligned.
            </Text>
            <Text style={themed.orientationGuide}>
              Rotate the receipt so that it reads top to bottom.
            </Text>

            <View style={themed.previewImageWrapper}>
              <Image
                source={{ uri: previewUri }}
                style={[
                  themed.previewImage,
                  { transform: [{ rotate: `${previewRotation}deg` }] },
                ]}
                resizeMode='contain'
              />
            </View>

            <View style={themed.rotateRow}>
              <TouchableOpacity
                style={themed.rotateBtn}
                onPress={() => setPreviewRotation((r) => r - 90)}
              >
                <Text style={themed.rotateBtnIcon}>{'\u21BA'}</Text>
                <Text style={themed.rotateBtnLabel}>{'-90\u00B0'}</Text>
              </TouchableOpacity>
              <Text style={themed.rotateReadout}>
                {((previewRotation % 360) + 360) % 360}
                {'\u00B0'}
              </Text>
              <TouchableOpacity
                style={themed.rotateBtn}
                onPress={() => setPreviewRotation((r) => r + 90)}
              >
                <Text style={themed.rotateBtnIcon}>{'\u21BB'}</Text>
                <Text style={themed.rotateBtnLabel}>{'+90\u00B0'}</Text>
              </TouchableOpacity>
            </View>

            <View style={themed.previewActions}>
              <View style={themed.editCropRow}>
                <TouchableOpacity
                  style={themed.editCropBtn}
                  onPress={handleEditCrop}
                >
                  <Text style={themed.editCropBtnText}>Edit Crop</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={themed.editCropDropdownTrigger}
                  onPress={() => setDropdownOpen(!dropdownOpen)}
                >
                  <Text style={themed.dropdownArrow}>
                    {dropdownOpen ? '\u25B2' : '\u25BC'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={themed.confirmCropBtn}
                onPress={handleConfirmCrop}
              >
                <Text style={themed.confirmCropBtnText}>Use This Crop</Text>
              </TouchableOpacity>
            </View>

            {dropdownOpen && (
              <>
                <Pressable
                  style={themed.dropdownBackdrop}
                  onPress={() => setDropdownOpen(false)}
                />
                <View style={themed.dropdownMenu}>
                  {onTakeNewPhoto && (
                    <TouchableOpacity
                      style={themed.dropdownItem}
                      onPress={handleTakeNewPhoto}
                    >
                      <Text
                        style={[
                          themed.dropdownItemText,
                          { color: colors.destructive },
                        ]}
                      >
                        Take New Photo
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        );
      }

      // --- Crop editor ---
      const rotatedCorners = getRotatedCorners(cropRect, rotation);
      const polygonPoints = rotatedCorners
        .map((c) => `${c.x},${c.y}`)
        .join(' ');
      const cx = cropRect.x + cropRect.w / 2,
        cy = cropRect.y + cropRect.h / 2;
      const lineStart = rotateVector(0, cropRect.h / 2, rotation);
      const lineEnd = rotateVector(
        0,
        cropRect.h / 2 + ROTATION_HANDLE_DISTANCE,
        rotation,
      );
      const edgeMids = {
        top: getRotatedEdgeMidpoint(cropRect, 'top', rotation),
        bottom: getRotatedEdgeMidpoint(cropRect, 'bottom', rotation),
        left: getRotatedEdgeMidpoint(cropRect, 'left', rotation),
        right: getRotatedEdgeMidpoint(cropRect, 'right', rotation),
      };

      return (
        <View style={themed.container}>
          <Text style={themed.title}>Crop Receipt</Text>
          <Text style={themed.subtitle}>
            Drag edges or corners to resize, crosshair to move, handle to rotate
          </Text>

          <View
            ref={previewRef}
            style={[
              themed.previewContainer,
              { width: previewW, height: previewH },
            ]}
            onLayout={() => {
              previewRef.current?.measureInWindow((x: number, y: number) => {
                previewLayoutRef.current = { x, y };
              });
            }}
          >
            <View pointerEvents='none'>
              <Image
                source={{ uri: imageUri }}
                style={{ width: previewW, height: previewH }}
                resizeMode='contain'
              />
            </View>

            <Svg
              style={{ position: 'absolute', left: -SVG_PAD, top: -SVG_PAD }}
              width={previewW + SVG_PAD * 2}
              height={previewH + SVG_PAD * 2}
              viewBox={`${-SVG_PAD} ${-SVG_PAD} ${previewW + SVG_PAD * 2} ${previewH + SVG_PAD * 2}`}
              pointerEvents='none'
            >
              <Defs>
                <Mask id='cropMask'>
                  <Rect
                    x='0'
                    y='0'
                    width={previewW}
                    height={previewH}
                    fill='white'
                  />
                  <Polygon points={polygonPoints} fill='black' />
                </Mask>
              </Defs>
              <Rect
                x='0'
                y='0'
                width={previewW}
                height={previewH}
                fill={colors.overlay}
                mask='url(#cropMask)'
              />
              <Polygon
                points={polygonPoints}
                fill='none'
                stroke={colors.primary}
                strokeWidth={2}
                strokeDasharray='6,4'
              />
              {rotatedCorners.map((c, i) => {
                const hDir = i === 0 || i === 3 ? 1 : -1;
                const vDir = i === 0 || i === 1 ? 1 : -1;
                const h = rotateVector(hDir * BRACKET_LENGTH, 0, rotation);
                const v = rotateVector(0, vDir * BRACKET_LENGTH, rotation);
                return (
                  <React.Fragment key={i}>
                    <StrokedLine
                      x1={c.x}
                      y1={c.y}
                      x2={c.x + h.x}
                      y2={c.y + h.y}
                      color={colors.primary}
                    />
                    <StrokedLine
                      x1={c.x}
                      y1={c.y}
                      x2={c.x + v.x}
                      y2={c.y + v.y}
                      color={colors.primary}
                    />
                  </React.Fragment>
                );
              })}
              {(['top', 'bottom', 'left', 'right'] as const).map((e) => {
                const m = edgeMids[e];
                const half = EDGE_TICK_LENGTH / 2;
                const d =
                  e === 'top' || e === 'bottom'
                    ? rotateVector(half, 0, rotation)
                    : rotateVector(0, half, rotation);
                return (
                  <StrokedLine
                    key={e}
                    x1={m.x - d.x}
                    y1={m.y - d.y}
                    x2={m.x + d.x}
                    y2={m.y + d.y}
                    color={colors.primary}
                  />
                );
              })}
              <Line
                x1={cx + lineStart.x}
                y1={cy + lineStart.y}
                x2={cx + lineEnd.x}
                y2={cy + lineEnd.y}
                stroke={colors.primary}
                strokeWidth={2}
                strokeDasharray='4,4'
              />
            </Svg>

            {ALL_HANDLE_IDS.map((id) => (
              <ResizeHandle
                key={id}
                handle={id}
                cropRect={cropRect}
                rotation={rotation}
                onUpdateRect={setCropRect}
                bounds={{ width: previewW, height: previewH }}
              />
            ))}
            <MoveOriginHandle
              cropRect={cropRect}
              onUpdateRect={setCropRect}
              bounds={{ width: previewW, height: previewH }}
              colors={colors}
            />
            <RotationHandle
              cropRect={cropRect}
              rotation={rotation}
              onRotationChange={setRotation}
              previewLayoutRef={previewLayoutRef}
              colors={colors}
            />
          </View>

          <View style={themed.rotationReadout}>
            <Text style={themed.rotationText}>
              {Math.round(rotation)}
              {'\u00B0'}
            </Text>
          </View>

          <View style={themed.actions}>
            <TouchableOpacity
              style={themed.cancelBtn}
              onPress={handleCropCancel}
              disabled={loading}
            >
              <Text style={themed.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={themed.cropBtn}
              onPress={handleUseCrop}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  color={colors.primaryForeground}
                  size='small'
                />
              ) : (
                <Text style={themed.cropBtnText}>Use Crop</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    };

    return (
      <Modal
        visible={visible}
        animationType='slide'
        presentationStyle='fullScreen'
        onRequestClose={handleCropCancel}
        onDismiss={() => {
          const cb = onDismissRef.current;
          onDismissRef.current = null;
          cb?.();
        }}
      >
        {renderContent()}
      </Modal>
    );
  },
);

export default ImageCropPopUp;

// ---------------------------------------------------------------------------
//  Static styles (no colours)
// ---------------------------------------------------------------------------
const staticStyles = StyleSheet.create({
  handleContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  edgeHitArea: { position: 'absolute', zIndex: 8 },
  moveOriginHitArea: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  moveOriginKnob: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  moveOriginIcon: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },
  rotationHitArea: {
    position: 'absolute',
    width: HANDLE_HIT_SLOP * 2,
    height: HANDLE_HIT_SLOP * 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  rotationKnob: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  rotationKnobIcon: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },
});

// ---------------------------------------------------------------------------
//  Theme-aware styles
// ---------------------------------------------------------------------------
function createThemedStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      paddingTop: 50,
      alignItems: 'center',
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.background,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 4,
      color: c.foreground,
    },
    subtitle: {
      fontSize: 14,
      color: c.mutedForeground,
      marginBottom: 16,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    previewContainer: {
      overflow: 'visible',
      borderRadius: 8,
      backgroundColor: c.surface,
      position: 'relative',
      alignItems: 'center',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 30,
      paddingTop: 20,
      width: '100%',
      gap: 16,
      marginTop: 'auto',
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: c.primary,
      alignItems: 'center',
    },
    cancelBtnText: { color: c.primary, fontSize: 16, fontWeight: '600' },
    cropBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: c.primary,
      alignItems: 'center',
    },
    cropBtnText: {
      color: c.primaryForeground,
      fontSize: 16,
      fontWeight: '600',
    },
    errorText: { fontSize: 16, color: c.mutedForeground, marginBottom: 20 },
    rotationReadout: {
      marginTop: 12,
      marginBottom: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: c.primaryTint,
    },
    rotationText: { fontSize: 14, fontWeight: '600', color: c.primary },
    previewImageWrapper: {
      flex: 1,
      width: PREVIEW_MAX_WIDTH,
      maxHeight: SCREEN_HEIGHT * 0.55,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewImage: { width: '100%', height: '100%' },
    orientationGuide: {
      fontSize: 13,
      color: c.primary,
      fontWeight: '500',
      fontStyle: 'italic',
      marginBottom: 12,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    rotateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      marginTop: 12,
      marginBottom: 4,
    },
    rotateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: c.primaryTint,
    },
    rotateBtnIcon: { fontSize: 18, color: c.primary },
    rotateBtnLabel: { fontSize: 14, fontWeight: '600', color: c.primary },
    rotateReadout: {
      fontSize: 15,
      fontWeight: '700',
      color: c.foreground,
      minWidth: 36,
      textAlign: 'center',
    },
    previewActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 30,
      paddingTop: 20,
      width: '100%',
      gap: 12,
      marginTop: 'auto',
    },
    editCropRow: {
      flex: 1,
      flexDirection: 'row',
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: c.primary,
      overflow: 'hidden',
    },
    editCropBtn: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editCropBtnText: { color: c.primary, fontSize: 15, fontWeight: '600' },
    editCropDropdownTrigger: {
      paddingHorizontal: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderLeftWidth: 1.5,
      borderLeftColor: c.primary,
    },
    dropdownArrow: { color: c.primary, fontSize: 10, fontWeight: '700' },
    confirmCropBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmCropBtnText: {
      color: c.primaryForeground,
      fontSize: 15,
      fontWeight: '600',
    },
    dropdownBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
    },
    dropdownMenu: {
      position: 'absolute',
      bottom: 80,
      left: 20,
      width: 180,
      backgroundColor: c.card,
      borderRadius: 10,
      shadowColor: c.shadow,
      shadowOpacity: 0.15,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: -2 },
      elevation: 8,
      zIndex: 51,
      overflow: 'hidden',
    },
    dropdownItem: { paddingVertical: 14, paddingHorizontal: 16 },
    dropdownItemText: { fontSize: 15, fontWeight: '500', color: c.foreground },
    dropdownDivider: { height: 1, backgroundColor: c.border },
  });
}
