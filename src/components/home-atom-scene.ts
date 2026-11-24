import {
  AdditiveBlending, AmbientLight, Color, DirectionalLight, Euler, Group,
  Mesh, MeshBasicMaterial, MeshPhongMaterial, OrthographicCamera, Scene,
  SphereGeometry, TorusGeometry, Vector2, WebGLRenderer,
} from "three";

export function mountHomeAtom(host: HTMLDivElement) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true, powerPreference: "low-power" });
  if (!context) return;

  const renderer = new WebGLRenderer({ canvas, context });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  const scene = new Scene();
  const camera = new OrthographicCamera(-1.2, 1.2, 1.2, -1.2, 0.1, 20);
  camera.position.z = 6;
  const atom = new Group();
  scene.add(atom);

  const key = new DirectionalLight(0xfff6ca, 3.4);
  key.position.set(-2, 2, 4);
  scene.add(new AmbientLight(0xffba2a, 1.1), key);
  const nucleusGeometry = new SphereGeometry(0.215, 24, 18);
  const nucleusMaterial = new MeshPhongMaterial({ color: 0xffb90b, emissive: 0xb84a00, shininess: 105, specular: 0xfff9cd });
  const nucleus = new Mesh(nucleusGeometry, nucleusMaterial);
  atom.add(nucleus);

  const speckGeometry = new SphereGeometry(0.024, 10, 8);
  const speckMaterial = new MeshBasicMaterial({ color: 0xfff4b4 });
  for (const [x, y, z] of [[-.10, .11, .15], [.10, -.09, .157], [.097, .12, -.135], [-.15, -.10, -.10], [.01, -.184, .08]]) {
    const speck = new Mesh(speckGeometry, speckMaterial);
    speck.position.set(x, y, z);
    nucleus.add(speck);
  }

  const wire = new TorusGeometry(1, .012, 8, 88);
  const glowWire = new TorusGeometry(1, .042, 8, 88);
  const electronGeometry = new SphereGeometry(.055, 12, 8);
  const orbits = [
    { angle: Math.PI / 2, color: 0xffc65e, phase: .26, speed: .55 },
    { angle: -.52, color: 0x39d9ff, phase: 2.9, speed: -.78 },
    { angle: .52, color: 0xff9c91, phase: 5.5, speed: .91 },
  ].map(orbit => {
    const group = new Group();
    const tint = new Color(orbit.color);
    const core = new MeshBasicMaterial({ color: tint.clone().lerp(new Color(0xffffff), .64) });
    const glow = new MeshBasicMaterial({ color: tint, transparent: true, opacity: .38, blending: AdditiveBlending, depthWrite: false });
    const electron = new Mesh(electronGeometry, core);
    group.add(new Mesh(wire, core), new Mesh(glowWire, glow), electron);
    atom.add(group);
    return { ...orbit, group, electron, core, glow };
  });

  const target = new Vector2();
  const orientation = new Euler();
  let elapsed = 0;
  let previous = 0;
  let contextLost = false;
  let visible = false;

  function render() {
    for (const { group, electron, angle, phase, speed } of orbits) {
      group.rotation.set(1.11 + .24 * Math.sin(elapsed * speed + phase), .21 * Math.sin(elapsed * speed + phase), angle + elapsed * speed * .32, "ZYX");
      electron.position.set(Math.cos(elapsed * speed * 2 + phase), Math.sin(elapsed * speed * 2 + phase), 0);
    }
    nucleus.rotation.set(elapsed * .41, elapsed * .65, 0);
    orientation.x += (target.x - orientation.x) * .12;
    orientation.y += (target.y - orientation.y) * .12;
    atom.rotation.copy(orientation);
    renderer.render(scene, camera);
  }

  function tick(time: number) {
    const delta = previous ? Math.min(50, time - previous) : 0;
    previous = time;
    elapsed += delta / 1000;
    render();
  }

  function syncLoop() {
    previous = 0;
    renderer.setAnimationLoop(!visible || contextLost || document.hidden ? null : tick);
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = host;
    if (!width || !height || contextLost) return;
    const scale = Math.min(width, height);
    camera.left = -1.2 * width / scale;
    camera.right = -camera.left;
    camera.top = 1.2 * height / scale;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    render();
  }

  const respondsToPointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  function move(event: PointerEvent) {
    if (!respondsToPointer || event.pointerType === "touch") return;
    const rect = host.getBoundingClientRect();
    target.set((.5 - (event.clientY - rect.y) / rect.height) * .46, ((event.clientX - rect.x) / rect.width - .5) * .46);
  }

  function leave() {
    target.set(0, 0);
  }

  function lost(event: Event) {
    event.preventDefault();
    contextLost = true;
    syncLoop();
    delete host.dataset.rendered;
  }

  function restored() {
    contextLost = false;
    resize();
    host.dataset.rendered = "true";
    syncLoop();
  }

  host.append(canvas);
  resize();
  host.dataset.rendered = "true";
  const size = new ResizeObserver(resize);
  size.observe(host);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerleave", leave);
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  document.addEventListener("visibilitychange", syncLoop);

  return {
    setVisible(value: boolean) {
      visible = value;
      syncLoop();
    },
    dispose() {
      renderer.setAnimationLoop(null);
      size.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      document.removeEventListener("visibilitychange", syncLoop);
      delete host.dataset.rendered;
      canvas.remove();
      for (const geometry of [wire, glowWire, electronGeometry, nucleusGeometry, speckGeometry]) geometry.dispose();
      for (const { core, glow } of orbits) { core.dispose(); glow.dispose(); }
      nucleusMaterial.dispose();
      speckMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
