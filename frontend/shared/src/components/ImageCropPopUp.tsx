import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  Modal,
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  /**
   * Optional initial crop rect (in preview-coordinate space) to restore a
   * previous crop session. Pass alongside `initialRotation`.
   */
  initialCropRect?: { x: number; y: number; w: number; h: number };
  /** Initial crop rotation in degrees to restore a previous crop session. */
  initialRotation?: number;
  /**
   * Called just before `onComplete` with the raw editor crop parameters, so
   * the caller can store them and pass them back as `initialCropRect` /
   * `initialRotation` for a future re-crop of the same image.
   */
  onCropMetadata?: (
    cropRect: { x: number; y: number; w: number; h: number },
    rotation: number,
  ) => void;
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
//  Raw colours for SVG elements & component props that don't support className
// ---------------------------------------------------------------------------
const RAW_PRIMARY = '#4999df';
const RAW_PRIMARY_FG = '#ffffff';
const OVERLAY_LIGHT = 'rgba(0, 0, 0, 0.45)';
const OVERLAY_DARK = 'rgba(0, 0, 0, 0.65)';

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
        className='absolute justify-center items-center z-10'
        style={{
          left: sx - HANDLE_HIT_SLOP,
          top: sy - HANDLE_HIT_SLOP,
          width: HANDLE_HIT_SLOP * 2,
          height: HANDLE_HIT_SLOP * 2,
        }}
        {...panResponder.panHandlers}
      />
    );
  }
  const isVert = handle === 'left' || handle === 'right';
  const hitW = isVert ? EDGE_HIT_THICKNESS : Math.max(cropRect.w * 0.5, 30);
  const hitH = isVert ? Math.max(cropRect.h * 0.5, 30) : EDGE_HIT_THICKNESS;
  return (
    <View
      className='absolute z-[8]'
      style={{
        left: sx - hitW / 2,
        top: sy - hitH / 2,
        width: hitW,
        height: hitH,
      }}
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
}: {
  cropRect: CropRect;
  onUpdateRect: (r: CropRect) => void;
  bounds: { width: number; height: number };
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
      className='absolute justify-center items-center z-[15]'
      style={{
        left: cx - HANDLE_HIT_SLOP,
        top: cy - HANDLE_HIT_SLOP,
        width: HANDLE_HIT_SLOP * 2,
        height: HANDLE_HIT_SLOP * 2,
      }}
      {...panResponder.panHandlers}
    >
      <View className='w-[30px] h-[30px] rounded-full border-2 justify-center items-center shadow-sm border-primary bg-white/85 dark:bg-[rgba(30,30,30,0.85)]'>
        <MaterialCommunityIcons
          name='cursor-move'
          size={18}
          color={RAW_PRIMARY}
        />
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
}: {
  cropRect: CropRect;
  rotation: number;
  onRotationChange: (deg: number) => void;
  previewLayoutRef: React.MutableRefObject<{ x: number; y: number } | null>;
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
      className='absolute w-[60px] h-[60px] justify-center items-center z-20'
      style={{
        left: cx + off.x - HANDLE_HIT_SLOP,
        top: cy + off.y - HANDLE_HIT_SLOP,
      }}
      {...panResponder.panHandlers}
    >
      <View className='w-[34px] h-[34px] rounded-full border-2 justify-center items-center shadow-md bg-primary border-primary-foreground'>
        <Text className='text-lg font-bold leading-5 text-center text-primary-foreground'>
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
    {
      imageUri,
      onComplete,
      onCancel,
      onTakeNewPhoto,
      initialCropRect,
      initialRotation,
      onCropMetadata,
    },
    ref,
  ) {
    const colorScheme = useColorScheme();
    const overlayColor = colorScheme === 'dark' ? OVERLAY_DARK : OVERLAY_LIGHT;

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
      setRotation(initialRotation ?? 0);
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
          // Restore previous crop box if provided, otherwise default to full image
          setCropRect(initialCropRect ?? { x: 0, y: 0, w: pw, h: ph });
          setImageLoading(false);
        },
        () => {
          Alert.alert('Error', 'Could not load image dimensions.');
          setImageLoading(false);
        },
      );
    }, [imageUri]); // eslint-disable-line react-hooks/exhaustive-deps -- initialCropRect/initialRotation are intentionally read from closure at open time

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
        onCropMetadata?.(cropRect, rotation);
        setVisible(false);
        onComplete(finalUri);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to finalize crop.');
      }
    }, [
      previewUri,
      previewRotation,
      onComplete,
      onCropMetadata,
      cropRect,
      rotation,
    ]);

    const handleCropCancel = useCallback(() => {
      const cleanup = () => {
        setPreviewUri(null);
        setPreviewRotation(0);
        setDropdownOpen(false);
      };
      if (Platform.OS === 'ios') {
        onDismissRef.current = cleanup;
      } else {
        setTimeout(cleanup, 400);
      }
      setVisible(false);
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
          <View className='flex-1 justify-center items-center bg-background'>
            <Text className='text-base text-muted-foreground mb-5'>
              No image provided.
            </Text>
            <TouchableOpacity
              className='flex-1 py-[14px] rounded-[10px] border-[1.5px] border-primary items-center'
              onPress={handleCropCancel}
            >
              <Text className='text-primary text-base font-semibold'>
                Go Back
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      if (imageLoading) {
        return (
          <View className='flex-1 justify-center items-center bg-background'>
            <ActivityIndicator size='large' color={RAW_PRIMARY} />
            <Text className='mt-3 text-muted-foreground'>
              Loading image{'\u2026'}
            </Text>
          </View>
        );
      }

      // --- Preview screen ---
      if (previewUri) {
        return (
          <View className='flex-1 bg-background pt-[50px] items-center'>
            <Text className='text-xl font-bold mb-3 text-foreground'>
              Crop Preview
            </Text>

            <View
              className='flex-1 rounded-xl overflow-hidden bg-surface items-center justify-center'
              style={{
                width: PREVIEW_MAX_WIDTH,
                maxHeight: SCREEN_HEIGHT * 0.55,
              }}
            >
              <Image
                source={{ uri: previewUri }}
                className='w-full h-full'
                style={{ transform: [{ rotate: `${previewRotation}deg` }] }}
                resizeMode='contain'
              />
            </View>

            <View className='flex-row items-center justify-center gap-5 mt-3 mb-1'>
              <TouchableOpacity
                className='flex-row items-center gap-1 py-2 px-[14px] rounded-lg bg-primary/10'
                onPress={() => setPreviewRotation((r) => r - 90)}
              >
                <Text className='text-lg text-primary'>{'\u21BA'}</Text>
                <Text className='text-sm font-semibold text-primary'>
                  {'-90\u00B0'}
                </Text>
              </TouchableOpacity>
              <Text className='text-[15px] font-bold text-foreground min-w-[36px] text-center'>
                {((previewRotation % 360) + 360) % 360}
                {'\u00B0'}
              </Text>
              <TouchableOpacity
                className='flex-row items-center gap-1 py-2 px-[14px] rounded-lg bg-primary/10'
                onPress={() => setPreviewRotation((r) => r + 90)}
              >
                <Text className='text-lg text-primary'>{'\u21BB'}</Text>
                <Text className='text-sm font-semibold text-primary'>
                  {'+90\u00B0'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text className='text-sm text-muted-foreground mt-3 mb-1 text-center px-5'>
              Review the cropped result. Make sure the receipt looks properly
              aligned.
            </Text>
            <Text className='text-[13px] text-primary font-medium italic mb-3 text-center px-5'>
              Rotate the receipt so that it reads top to bottom.
            </Text>

            <View className='flex-row justify-between px-5 pb-[30px] pt-2 w-full gap-3'>
              <View className='flex-1 flex-row rounded-[10px] border-[1.5px] border-primary overflow-hidden'>
                <TouchableOpacity
                  className='flex-1 py-[14px] items-center justify-center'
                  onPress={handleEditCrop}
                >
                  <Text className='text-primary text-[15px] font-semibold'>
                    Edit Crop
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className='px-3 justify-center items-center border-l-[1.5px] border-l-primary'
                  onPress={() => setDropdownOpen(!dropdownOpen)}
                >
                  <Text className='text-primary text-[10px] font-bold'>
                    {dropdownOpen ? '\u25B2' : '\u25BC'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                className='flex-1 py-[14px] rounded-[10px] bg-primary items-center justify-center'
                onPress={handleConfirmCrop}
              >
                <Text className='text-primary-foreground text-[15px] font-semibold'>
                  Use This Crop
                </Text>
              </TouchableOpacity>
            </View>

            {dropdownOpen && (
              <>
                <Pressable
                  className='absolute inset-0 z-50'
                  onPress={() => setDropdownOpen(false)}
                />
                <View className='absolute bottom-[80px] left-5 w-[180px] bg-card rounded-[10px] shadow-lg z-[51] overflow-hidden'>
                  {onTakeNewPhoto && (
                    <TouchableOpacity
                      className='py-[14px] px-4'
                      onPress={handleTakeNewPhoto}
                    >
                      <Text className='text-[15px] font-medium text-destructive'>
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
        <View className='flex-1 bg-background pt-[50px] items-center'>
          <Text className='text-xl font-bold mb-3 text-foreground'>
            Crop Receipt
          </Text>

          <View
            ref={previewRef}
            className='overflow-visible rounded-lg bg-surface relative items-center'
            style={{ width: previewW, height: previewH }}
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
                fill={overlayColor}
                mask='url(#cropMask)'
              />
              <Polygon
                points={polygonPoints}
                fill='none'
                stroke={RAW_PRIMARY}
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
                      color={RAW_PRIMARY}
                    />
                    <StrokedLine
                      x1={c.x}
                      y1={c.y}
                      x2={c.x + v.x}
                      y2={c.y + v.y}
                      color={RAW_PRIMARY}
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
                    color={RAW_PRIMARY}
                  />
                );
              })}
              <Line
                x1={cx + lineStart.x}
                y1={cy + lineStart.y}
                x2={cx + lineEnd.x}
                y2={cy + lineEnd.y}
                stroke={RAW_PRIMARY}
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
            />
            <RotationHandle
              cropRect={cropRect}
              rotation={rotation}
              onRotationChange={setRotation}
              previewLayoutRef={previewLayoutRef}
            />
          </View>

          <View className='mt-3 mb-1 px-3 py-1.5 rounded-full bg-primary/10'>
            <Text className='text-sm font-semibold text-primary'>
              {Math.round(rotation)}
              {'\u00B0'}
            </Text>
          </View>

          <View className='mt-auto w-full'>
            <Text className='text-sm text-muted-foreground mb-2 text-center px-5'>
              Drag edges or corners to resize, crosshair to move, handle to
              rotate
            </Text>
            <View className='flex-row justify-between px-5 pb-[30px] pt-3 w-full gap-4'>
              <TouchableOpacity
                className='flex-1 py-[14px] rounded-[10px] border-[1.5px] border-primary items-center'
                onPress={handleCropCancel}
                disabled={loading}
              >
                <Text className='text-primary text-base font-semibold'>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className='flex-1 py-[14px] rounded-[10px] bg-primary items-center'
                onPress={handleUseCrop}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={RAW_PRIMARY_FG} size='small' />
                ) : (
                  <Text className='text-primary-foreground text-base font-semibold'>
                    Use Crop
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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
