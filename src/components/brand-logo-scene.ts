import {
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  OrthographicCamera,
  PMREMGenerator,
  Scene,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const HOVER_PITCH = 0.1;
const HOVER_YAW = 0.14;

function createStudioEnvironment(renderer: WebGLRenderer) {
  const room = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04, 0.1, 100, { size: 64 });
  room.dispose();
  pmrem.dispose();
  return environment;
}

function createLogoGeometry(paths: ReturnType<SVGLoader["parse"]>["paths"]) {
  const pieces: ExtrudeGeometry[] = [];
  const shade = new Color();
  const teal = new Color("#008c70");
  const cyan = new Color("#029dc8");
  const blue = new Color("#072454");
  const navy = new Color("#03132f");
  const navyHighlight = new Color("#16366a");

  for (const path of paths) {
    const node = path.userData.node;
    const material = node instanceof Element ? node.getAttribute("data-material") : null;
    for (const shape of path.toShapes()) {
      const geometry = new ExtrudeGeometry(shape, {
        curveSegments: 9,
        depth: 3.1,
        bevelEnabled: true,
        bevelThickness: 1,
        bevelSize: 0.64,
        bevelSegments: 3,
      });
      const positions = geometry.getAttribute("position");
      const colors = new Float32Array(positions.count * 3);

      for (let index = 0; index < positions.count; index++) {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const depth = positions.getZ(index);
        if (material === "teal") {
          shade.copy(teal).lerp(cyan, Math.min(1, Math.max(0, (x - 31) / 118)));
        } else if (material === "one") {
          shade.copy(blue).lerp(cyan, Math.min(1, Math.max(0, (y - 43) / 55)) ** 1.4);
        } else {
          shade.copy(navy).lerp(navyHighlight, Math.max(0, (78 - y) / 70) * 0.65);
        }
        shade.multiplyScalar(depth >= 2.8 ? 1 : 0.68);
        shade.toArray(colors, index * 3);
      }
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      pieces.push(geometry);
    }
  }

  const geometry = mergeGeometries(pieces);
  pieces.forEach((piece) => piece.dispose());
  return geometry;
}

export function renderGlossyLogo(host: HTMLElement, svg: string) {
  const { xml, paths } = new SVGLoader().parse(svg);
  const [, , width, height] = (xml.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
  if (!width || !height || !paths.length) return;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", {
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
    failIfMajorPerformanceCaveat: true,
  });
  if (!context) return;

  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  const geometry = createLogoGeometry(paths);
  if (!geometry) {
    renderer.dispose();
    return;
  }
  canvas.className = "g1-brand-logo__canvas";
  canvas.setAttribute("aria-hidden", "true");

  const environment = createStudioEnvironment(renderer);
  const scene = new Scene();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.46;
  const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0.1, 1000);
  camera.position.z = 510;

  const material = new MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 0.47,
    roughness: 0.25,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
  });
  material.onBeforeCompile = (shader) => {
    // Shade the G's two large faces across their curves, independently of the bevel lighting.
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vLogoPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLogoPosition = position.xy;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vLogoPosition;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec2 logoPoint = vLogoPosition;
        if (logoPoint.x < 167.0 && logoPoint.y < 34.0) {
          diffuseColor.rgb *= mix(1.35, 0.34, smoothstep(12.0, 32.0, logoPoint.y));
        } else if (logoPoint.x < 167.0 && (logoPoint.y > 74.0 || logoPoint.x > 117.0)) {
          float band = (logoPoint.y - 84.0 - 0.05 * (logoPoint.x - 110.0)) / 8.0;
          float shine = exp(-band * band);
          diffuseColor.rgb *= 0.63 + 0.65 * shine;
        }
      `);
  };
  const mark = new Mesh(geometry, material);
  mark.scale.y = -1;
  mark.position.set(-width / 2, height / 2, -2);

  const turntable = new Group();
  turntable.add(mark);
  scene.add(turntable, new HemisphereLight("#eefaff", "#9badc8", 0.96));

  const key = new DirectionalLight("#f3fcff", 1.85);
  const rim = new DirectionalLight("#8cdfec", 0.8);
  key.position.set(-120, 180, 300);
  rim.position.set(170, -80, 30);
  scene.add(key, rim);

  let targetPitch = 0;
  let targetYaw = 0;
  let lastFrame = 0;
  let running = false;
  let disposed = false;

  function draw() {
    renderer.render(scene, camera);
  }

  function stopAnimation() {
    renderer.setAnimationLoop(null);
    running = false;
    lastFrame = 0;
  }

  function tick(time: number) {
    const delta = lastFrame ? Math.min((time - lastFrame) / 1000, 0.05) : 1 / 60;
    lastFrame = time;
    const { rotation } = turntable;
    const settled = Math.abs(rotation.x - targetPitch) + Math.abs(rotation.y - targetYaw) < 0.0008;
    const ease = settled ? 1 : 1 - Math.exp(-delta * 13);
    rotation.x += (targetPitch - rotation.x) * ease;
    rotation.y += (targetYaw - rotation.y) * ease;
    key.position.x = -120 + rotation.y * 1250;
    key.position.y = 180 - rotation.x * 650;
    draw();
    if (settled) stopAnimation();
  }

  function startAnimation() {
    if (running || disposed) return;
    running = true;
    renderer.setAnimationLoop(tick);
  }

  function followPointer(event: PointerEvent) {
    if (event.pointerType === "touch") return;
    const bounds = host.getBoundingClientRect();
    targetPitch = (0.5 - (event.clientY - bounds.top) / bounds.height) * 2 * HOVER_PITCH;
    targetYaw = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2 * HOVER_YAW;
    startAnimation();
  }

  function resetPointer() {
    targetPitch = 0;
    targetYaw = 0;
    startAnimation();
  }

  function resize() {
    if (disposed) return;
    const { width: cssWidth, height: cssHeight } = host.getBoundingClientRect();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(cssWidth, cssHeight, false);
    draw();
  }

  const sizeObserver = new ResizeObserver(resize);
  host.append(canvas);
  try {
    resize();
  } catch {
    dispose();
    return;
  }
  host.dataset.rendered = "true";
  sizeObserver.observe(host);
  window.addEventListener("resize", resize);
  host.addEventListener("pointermove", followPointer);
  host.addEventListener("pointerleave", resetPointer);
  canvas.addEventListener("webglcontextlost", dispose);

  function dispose() {
    if (disposed) return;
    disposed = true;
    stopAnimation();
    sizeObserver.disconnect();
    window.removeEventListener("resize", resize);
    host.removeEventListener("pointermove", followPointer);
    host.removeEventListener("pointerleave", resetPointer);
    canvas.removeEventListener("webglcontextlost", dispose);
    geometry.dispose();
    material.dispose();
    environment.dispose();
    renderer.dispose();
    if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
    canvas.remove();
    delete host.dataset.rendered;
  }

  return dispose;
}
