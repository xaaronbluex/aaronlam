/**
 * Tiny spinning Blue Marble beside the portfolio title.
 *
 * Texture: NASA Visible Earth "Blue Marble: Land Surface, Shallow Water,
 * and Shaded Topography" (land_ocean_ice_2048, August 2004).
 * Public domain — U.S. government work.
 * https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography
 *
 * Three.js r170 (MIT) is vendored at assets/js/three.module.min.js.
 */
import * as THREE from "./three.module.min.js";

const CSS_SIZE = 56;
const MAX_PIXEL_RATIO = 3;
const SECONDS_PER_TURN = 42;
const AXIAL_TILT = THREE.MathUtils.degToRad(23.4);

const canvas = document.getElementById("earth-globe");
if (canvas) {
	initEarth(canvas);
}

function initEarth(canvas) {
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	let renderer;

	try {
		renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: true,
			antialias: true,
			powerPreference: "low-power",
		});
	} catch (error) {
		canvas.remove();
		return;
	}

	if (!renderer.getContext()) {
		canvas.remove();
		return;
	}

	renderer.setClearColor(0x000000, 0);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	applySize();

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
	const radius = 1;
	const fill = 0.8;
	camera.position.z = radius / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * fill);

	scene.add(new THREE.AmbientLight(0xffffff, Math.PI * 0.95));
	const sun = new THREE.DirectionalLight(0xfff6ee, Math.PI * 0.55);
	sun.position.set(4.2, 1.6, 3.4);
	scene.add(sun);

	const globe = new THREE.Group();
	globe.rotation.z = AXIAL_TILT;
	scene.add(globe);

	const earthGeometry = new THREE.SphereGeometry(radius, 96, 72);
	const earthMaterial = new THREE.MeshPhongMaterial({
		color: 0xffffff,
		emissive: new THREE.Color(0xffffff),
		emissiveIntensity: 0.42,
		specular: new THREE.Color(0x1c3038),
		shininess: 18,
	});
	const earth = new THREE.Mesh(earthGeometry, earthMaterial);
	earth.rotation.y = 0.15;
	globe.add(earth);

	const atmosphereGeometry = new THREE.SphereGeometry(radius * 1.08, 96, 72);
	const atmosphereMaterial = new THREE.ShaderMaterial({
		side: THREE.BackSide,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		uniforms: {},
		vertexShader: `
			varying vec3 vNormal;
			void main() {
				vNormal = normalize(normalMatrix * normal);
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			varying vec3 vNormal;
			void main() {
				float rim = clamp(pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.3), 0.0, 1.0);
				gl_FragColor = vec4(0.50, 0.74, 1.0, 1.0) * rim;
			}
		`,
	});
	globe.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

	const textureLoader = new THREE.TextureLoader();
	const textureUrl = new URL("../../images/earth-blue-marble.jpg", import.meta.url);
	let frame = 0;
	let running = false;
	let disposed = false;
	let lastTime = 0;

	textureLoader.load(
		textureUrl.href,
		function (texture) {
			if (disposed) {
				texture.dispose();
				return;
			}
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
			earthMaterial.map = texture;
			earthMaterial.emissiveMap = texture;
			earthMaterial.needsUpdate = true;
			canvas.classList.add("is-ready");
			renderFrame(performance.now());
			start();
		},
		undefined,
		function () {
			dispose();
			canvas.remove();
		}
	);

	reducedMotion.addEventListener("change", onMotionChange);
	document.addEventListener("visibilitychange", onMotionChange);
	window.addEventListener("resize", applySize);
	window.addEventListener("pagehide", dispose, { once: true });

	function applySize() {
		const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
		renderer.setPixelRatio(pixelRatio);
		renderer.setSize(CSS_SIZE, CSS_SIZE, false);
	}

	function shouldSpin() {
		return !reducedMotion.matches && document.visibilityState !== "hidden";
	}

	function onMotionChange() {
		if (shouldSpin()) {
			start();
		} else {
			stop();
			if (canvas.classList.contains("is-ready")) {
				renderFrame(performance.now());
			}
		}
	}

	function start() {
		if (running || disposed || !canvas.classList.contains("is-ready") || !shouldSpin()) {
			return;
		}
		running = true;
		lastTime = performance.now();
		frame = window.requestAnimationFrame(tick);
	}

	function stop() {
		running = false;
		if (frame) {
			window.cancelAnimationFrame(frame);
			frame = 0;
		}
	}

	function tick(now) {
		if (!running) {
			return;
		}
		renderFrame(now);
		frame = window.requestAnimationFrame(tick);
	}

	function renderFrame(now) {
		const delta = Math.min((now - lastTime) / 1000, 0.05);
		lastTime = now;
		if (shouldSpin() && delta > 0) {
			earth.rotation.y += (Math.PI * 2 * delta) / SECONDS_PER_TURN;
		}
		renderer.render(scene, camera);
	}

	function dispose() {
		if (disposed) {
			return;
		}
		disposed = true;
		stop();
		reducedMotion.removeEventListener("change", onMotionChange);
		document.removeEventListener("visibilitychange", onMotionChange);
		window.removeEventListener("resize", applySize);
		if (earthMaterial.map) {
			earthMaterial.map.dispose();
		}
		earthGeometry.dispose();
		earthMaterial.dispose();
		atmosphereGeometry.dispose();
		atmosphereMaterial.dispose();
		renderer.dispose();
		renderer.forceContextLoss();
	}
}
